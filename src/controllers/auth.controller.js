import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fileUrl } from '../middlewares/upload.js';

// SELECT clause that maps DB columns → camelCase for the user response.
const USER_FIELDS = `
  id, name, email, role,
  profile_picture AS "profilePicture",
  phone, gender,
  TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
  address, bio,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

// --- token helpers ---------------------------------------------------------
const signAccess = (userId, role) =>
  jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });

const signRefresh = (userId, role) =>
  jwt.sign({ sub: userId, role }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

const ttlToMs = (ttl) => {
  const m = /^(\d+)([smhd])$/.exec(ttl || '');
  if (!m) return 0;
  const n = Number(m[1]);
  return { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]] * n;
};

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/',
  maxAge: ttlToMs(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
};

const setRefreshCookie = (res, token) =>
  res.cookie('refreshToken', token, COOKIE_OPTIONS);

const clearRefreshCookie = (res) =>
  res.clearCookie('refreshToken', {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure: COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
    path: COOKIE_OPTIONS.path,
  });

const issueTokens = async (userId, role) => {
  const accessToken = signAccess(userId, role);
  const refreshToken = signRefresh(userId, role);
  const expiresAt = new Date(
    Date.now() + ttlToMs(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
  );
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, sha256(refreshToken), expiresAt],
  );
  return { accessToken, refreshToken };
};

// --- controllers -----------------------------------------------------------

// Public registration — always creates role "user".
// Only an admin can upgrade someone's role later.
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: 'name, email and password required' });
  }

  const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (exists.rowCount > 0) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, 'user')
     RETURNING id, name, email, role, created_at`,
    [name, email, hash],
  );

  const user = rows[0];
  const { accessToken, refreshToken } = await issueTokens(user.id, user.role);
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ success: true, data: { user, accessToken } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password required' });
  }

  const { rows } = await query(
    'SELECT id, name, email, password, role FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const { accessToken, refreshToken } = await issueTokens(user.id, user.role);
  setRefreshCookie(res, refreshToken);
  res.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'refreshToken cookie required' });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }

  const tokenHash = sha256(refreshToken);
  const { rows } = await query(
    `SELECT id FROM refresh_tokens
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()`,
    [tokenHash],
  );
  if (!rows[0]) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [payload.sub],
    );
    return res.status(401).json({ success: false, message: 'Refresh token not recognised' });
  }

  // Get fresh role from DB (in case admin changed it since last login)
  const userResult = await query('SELECT role FROM users WHERE id = $1', [payload.sub]);
  const currentRole = userResult.rows[0]?.role || 'user';

  await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [rows[0].id]);
  const tokens = await issueTokens(payload.sub, currentRole);
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ success: true, data: { accessToken: tokens.accessToken } });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [
      sha256(refreshToken),
    ]);
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ${USER_FIELDS} FROM users WHERE id = $1`,
    [req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: { user: rows[0] } });
});

// PUT /api/auth/me  (multipart/form-data; file field: profilePicture)
// The logged-in user updates their own profile. email and role are ignored
// even if sent — those must go through the admin role endpoint.
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, gender, dateOfBirth, address, bio } = req.body;

  if (!name || !phone || !gender || !dateOfBirth) {
    return res.status(400).json({
      success: false,
      message: 'name, phone, gender and dateOfBirth are required',
    });
  }

  const allowedGenders = ['male', 'female', 'other'];
  if (!allowedGenders.includes(gender)) {
    return res.status(400).json({
      success: false,
      message: `gender must be one of: ${allowedGenders.join(', ')}`,
    });
  }

  // Only replace profile picture if a new file was uploaded.
  const profilePicture = fileUrl(req);

  const { rows, rowCount } = await query(
    `UPDATE users SET
       name            = $2,
       phone           = $3,
       gender          = $4,
       date_of_birth   = $5,
       address         = $6,
       bio             = $7,
       profile_picture = COALESCE($8, profile_picture),
       updated_at      = NOW()
     WHERE id = $1
     RETURNING ${USER_FIELDS}`,
    [
      req.user.id,
      name,
      phone,
      gender,
      dateOfBirth,
      address || null,
      bio || null,
      profilePicture,
    ],
  );
  if (!rowCount) return res.status(404).json({ success: false, message: 'User not found' });

  res.json({ success: true, data: { user: rows[0] } });
});

// Admin-only: change a user's role
export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const allowed = ['user', 'officer', 'admin', 'super_admin'];
  if (!role || !allowed.includes(role)) {
    return res
      .status(400)
      .json({ success: false, message: `role must be one of: ${allowed.join(', ')}` });
  }

  const { rows, rowCount } = await query(
    `UPDATE users SET role = $2 WHERE id = $1
     RETURNING id, name, email, role, created_at`,
    [id, role],
  );
  if (!rowCount) return res.status(404).json({ success: false, message: 'User not found' });

  res.json({ success: true, data: { user: rows[0] } });
});

// PUT /api/auth/change-password — logged-in user changes own password
export const changePassword = asyncHandler(async (req, res) => {
  // Accept common field name variants from frontend
  const currentPassword = req.body.currentPassword || req.body.oldPassword || req.body.password;
  const newPassword = req.body.newPassword;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ success: false, message: 'currentPassword and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ success: false, message: 'New password must be at least 8 characters' });
  }

  if (currentPassword === newPassword) {
    return res
      .status(400)
      .json({ success: false, message: 'New password must be different from current password' });
  }

  // Fetch the HASHED password from DB
  const userResult = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  if (!userResult.rows[0]) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const storedHash = userResult.rows[0].password;
  const isMatch = await bcrypt.compare(currentPassword, storedHash);

  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password = $2, updated_at = NOW() WHERE id = $1', [
    req.user.id,
    newHash,
  ]);

  // Revoke all refresh tokens so user must re-login on other devices
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [req.user.id],
  );

  res.json({ success: true, message: 'Password changed successfully' });
});

// Admin-only: list all users
export const listUsers = asyncHandler(async (_req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, role, created_at FROM users ORDER BY id ASC',
  );
  res.json({ success: true, data: rows });
});
