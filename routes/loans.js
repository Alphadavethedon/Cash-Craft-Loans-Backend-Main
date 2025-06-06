const express = require('express');
const Loan = require('../models/Loan');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { validateRequest, loanApplicationSchema } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/loans/apply
// @desc    Apply for a loan
// @access  Private
router.post('/apply', auth, validateRequest(loanApplicationSchema), async (req, res) => {
  try {
    const { amount, term, purpose, disbursementMethod, disbursementPhone } = req.body;
    
    // Check if user has KYC completed
    if (req.user.kycStatus !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Please complete KYC verification before applying for a loan'
      });
    }
    
    // Check if user has active loans
    const activeLoan = await Loan.findOne({
      user: req.user._id,
      status: { $in: ['approved', 'disbursed', 'active'] }
    });
    
    if (activeLoan) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active loan. Please repay before applying for a new loan.'
      });
    }
    
    // Check loan limit
    const loanLimit = await Loan.getUserLoanLimit(req.user._id);
    if (amount > loanLimit) {
      return res.status(400).json({
        success: false,
        message: `Loan amount exceeds your limit of KES ${loanLimit.toLocaleString()}`
      });
    }
    
    // Create loan application
    const loan = new Loan({
      user: req.user._id,
      amount,
      term,
      purpose,
      disbursementMethod,
      disbursementPhone,
      creditScoreAtApplication: req.user.creditScore
    });
    
    await loan.save();
    
    // Update user stats
    req.user.totalLoans += 1;
    await req.user.save();
    
    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully',
      loan: {
        id: loan._id,
        amount: loan.amount,
        term: loan.term,
        totalAmount: loan.totalAmount,
        status: loan.status,
        applicationDate: loan.applicationDate
      }
    });
  } catch (error) {
    console.error('Loan application error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during loan application'
    });
  }
});

// @route   GET /api/loans/my-loans
// @desc    Get user's loans
// @access  Private
router.get('/my-loans', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const loans = await Loan.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('approvedBy', 'firstName lastName');
    
    const total = await Loan.countDocuments({ user: req.user._id });
    
    res.json({
      success: true,
      loans,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalLoans: total
      }
    });
  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/loans/:id
// @desc    Get loan details
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const loan = await Loan.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('approvedBy', 'firstName lastName');
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }
    
    res.json({
      success: true,
      loan
    });
  } catch (error) {
    console.error('Get loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/loans/limit/check
// @desc    Check user's loan limit
// @access  Private
router.get('/limit/check', auth, async (req, res) => {
  try {
    const loanLimit = await Loan.getUserLoanLimit(req.user._id);
    
    res.json({
      success: true,
      loanLimit,
      creditScore: req.user.creditScore,
      kycStatus: req.user.kycStatus
    });
  } catch (error) {
    console.error('Check limit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/loans/:id/extend
// @desc    Request loan extension
// @access  Private
router.post('/:id/extend', auth, async (req, res) => {
  try {
    const { reason, extensionDays } = req.body;
    
    const loan = await Loan.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'active'
    });
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Active loan not found'
      });
    }
    
    // Check if extension is allowed (max 2 extensions)
    if (loan.extensions.length >= 2) {
      return res.status(400).json({
        success: false,
        message: 'Maximum number of extensions reached'
      });
    }
    
    // Calculate extension fee (5% of remaining amount)
    const extensionFee = Math.floor((loan.totalAmount - loan.totalPaid) * 0.05);
    const previousDueDate = loan.dueDate;
    const newDueDate = new Date(loan.dueDate);
    newDueDate.setDate(newDueDate.getDate() + (extensionDays || 7));
    
    // Add extension
    loan.extensions.push({
      extensionDate: new Date(),
      previousDueDate,
      newDueDate,
      extensionFee,
      reason
    });
    
    loan.dueDate = newDueDate;
    loan.totalAmount += extensionFee;
    
    await loan.save();
    
    res.json({
      success: true,
      message: 'Loan extension requested successfully',
      extensionFee,
      newDueDate
    });
  } catch (error) {
    console.error('Loan extension error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;