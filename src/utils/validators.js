const { z } = require('zod');

// ==================== Auth Schemas ====================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  address1: z.string().min(1, 'Address is required').optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  postalCode: z.string().optional(),
  dateOfBirth: z.string().optional(), // YYYY-MM-DD
  ssn: z.string().min(4).max(11).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ==================== Transfer Schemas ====================

const transferSchema = z.object({
  senderAccountId: z.string().uuid('Invalid sender account ID'),
  receiverAccountId: z.string().uuid('Invalid receiver account ID').optional(),
  email: z.string().email('Invalid email').optional(),
  shareableId: z.string().optional(),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(50000, 'Maximum transfer amount is $50,000'),
  description: z.string().max(255).optional(),
});

// ==================== Banking Schemas ====================

const exchangeTokenSchema = z.object({
  publicToken: z.string().min(1, 'Public token is required'),
});

// ==================== Query Schemas ====================

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const transactionQuerySchema = paginationSchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  category: z.string().optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  transferSchema,
  exchangeTokenSchema,
  paginationSchema,
  transactionQuerySchema,
};
