const express = require('express');
const router = express.Router();
const { createTransfer, getTransfers, getTransfer } = require('../controllers/transfer.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { transferSchema } = require('../utils/validators');

router.use(authenticate);

router.post('/', validate(transferSchema), createTransfer);
router.get('/', getTransfers);
router.get('/:id', getTransfer);

module.exports = router;
