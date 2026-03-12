/**
 * ArcVault Payment Service
 * 
 * Simulated payment processing layer with a provider-agnostic interface.
 * Designed to be swappable — replace the SimulatedProvider with a real
 * provider (Stripe, Paystack, Flutterwave, etc.) by implementing the
 * same interface.
 * 
 * Interface methods:
 *   - createCustomer(userData)    → { customerId, status }
 *   - processTransfer(transferData) → { transferId, status, processedAt }
 *   - getTransferStatus(transferId) → { transferId, status, updatedAt }
 *   - refundTransfer(transferId)    → { refundId, status }
 */

const crypto = require('crypto');

// ==================== Simulated Provider ====================

class SimulatedPaymentProvider {
  constructor() {
    this.name = 'simulated';
    this.transfers = new Map();
    this.customers = new Map();
  }

  /**
   * Create a customer record
   * In production: Stripe.customers.create() / Paystack customer creation
   */
  async createCustomer({ email, firstName, lastName }) {
    const customerId = `cus_${crypto.randomBytes(12).toString('hex')}`;

    this.customers.set(customerId, {
      id: customerId,
      email,
      name: `${firstName} ${lastName}`,
      createdAt: new Date().toISOString(),
    });

    return {
      customerId,
      status: 'active',
    };
  }

  /**
   * Process a transfer between accounts
   * In production: Stripe PaymentIntent / Paystack transfer / Flutterwave transfer
   */
  async processTransfer({ amount, currency = 'USD', senderAccountId, receiverAccountId, description, metadata = {} }) {
    // Simulate processing delay (50-200ms)
    await this._simulateLatency();

    const transferId = `txfr_${crypto.randomBytes(12).toString('hex')}`;

    // Simulate random failure rate (5% in dev for testing error handling)
    if (this._shouldSimulateFailure()) {
      const transfer = {
        id: transferId,
        amount,
        currency,
        status: 'failed',
        failureReason: 'Simulated processing failure',
        createdAt: new Date().toISOString(),
      };
      this.transfers.set(transferId, transfer);

      return {
        transferId,
        status: 'failed',
        failureReason: 'Simulated processing failure',
        processedAt: new Date().toISOString(),
      };
    }

    const transfer = {
      id: transferId,
      amount,
      currency,
      senderAccountId,
      receiverAccountId,
      description,
      metadata,
      status: 'completed',
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };

    this.transfers.set(transferId, transfer);

    return {
      transferId,
      status: 'completed',
      processedAt: transfer.processedAt,
    };
  }

  /**
   * Check transfer status
   * In production: Stripe.paymentIntents.retrieve() / Paystack verify transaction
   */
  async getTransferStatus(transferId) {
    const transfer = this.transfers.get(transferId);

    if (!transfer) {
      return {
        transferId,
        status: 'not_found',
        updatedAt: null,
      };
    }

    return {
      transferId: transfer.id,
      status: transfer.status,
      amount: transfer.amount,
      currency: transfer.currency,
      updatedAt: transfer.processedAt || transfer.createdAt,
    };
  }

  /**
   * Refund a transfer
   * In production: Stripe.refunds.create() / Paystack refund
   */
  async refundTransfer(transferId) {
    const transfer = this.transfers.get(transferId);

    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    if (transfer.status !== 'completed') {
      throw new Error(`Cannot refund transfer with status: ${transfer.status}`);
    }

    const refundId = `rfnd_${crypto.randomBytes(12).toString('hex')}`;

    transfer.status = 'refunded';
    transfer.refundId = refundId;
    transfer.refundedAt = new Date().toISOString();
    this.transfers.set(transferId, transfer);

    return {
      refundId,
      transferId,
      status: 'refunded',
      amount: transfer.amount,
    };
  }

  // ==================== Internal Helpers ====================

  async _simulateLatency() {
    const delay = 50 + Math.random() * 150;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  _shouldSimulateFailure() {
    // 5% failure rate for testing error handling
    return Math.random() < 0.05;
  }
}

// ==================== Payment Service Singleton ====================

/**
 * To swap providers, replace SimulatedPaymentProvider with your real provider:
 * 
 * const StripeProvider = require('./providers/stripe.provider');
 * const paymentService = new StripeProvider(process.env.STRIPE_SECRET_KEY);
 * 
 * const PaystackProvider = require('./providers/paystack.provider');
 * const paymentService = new PaystackProvider(process.env.PAYSTACK_SECRET_KEY);
 */
const paymentService = new SimulatedPaymentProvider();

module.exports = { paymentService, SimulatedPaymentProvider };
