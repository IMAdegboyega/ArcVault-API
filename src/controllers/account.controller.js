const { prisma } = require('../config/database');
const { getPagination } = require('../utils/helpers');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * GET /api/accounts
 * Get all accounts with balances for the authenticated user
 */
const getAccounts = async (req, res, next) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        name: true,
        officialName: true,
        type: true,
        subtype: true,
        mask: true,
        currentBalance: true,
        availableBalance: true,
        isoCurrencyCode: true,
        shareableId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalBanks = accounts.length;
    const totalCurrentBalance = accounts.reduce(
      (sum, acc) => sum + (acc.currentBalance || 0),
      0
    );

    res.json({
      success: true,
      data: {
        accounts,
        totalBanks,
        totalCurrentBalance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/accounts/:id
 * Get a specific account with details
 */
const getAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const account = await prisma.bankAccount.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        officialName: true,
        type: true,
        subtype: true,
        mask: true,
        currentBalance: true,
        availableBalance: true,
        isoCurrencyCode: true,
        shareableId: true,
        createdAt: true,
      },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // Ownership is checked via the userId in the bank query
    const fullAccount = await prisma.bankAccount.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!fullAccount) {
      throw new ForbiddenError('Access denied');
    }

    res.json({
      success: true,
      data: { account },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/accounts/:id/transactions
 * Get paginated transactions for a specific account
 */
const getAccountTransactions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, startDate, endDate, category } = req.query;

    // Verify account ownership
    const account = await prisma.bankAccount.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // Build filter
    const where = { bankAccountId: id };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (category) {
      where.category = category;
    }

    const { skip, take } = getPagination(Number(page), Number(limit));

    // Get transactions with count
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
          hasMore: skip + take < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAccounts, getAccount, getAccountTransactions };
