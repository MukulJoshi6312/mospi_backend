import morgan from 'morgan';

morgan.token('id', (req) => req.id);

// Skip noisy health checks so logs stay readable.
const skip = (req) => req.originalUrl.startsWith('/api/health');

export const httpLogger = morgan(
  ':remote-addr :id :method :url :status :res[content-length] - :response-time ms',
  { skip },
);
