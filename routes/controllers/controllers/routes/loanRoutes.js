const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const auth = require('../middleware/auth');

router.post('/apply', auth, loanController.applyLoan);
router.get('/', auth, loanController.getLoans);

module.exports = router;