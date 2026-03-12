/**
 * Simple in-memory rate limiter
 * For production, use Redis-backed rate limiting
 */

const rateLimitStore = new Map();

const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests' } = {}) => {
  // Clean up expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore) {
      if (now - value.startTime > windowMs) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, startTime: now });
      return next();
    }

    const record = rateLimitStore.get(key);

    // Reset window if expired
    if (now - record.startTime > windowMs) {
      rateLimitStore.set(key, { count: 1, startTime: now });
      return next();
    }

    record.count++;

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message,
          retryAfter: Math.ceil((record.startTime + windowMs - now) / 1000),
        },
      });
    }

    next();
  };
};

// Strict limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many authentication attempts, please try again later',
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please slow down',
});

module.exports = { rateLimit, authLimiter, apiLimiter };
