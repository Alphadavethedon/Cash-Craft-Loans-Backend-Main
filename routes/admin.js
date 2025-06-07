const express = require('express');
const Loan = require('../models/Loan');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { auth, adminAuth, agentAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    // Get various statistics
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ kycStatus: 'verified' });
    const activeLoans = await Loan.countDocuments({ status: 'active' });
    const pendingLoans = await Loan.countDocuments({ status: 'pending' });
    const completedLoans = await Loan.countDocuments({ status: 'completed' });
    const defaultedLoans = await Loan.countDocuments({ status: 'defaulted' });
    
    // Financial statistics
    const loanStats = await Loan.aggregate([
      {
        $group: {
          _id: null,
          totalDisbursed: {
            $sum: {
              $cond: [
                { $in: ['$status', ['disbursed', 'active', 'completed']] },
                '$amount',
                0
              ]
            }
          },
          totalOutstanding: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'active'] },
                { $subtract: ['$totalAmount', '$totalPaid'] },
                0
              ]
            }
          },
          totalCollected: { $sum: '$totalPaid' }
        }
      }
    ]);
    
    const financials = loanStats[0] || {
      totalDisbursed: 0,
      totalOutstanding: 0,
      totalCollected: 0
    };
    
    // Recent activities
    const recentLoans = await Loan.find()
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(10);
    
    const recentPayments = await Payment.find({ status: 'completed' })
      .populate('user', 'firstName lastName')
      .populate('loan', 'amount')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      dashboard: {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          verificationRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : 0
        },
        loans: {
          active: activeLoans,
          pending: pendingLoans,
          completed: completedLoans,
          defaulted: defaultedLoans,
          total: activeLoans + pendingLoans + completedLoans + defaultedLoans
        },
        financials,
        recentLoans,
        recentPayments
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/loans
// @desc    Get all loans with filters
// @access  Private (Admin/Agent)
router.get('/loans', auth, agentAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, search } = req.query;
    
    // Build query
    const query = {};
    if (status) query.status = status;
    
    let loans;
    let total;
    
    if (search) {
      // Search by user name or email
      const users = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(user => user._id);
      query.user = { $in: userIds };
      
      loans = await Loan.find(query)
        .populate('user', 'firstName lastName email phone')
        .populate('approvedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      total = await Loan.countDocuments(query);
    } else {
      loans = await Loan.find(query)
        .populate('user', 'firstName lastName email phone')
        .populate('approvedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      total = await Loan.countDocuments(query);
    }
    
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
    console.error('Get admin loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/loans/:id/approve
// @desc    Approve a loan
// @access  Private (Admin/Agent)
router.put('/loans/:id/approve', auth, agentAuth, async (req, res) => {
  try {
    const { approvalNotes } = req.body;
    
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }
    
    if (loan.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending loans can be approved'
      });
    }
    
    // Update loan
    loan.status = 'approved';
    loan.approvalDate = new Date();
    loan.approvedBy = req.user._id;
    loan.approvalNotes = approvalNotes;
    
    await loan.save();
    
    // Update user credit score
    const user = await User.findById(loan.user);
    user.creditScore += 5; // Small bonus for loan approval
    await user.save();
    
    res.json({
      success: true,
      message: 'Loan approved successfully',
      loan
    });
  } catch (error) {
    console.error('Approve loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/loans/:id/reject
// @desc    Reject a loan
// @access  Private (Admin/Agent)
router.put('/loans/:id/reject', auth, agentAuth, async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }
    
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }
    
    if (loan.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending loans can be rejected'
      });
    }
    
    // Update loan
    loan.status = 'rejected';
    loan.rejectionReason = rejectionReason;
    loan.approvedBy = req.user._id;
    
    await loan.save();
    
    res.json({
      success: true,
      message: 'Loan rejected successfully',
      loan
    });
  } catch (error) {
    console.error('Reject loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin)
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, kycStatus } = req.query;
    
    // Build query
    const query = {};
    if (kycStatus) query.kycStatus = kycStatus;
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total
      }
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/users/:id/kyc-status
// @desc    Update user KYC status
// @access  Private (Admin)
router.put('/users/:id/kyc-status', auth, adminAuth, async (req, res) => {
  try {
    const { kycStatus } = req.body;
    
    if (!['pending', 'verified', 'rejected'].includes(kycStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid KYC status'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { kycStatus },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update credit score if verified
    if (kycStatus === 'verified') {
      user.creditScore += 50;
      await user.save();
    }
    
    res.json({
      success: true,
      message: 'KYC status updated successfully',
      user
    });
  } catch (error) {
    console.error('Update KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;