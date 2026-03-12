const { prisma } = require('../config/database');
const { bankingService } = require('../services/banking.service');
const { encryptId } = require('../utils/helpers');

/**
 * POST /api/banking/create-link-token
 * Create a link token for the client to initiate bank connection
 */
const createLinkToken = async (req, res, next) => {
  try {
    const result = await bankingService.createLinkToken(req.user.id);

    res.json({
      success: true,
      data: {
        linkToken: result.linkToken,
        expiration: result.expiration,
        institutions: result.institutions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/banking/connect
 * Connect a bank account (exchange token and store accounts)
 */
const connectBank = async (req, res, next) => {
  try {
    const { publicToken, institutionId } = req.body;
    const user = req.user;

    // Exchange token for access credentials
    const exchangeResult = await bankingService.exchangePublicToken(
      publicToken,
      institutionId
    );

    const { accessToken, itemId, accounts } = exchangeResult;
    const createdAccounts = [];

    // Store each account in the database
    for (const account of accounts) {
      const bankAccount = await prisma.bankAccount.create({
        data: {
          userId: user.id,
          plaidItemId: itemId,
          plaidAccessToken: accessToken,
          accountId: account.account_id,
          name: account.name,
          officialName: account.official_name,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
          currentBalance: account.balances.current,
          availableBalance: account.balances.available,
          isoCurrencyCode: account.balances.iso_currency_code || 'USD',
          shareableId: encryptId(account.account_id),
        },
      });

      createdAccounts.push(bankAccount);
    }

    // Sync initial transactions
    await syncTransactionsForAccounts(accessToken, createdAccounts);

    res.json({
      success: true,
      data: {
        accounts: createdAccounts.map((acc) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask,
          currentBalance: acc.currentBalance,
        })),
        message: 'Bank account linked successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/banking/institutions
 * Get available institutions for the connect flow
 */
const getInstitutions = async (req, res, next) => {
  try {
    const result = await bankingService.getInstitutions();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper: Sync transactions from banking service for given accounts
 */
const syncTransactionsForAccounts = async (accessToken, accounts) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await bankingService.getTransactions(accessToken, {
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      count: 50,
    });

    for (const txn of result.transactions) {
      const bankAccount = accounts.find((acc) => acc.accountId === txn.account_id);
      if (!bankAccount) continue;

      // Use upsert to avoid duplicates
      await prisma.transaction.upsert({
        where: { plaidTransactionId: txn.transaction_id },
        update: {
          amount: txn.amount,
          pending: txn.pending,
          category: txn.category?.[0] || null,
        },
        create: {
          bankAccountId: bankAccount.id,
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
  } catch (error) {
    console.error('Transaction sync error (non-fatal):', error.message);
  }
};

module.exports = { createLinkToken, connectBank, getInstitutions };
