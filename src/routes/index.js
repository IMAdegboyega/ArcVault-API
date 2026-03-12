const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const bankingRoutes = require('./banking.routes');
const bankRoutes = require('./bank.routes');
const accountRoutes = require('./account.routes');
const transferRoutes = require('./transfer.routes');

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ArcVault API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/banking', bankingRoutes);
router.use('/banks', bankRoutes);
router.use('/accounts', accountRoutes);
router.use('/transfers', transferRoutes);

module.exports = router;
