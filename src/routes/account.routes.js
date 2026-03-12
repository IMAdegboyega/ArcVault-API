const express = require('express');
const router = express.Router();
const { getAccounts, getAccount, getAccountTransactions } = require('../controllers/account.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getAccounts);
router.get('/:id', getAccount);
router.get('/:id/transactions', getAccountTransactions);

module.exports = router;
