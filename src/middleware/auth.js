const { verifyAccessToken } = require('../utils/helpers');
const { UnauthorizedError } = require('../utils/errors');
const { prisma } = require('../config/database');

/**
 * Middleware to protect routes - verifies JWT access token
 * Checks Authorization header (Bearer token) and cookies
 */
const authenticate = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Fallback to cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }

    // Verify the token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        address1: true,
        city: true,
        state: true,
        postalCode: true,
        dateOfBirth: true,
        paymentCustomerId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    next(error);
  }
};

module.exports = { authenticate };
