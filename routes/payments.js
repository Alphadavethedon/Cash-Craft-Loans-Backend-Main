const express = require('express');
const Payment = require('../models/Payment');
const Loan = require('../models/Loan');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { validateRequest, paymentSchema } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/payments/initiate
// @desc    Initiate a payment
// @access  Private
router.post('/initiate', auth, validateRequest(paymentSchema), async (req, res) => {
  try {
    const { loanId, amount, method, phoneNumber } = req.body;
    
    // Get loan details
    const loan = await Loan.findOne({
      _id: loanId,
      user: req.user._id,
      status: 'active'
    });
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Active loan not found'
      });
    }
    
    // Calculate remaining balance
    const remainingBalance = loan.totalAmount - loan.totalPaid;
    
    if (amount > remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Payment amount exceeds remaining balance of KES ${remainingBalance}`
      });
    }
    
    // Create payment record
    const payment = new Payment({
      loan: loanId,
      user: req.user._id,
      amount,
      method,
      phoneNumber,
      status: 'pending'
    });
    
    await payment.save();
    
    // For M-Pesa, initiate STK push (simulated)
    if (method === 'mpesa') {
      // In production, integrate with M-Pesa API
      // This is a simulation
      const mpesaResponse = {
        MerchantRequestID: '12345-67890-12345',
        CheckoutRequestID: 'ws_CO_123456789',
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        CustomerMessage: 'Success. Request accepted for processing'
      };
      
      payment.transactionId = mpesaResponse.CheckoutRequestID;
      payment.mpesaResponse = mpesaResponse;
      await payment.save();
    }
    
    res.json({
      success: true,
      message: 'Payment initiated successfully',
      payment: {
        id: payment._id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        transactionId: payment.transactionId
      }
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during payment initiation'
    });
  }
});

// @route   GET /api/payments/history
// @desc    Get user's payment history
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const payments = await Payment.find({ user: req.user._id })
      .populate('loan', 'amount totalAmount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Payment.countDocuments({ user: req.user._id });
    
    res.json({
      success: true,
      payments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalPayments: total
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/:id/status
// @desc    Check payment status
// @access  Private
router.get('/:id/status', auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('loan', 'amount totalAmount totalPaid');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/:id/confirm
// @desc    Manually confirm a payment (for cash/bank payments)
// @access  Private
router.post('/:id/confirm', auth, async (req, res) => {
  try {
    const { reference, notes } = req.body;
    
    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'pending'
    });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pending payment not found'
      });
    }
    
    // Update payment
    payment.reference = reference;
    payment.notes = notes;
    payment.status = 'completed';
    payment.processedDate = new Date();
    await payment.save();
    
    // Update loan
    const loan = await Loan.findById(payment.loan);
    loan.totalPaid += payment.amount;
    loan.lastPaymentDate = new Date();
    
    // Check if loan is fully paid
    if (loan.totalPaid >= loan.totalAmount) {
      loan.status = 'completed';
      loan.completionDate = new Date();
      
      // Update user stats
      const user = await User.findById(req.user._id);
      user.activeLoanCount = Math.max(0, user.activeLoanCount - 1);
      user.creditScore += 20; // Bonus for completing loan
      await user.save();
    }
    
    await loan.save();
    
    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      payment,
      loanStatus: loan.status
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;