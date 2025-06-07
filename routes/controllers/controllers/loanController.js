const Loan = require('../models/Loan');

exports.applyLoan = async (req, res) => {
  const { amount, term } = req.body;
  try {
    const loan = new Loan({
      userId: req.user.userId,
      amount,
      term,
      status: 'pending',
    });
    await loan.save();
    res.status(201).json({ message: 'Loan application submitted', loan });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ userId: req.user.userId });
    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};