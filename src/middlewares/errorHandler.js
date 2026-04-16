// Centralised error handler — don't leak stack traces in production.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message,
  });
};

export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
};
