const { prisma } = require('../config/database');
const { bankingService } = require('../services/banking.service');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * GET /api/banks
 * Get all bank accounts for the authenticated user
 */
const getBanks = async (req, res, next) => {
  try {
    const banks = await prisma.bankAccount.findMany({
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
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totals
    const totalBanks = banks.length;
    const totalCurrentBalance = banks.reduce((sum, b) => sum + (b.currentBalance || 0), 0);

    res.json({
      success: true,
      data: {
        banks,
        totalBanks,
        totalCurrentBalance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/banks/:id
 * Get a specific bank account with recent transactions
 */
const getBank = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bank = await prisma.bankAccount.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    if (!bank) {
      throw new NotFoundError('Bank account not found');
    }

    // Verify ownership
    if (bank.userId !== req.user.id) {
      throw new ForbiddenError('Access denied');
    }

    res.json({
      success: true,
      data: { bank },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/banks/:id
 * Remove a linked bank account
 */
const deleteBank = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bank = await prisma.bankAccount.findUnique({ where: { id } });

    if (!bank) {
      throw new NotFoundError('Bank account not found');
    }

    if (bank.userId !== req.user.id) {
      throw new ForbiddenError('Access denied');
    }

    // Remove linked item via banking service
    try {
      await bankingService.removeItem(bank.plaidAccessToken);
    } catch (err) {
      console.error('Item removal error (non-fatal):', err.message);
    }

    // Delete from database (cascades to transactions)
    await prisma.bankAccount.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Bank account removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/banks/:id/sync
 * Sync balances and transactions for a bank account
 */
const syncBank = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bank = await prisma.bankAccount.findUnique({ where: { id } });

    if (!bank) {
      throw new NotFoundError('Bank account not found');
    }

    if (bank.userId !== req.user.id) {
      throw new ForbiddenError('Access denied');
    }

    // Refresh balances from banking service
    const balanceResponse = await bankingService.getBalances(bank.plaidAccessToken, bank.accountId);

    const serviceAccount = balanceResponse.accounts.find(
      (acc) => acc.account_id === bank.accountId
    );

    if (serviceAccount) {
      await prisma.bankAccount.update({
        where: { id },
        data: {
          currentBalance: serviceAccount.balances.current,
          availableBalance: serviceAccount.balances.available,
        },
      });
    }

    // Sync recent transactions
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const txnResponse = await bankingService.getTransactions(bank.plaidAccessToken, {
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      count: 100,
      accountIds: [bank.accountId],
    });

    for (const txn of txnResponse.transactions) {
      await prisma.transaction.upsert({
        where: { plaidTransactionId: txn.transaction_id },
        update: {
          amount: txn.amount,
          pending: txn.pending,
          category: txn.category?.[0] || null,
        },
        create: {
          bankAccountId: bank.id,
          plaidTransactionId: txn.transaction_id,
          name: txn.name,
          amount: txn.amount,
          date: new Date(txn.date),
          category: txn.category?.[0] || null,
          categoryId: txn.category_id || null,
          channel: txn.payment_channel,
          pending: txn.pending,
          merchantName: txn.merchant_name,
          paymentChannel: txn.payment_channel,
          image: txn.logo_url || null,
        },
      });
    }

    // Return updated bank
    const updatedBank = await prisma.bankAccount.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    res.json({
      success: true,
      data: { bank: updatedBank },
      message: 'Bank account synced successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBanks, getBank, deleteBank, syncBank };
