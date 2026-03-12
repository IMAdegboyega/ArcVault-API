const { prisma } = require('../config/database');
const { paymentService } = require('../services/payment.service');
const { getPagination } = require('../utils/helpers');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require('../utils/errors');

/**
 * POST /api/transfers
 * Create a new transfer between accounts
 */
const createTransfer = async (req, res, next) => {
  try {
    const { senderAccountId, receiverAccountId, email, shareableId, amount, description } = req.body;

    // Verify sender account ownership
    const senderAccount = await prisma.bankAccount.findFirst({
      where: { id: senderAccountId, userId: req.user.id },
    });

    if (!senderAccount) {
      throw new NotFoundError('Sender account not found');
    }

    // Check sufficient balance
    if ((senderAccount.availableBalance || 0) < amount) {
      throw new BadRequestError('Insufficient funds');
    }

    // Find receiver account by ID, shareable ID, or email
    let receiverAccount = null;

    if (receiverAccountId) {
      receiverAccount = await prisma.bankAccount.findUnique({
        where: { id: receiverAccountId },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });
    } else if (shareableId) {
      receiverAccount = await prisma.bankAccount.findUnique({
        where: { shareableId },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });
    } else if (email) {
      const receiverUser = await prisma.user.findUnique({ where: { email } });
      if (receiverUser) {
        receiverAccount = await prisma.bankAccount.findFirst({
          where: { userId: receiverUser.id },
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        });
      }
    }

    if (!receiverAccount) {
      throw new NotFoundError('Receiver account not found. Please check the email or account ID.');
    }

    if (senderAccount.id === receiverAccount.id) {
      throw new BadRequestError('Cannot transfer to the same account');
    }

    // Process through payment service
    const paymentResult = await paymentService.processTransfer({
      amount,
      currency: 'USD',
      senderAccountId: senderAccount.id,
      receiverAccountId: receiverAccount.id,
      description: description || `Transfer to ${receiverAccount.user.email}`,
      metadata: {
        senderUserId: req.user.id,
        receiverUserId: receiverAccount.user.id,
      },
    });

    // If payment provider reports failure
    if (paymentResult.status === 'failed') {
      const failedTransfer = await prisma.transfer.create({
        data: {
          senderUserId: req.user.id,
          senderAccountId: senderAccount.id,
          receiverUserId: receiverAccount.user.id,
          receiverAccountId: receiverAccount.id,
          amount,
          description,
          email: receiverAccount.user.email,
          status: 'FAILED',
          paymentTransferId: paymentResult.transferId,
        },
      });

      return res.status(422).json({
        success: false,
        error: {
          code: 'TRANSFER_FAILED',
          message: 'Transfer could not be processed. Please try again.',
          transferId: failedTransfer.id,
        },
      });
    }

    // Payment succeeded — update balances and create records atomically
    const transfer = await prisma.$transaction(async (tx) => {
      // Create transfer record
      const newTransfer = await tx.transfer.create({
        data: {
          senderUserId: req.user.id,
          senderAccountId: senderAccount.id,
          receiverUserId: receiverAccount.user.id,
          receiverAccountId: receiverAccount.id,
          amount,
          description,
          email: receiverAccount.user.email,
          status: 'COMPLETED',
          paymentTransferId: paymentResult.transferId,
        },
      });

      // Debit sender
      await tx.bankAccount.update({
        where: { id: senderAccount.id },
        data: {
          currentBalance: { decrement: amount },
          availableBalance: { decrement: amount },
        },
      });

      // Credit receiver
      await tx.bankAccount.update({
        where: { id: receiverAccount.id },
        data: {
          currentBalance: { increment: amount },
          availableBalance: { increment: amount },
        },
      });

      // Transaction record: sender side (money out)
      await tx.transaction.create({
        data: {
          bankAccountId: senderAccount.id,
          name: `Transfer to ${receiverAccount.user.firstName} ${receiverAccount.user.lastName}`,
          amount: amount,
          date: new Date(),
          category: 'Transfer',
          channel: 'online',
          pending: false,
        },
      });

      // Transaction record: receiver side (money in)
      await tx.transaction.create({
        data: {
          bankAccountId: receiverAccount.id,
          name: `Transfer from ${req.user.firstName} ${req.user.lastName}`,
          amount: -amount,
          date: new Date(),
          category: 'Transfer',
          channel: 'online',
          pending: false,
        },
      });

      return newTransfer;
    });

    // Return completed transfer with account details
    const completedTransfer = await prisma.transfer.findUnique({
      where: { id: transfer.id },
      include: {
        senderAccount: { select: { name: true, mask: true } },
        receiverAccount: { select: { name: true, mask: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: { transfer: completedTransfer },
      message: `$${amount.toFixed(2)} transferred successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/transfers
 * Get transfer history for the authenticated user
 */
const getTransfers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { skip, take } = getPagination(Number(page), Number(limit));

    const where = {
      OR: [
        { senderUserId: req.user.id },
        { receiverUserId: req.user.id },
      ],
    };

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        include: {
          senderAccount: { select: { name: true, mask: true } },
          receiverAccount: { select: { name: true, mask: true } },
          senderUser: { select: { firstName: true, lastName: true, email: true } },
          receiverUser: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.transfer.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        transfers,
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

/**
 * GET /api/transfers/:id
 * Get a specific transfer
 */
const getTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        senderAccount: { select: { name: true, mask: true } },
        receiverAccount: { select: { name: true, mask: true } },
        senderUser: { select: { firstName: true, lastName: true, email: true } },
        receiverUser: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundError('Transfer not found');
    }

    if (transfer.senderUserId !== req.user.id && transfer.receiverUserId !== req.user.id) {
      throw new ForbiddenError('Access denied');
    }

    res.json({
      success: true,
      data: { transfer },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createTransfer, getTransfers, getTransfer };
