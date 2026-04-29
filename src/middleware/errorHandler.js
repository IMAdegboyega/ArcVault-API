const { AppError } = require('../utils/errors');

/**
 * Global error handler - catches all errors thrown in route handlers
 */
const errorHandler = (err, req, res, next) => {
  // Log error in development (loud + full stack so 500s are debuggable)
  if (process.env.NODE_ENV !== 'production') {
    console.error('\n========== Unhandled error on', req.method, req.originalUrl, '==========');
    console.error('name:   ', err.name);
    console.error('code:   ', err.code);
    console.error('message:', err.message);
    if (err.stack) console.error(err.stack);
    console.error('==========================================================\n');
  }

  // Operational errors (our custom errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE',
        message: 'A record with this value already exists',
      },
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Record not found',
      },
    });
  }

  // Table or column missing from DB — almost always means migrations haven't run
  if (err.code === 'P2021' || err.code === 'P2022') {
    return res.status(500).json({
      success: false,
      error: {
        code: 'SCHEMA_OUT_OF_SYNC',
        message:
          'Database schema is out of sync. Run `npm run db:push` (or `npm run db:migrate`) in the backend, then `npm run db:seed` if you want test users.',
      },
    });
  }

  // Can't reach the database
  if (err.code === 'P1001' || err.code === 'P1002') {
    return res.status(503).json({
      success: false,
      error: {
        code: 'DB_UNREACHABLE',
        message: 'Database is unreachable. Check DATABASE_URL in backend/.env.',
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
      },
    });
  }

  // Zod validation errors (if they slip through)
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: err.errors,
      },
    });
  }

  // Unknown / unhandled errors
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
    },
  });
};

/**
 * Catch 404 routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
};

module.exports = { errorHandler, notFoundHandler };
