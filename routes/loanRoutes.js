const express = require('express');
const router = express.Router();

// Apply for a loan
router.post('/apply', async (req, res) => {
  try {
    const { userId, amount, term } = req.body;
    // Save loan application to MongoDB
    const loan = new Loan({ userId, amount, term, status: 'pending' });
    await loan.save();
    res.status(201).json({ message: 'Loan application submitted', loan });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;