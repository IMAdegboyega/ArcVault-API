const express = require('express');
const router = express.Router();
const { getBanks, getBank, deleteBank, syncBank } = require('../controllers/bank.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getBanks);
router.get('/:id', getBank);
router.delete('/:id', deleteBank);
router.post('/:id/sync', syncBank);

module.exports = router;
