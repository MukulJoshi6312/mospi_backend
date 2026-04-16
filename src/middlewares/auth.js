import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid token';
    return res.status(401).json({ success: false, message });
  }
};
