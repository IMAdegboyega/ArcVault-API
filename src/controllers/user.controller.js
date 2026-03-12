const { prisma } = require('../config/database');
const { sanitizeUser } = require('../utils/helpers');
const { NotFoundError } = require('../utils/errors');

/**
 * GET /api/user/profile
 * Get current user's profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        bankAccounts: {
          select: {
            id: true,
            name: true,
            officialName: true,
            type: true,
            subtype: true,
            mask: true,
            currentBalance: true,
            availableBalance: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        bankAccounts: user.bankAccounts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/profile
 * Update current user's profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, address1, city, state, postalCode } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(address1 && { address1 }),
        ...(city && { city }),
        ...(state && { state }),
        ...(postalCode && { postalCode }),
      },
    });

    res.json({
      success: true,
      data: { user: sanitizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile };
