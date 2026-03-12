const express = require('express');
const router = express.Router();
const { createLinkToken, connectBank, getInstitutions } = require('../controllers/banking.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/create-link-token', createLinkToken);
router.post('/connect', connectBank);
router.get('/institutions', getInstitutions);

module.exports = router;
