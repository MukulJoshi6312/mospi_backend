import { v4 as uuid } from 'uuid';

// Attach a unique correlation ID to every request — exposed in logs and
// returned to the client via X-Request-Id so you can trace bugs end-to-end.
export const requestId = (req, res, next) => {
  req.id = req.get('X-Request-Id') || uuid();
  res.setHeader('X-Request-Id', req.id);
  next();
};
