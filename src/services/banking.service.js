/**
 * ArcVault Banking Service
 * 
 * Simulated bank aggregation layer with a provider-agnostic interface.
 * Replaces Plaid in development. To integrate a real provider, implement
 * the same interface with Plaid, Mono (Africa), Nordigen (EU), or MX.
 * 
 * Interface methods:
 *   - createLinkToken(userId)                → { linkToken, expiration }
 *   - exchangePublicToken(publicToken)       → { accessToken, itemId }
 *   - getAccounts(accessToken)               → { accounts[] }
 *   - getBalances(accessToken, accountId?)   → { accounts[] }
 *   - getTransactions(accessToken, options)   → { transactions[] }
 *   - removeItem(accessToken)                → { removed: boolean }
 */

const crypto = require('crypto');

// ==================== Mock Data ====================

const MOCK_INSTITUTIONS = [
  { id: 'ins_chase', name: 'Chase', logo: 'chase' },
  { id: 'ins_bofa', name: 'Bank of America', logo: 'bofa' },
  { id: 'ins_wells', name: 'Wells Fargo', logo: 'wells' },
  { id: 'ins_citi', name: 'Citibank', logo: 'citi' },
  { id: 'ins_capital', name: 'Capital One', logo: 'capital' },
];

const MOCK_MERCHANTS = [
  { name: 'Spotify', category: 'Entertainment', min: 9, max: 15 },
  { name: 'Netflix', category: 'Entertainment', min: 12, max: 20 },
  { name: 'Amazon', category: 'Shopping', min: 15, max: 200 },
  { name: 'Walmart', category: 'Shopping', min: 20, max: 150 },
  { name: 'Target', category: 'Shopping', min: 10, max: 120 },
  { name: 'Uber', category: 'Travel', min: 8, max: 45 },
  { name: 'Lyft', category: 'Travel', min: 7, max: 40 },
  { name: 'Shell Gas', category: 'Travel', min: 25, max: 65 },
  { name: 'Starbucks', category: 'Food and Drink', min: 4, max: 12 },
  { name: 'Chipotle', category: 'Food and Drink', min: 8, max: 18 },
  { name: 'DoorDash', category: 'Food and Drink', min: 15, max: 50 },
  { name: 'Whole Foods', category: 'Food and Drink', min: 30, max: 120 },
  { name: 'McDonald\'s', category: 'Food and Drink', min: 5, max: 15 },
  { name: 'Electric Company', category: 'Bills', min: 80, max: 200 },
  { name: 'Water Utility', category: 'Bills', min: 30, max: 80 },
  { name: 'Internet Provider', category: 'Bills', min: 50, max: 100 },
  { name: 'Phone Bill', category: 'Bills', min: 40, max: 90 },
  { name: 'Gym Membership', category: 'Health', min: 25, max: 60 },
  { name: 'CVS Pharmacy', category: 'Health', min: 5, max: 50 },
  { name: 'Salary Deposit', category: 'Income', min: -5000, max: -2500 },
  { name: 'Freelance Payment', category: 'Income', min: -2000, max: -500 },
];

// ==================== Token Store ====================

// In-memory store for link tokens and access tokens
const tokenStore = new Map();

// ==================== Simulated Provider ====================

class SimulatedBankingProvider {
  constructor() {
    this.name = 'simulated';
  }

  /**
   * Create a link token for the client to initiate bank connection.
   * In production: plaidClient.linkTokenCreate()
   */
  async createLinkToken(userId) {
    const linkToken = `link-sandbox-${crypto.randomBytes(16).toString('hex')}`;
    const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    tokenStore.set(linkToken, {
      userId,
      createdAt: new Date().toISOString(),
      expiration,
    });

    return {
      linkToken,
      expiration,
      institutions: MOCK_INSTITUTIONS,
    };
  }

  /**
   * Exchange a public token (from client) for an access token.
   * In production: plaidClient.itemPublicTokenExchange()
   * 
   * @param {string} publicToken - The token from client after bank selection
   * @param {string} institutionId - The selected institution (optional)
   */
  async exchangePublicToken(publicToken, institutionId = null) {
    await this._simulateLatency();

    const accessToken = `access-sandbox-${crypto.randomBytes(16).toString('hex')}`;
    const itemId = `item-sandbox-${crypto.randomBytes(8).toString('hex')}`;

    // Pick institution
    const institution = institutionId
      ? MOCK_INSTITUTIONS.find((i) => i.id === institutionId) || MOCK_INSTITUTIONS[0]
      : MOCK_INSTITUTIONS[Math.floor(Math.random() * MOCK_INSTITUTIONS.length)];

    // Generate mock accounts for this institution
    const accounts = this._generateAccounts(institution);

    // Store for later retrieval
    tokenStore.set(accessToken, {
      itemId,
      institution,
      accounts,
      createdAt: new Date().toISOString(),
    });

    return {
      accessToken,
      itemId,
      institution,
      accounts,
    };
  }

  /**
   * Get accounts for a given access token.
   * In production: plaidClient.accountsGet()
   */
  async getAccounts(accessToken) {
    const data = tokenStore.get(accessToken);
    if (!data) {
      return { accounts: this._generateAccounts(MOCK_INSTITUTIONS[0]) };
    }
    return { accounts: data.accounts };
  }

  /**
   * Get current balances for accounts.
   * In production: plaidClient.accountsBalanceGet()
   */
  async getBalances(accessToken, accountId = null) {
    const data = tokenStore.get(accessToken);
    if (!data) return { accounts: [] };

    let accounts = data.accounts;
    if (accountId) {
      accounts = accounts.filter((a) => a.account_id === accountId);
    }

    // Slightly vary balances to simulate real updates
    return {
      accounts: accounts.map((acc) => ({
        ...acc,
        balances: {
          ...acc.balances,
          current: acc.balances.current + (Math.random() * 20 - 10),
        },
      })),
    };
  }

  /**
   * Get transactions for the given access token.
   * In production: plaidClient.transactionsGet()
   */
  async getTransactions(accessToken, { startDate, endDate, count = 50, offset = 0, accountIds = null } = {}) {
    await this._simulateLatency();

    const data = tokenStore.get(accessToken);
    const accounts = data?.accounts || this._generateAccounts(MOCK_INSTITUTIONS[0]);
    
    const targetAccounts = accountIds
      ? accounts.filter((a) => accountIds.includes(a.account_id))
      : accounts;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const transactions = [];

    for (let i = 0; i < count; i++) {
      const merchant = MOCK_MERCHANTS[Math.floor(Math.random() * MOCK_MERCHANTS.length)];
      const account = targetAccounts[Math.floor(Math.random() * targetAccounts.length)];
      const daysRange = Math.floor((end - start) / (24 * 60 * 60 * 1000));
      const randomDays = Math.floor(Math.random() * daysRange);
      const date = new Date(start.getTime() + randomDays * 24 * 60 * 60 * 1000);

      const amount = merchant.min < 0
        ? -(Math.random() * (Math.abs(merchant.max) - Math.abs(merchant.min)) + Math.abs(merchant.min))
        : Math.random() * (merchant.max - merchant.min) + merchant.min;

      transactions.push({
        transaction_id: `txn-${crypto.randomBytes(12).toString('hex')}`,
        account_id: account.account_id,
        name: merchant.name,
        amount: Math.round(amount * 100) / 100,
        date: date.toISOString().split('T')[0],
        category: [merchant.category],
        category_id: merchant.category.toLowerCase().replace(/\s+/g, '_'),
        payment_channel: (() => { const r = Math.random(); return r < 0.40 ? 'online' : r < 0.85 ? 'in store' : 'other'; })(),
        pending: Math.random() > 0.9,
        merchant_name: merchant.name,
        logo_url: null,
      });
    }

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      transactions: transactions.slice(offset, offset + count),
      total_transactions: transactions.length,
    };
  }

  /**
   * Remove a linked item.
   * In production: plaidClient.itemRemove()
   */
  async removeItem(accessToken) {
    tokenStore.delete(accessToken);
    return { removed: true };
  }

  /**
   * Get available institutions for display in the connect flow.
   */
  async getInstitutions() {
    return { institutions: MOCK_INSTITUTIONS };
  }

  // ==================== Internal Helpers ====================

  _generateAccounts(institution) {
    const checkingBalance = 5000 + Math.random() * 20000;
    const savingsBalance = 10000 + Math.random() * 50000;

    return [
      {
        account_id: `acc-${crypto.randomBytes(8).toString('hex')}`,
        name: `${institution.name} Checking`,
        official_name: `${institution.name} Total Checking`,
        type: 'depository',
        subtype: 'checking',
        mask: String(Math.floor(1000 + Math.random() * 9000)),
        balances: {
          current: Math.round(checkingBalance * 100) / 100,
          available: Math.round((checkingBalance - Math.random() * 500) * 100) / 100,
          iso_currency_code: 'USD',
        },
      },
      {
        account_id: `acc-${crypto.randomBytes(8).toString('hex')}`,
        name: `${institution.name} Savings`,
        official_name: `${institution.name} Premium Savings`,
        type: 'depository',
        subtype: 'savings',
        mask: String(Math.floor(1000 + Math.random() * 9000)),
        balances: {
          current: Math.round(savingsBalance * 100) / 100,
          available: Math.round(savingsBalance * 100) / 100,
          iso_currency_code: 'USD',
        },
      },
    ];
  }

  async _simulateLatency() {
    const delay = 100 + Math.random() * 300;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// ==================== Singleton ====================

/**
 * To swap providers, replace SimulatedBankingProvider:
 * 
 * const PlaidProvider = require('./providers/plaid.provider');
 * const bankingService = new PlaidProvider({
 *   clientId: process.env.PLAID_CLIENT_ID,
 *   secret: process.env.PLAID_SECRET,
 *   env: process.env.PLAID_ENV,
 * });
 * 
 * const MonoProvider = require('./providers/mono.provider'); // Africa
 * const bankingService = new MonoProvider(process.env.MONO_SECRET_KEY);
 */
const bankingService = new SimulatedBankingProvider();

module.exports = { bankingService, SimulatedBankingProvider };
