// Wrap an async controller so thrown errors land in the central error handler
// without needing try/catch in every function.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
