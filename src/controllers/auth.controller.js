import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// --- token helpers ---------------------------------------------------------
const signAccess = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });

const signRefresh = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

// Convert "7d" / "15m" / "30s" → milliseconds so we can store absolute expiry.
const ttlToMs = (ttl) => {
  const m = /^(\d+)([smhd])$/.exec(ttl || '');
  if (!m) return 0;
  const n = Number(m[1]);
  return { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]] * n;
};

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

// Issue a new pair and persist the refresh-token hash.
const issueTokens = async (userId) => {
  const accessToken = signAccess(userId);
  const refreshToken = signRefresh(userId);
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
    `INSERT INTO users (name, email, password)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name, email, hash],
  );

  const user = rows[0];
  const tokens = await issueTokens(user.id);
  res.status(201).json({ success: true, data: { user, ...tokens } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password required' });
  }

  const { rows } = await query(
    'SELECT id, name, email, password FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const tokens = await issueTokens(user.id);
  res.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, email: user.email },
      ...tokens,
    },
  });
});

// POST /api/auth/refresh  body: { refreshToken }
// - Verifies the JWT signature + expiry
// - Checks the hash exists in DB and isn't revoked (defeats reuse of old copies)
// - Rotates: old token is revoked, a new pair is issued
export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'refreshToken required' });
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
    // Token verifies but was revoked or unknown — possible replay. Wipe all
    // sessions for this user as a safety measure.
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [payload.sub],
    );
    return res.status(401).json({ success: false, message: 'Refresh token not recognised' });
  }

  // Rotate — revoke the used one, issue a fresh pair.
  await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [rows[0].id]);
  const tokens = await issueTokens(payload.sub);
  res.json({ success: true, data: tokens });
});

// POST /api/auth/logout  body: { refreshToken }
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [
      sha256(refreshToken),
    ]);
  }
  res.json({ success: true, message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, email, created_at FROM users WHERE id = $1',
    [req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: { user: rows[0] } });
});
