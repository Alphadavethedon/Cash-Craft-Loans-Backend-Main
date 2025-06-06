const express = require('express');
const multer = require('multer');
const User = require('../models/User');
const Loan = require('../models/Loan');
const { auth } = require('../middleware/auth');
const { validateRequest, kycSchema } = require('../middleware/validation');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('referredBy', 'firstName lastName');
    
    // Get loan statistics
    const loanStats = await Loan.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalBorrowed: { $sum: '$amount' },
          totalRepaid: { $sum: '$totalPaid' },
          activeLoans: {
            $sum: {
              $cond: [
                { $in: ['$status', ['approved', 'disbursed', 'active']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    const stats = loanStats[0] || {
      totalBorrowed: 0,
      totalRepaid: 0,
      activeLoans: 0
    };
    
    res.json({
      success: true,
      user,
      loanStats: stats
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const allowedUpdates = ['firstName', 'lastName', 'county', 'town', 'occupation', 'monthlyIncome'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/users/kyc
// @desc    Submit KYC information
// @access  Private
router.post('/kyc', auth, validateRequest(kycSchema), async (req, res) => {
  try {
    const {
      nationalId,
      dateOfBirth,
      county,
      town,
      occupation,
      monthlyIncome,
      mpesaNumber,
      airtelNumber
    } = req.body;
    
    // Check if national ID is already used
    const existingUser = await User.findOne({
      nationalId,
      _id: { $ne: req.user._id }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'National ID is already registered'
      });
    }
    
    // Update user with KYC information
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        nationalId,
        dateOfBirth,
        county,
        town,
        occupation,
        monthlyIncome,
        mpesaNumber,
        airtelNumber,
        kycStatus: 'pending'
      },
      { new: true, runValidators: true }
    ).select('-password');
    
    // Update credit score
    user.updateCreditScore();
    await user.save();
    
    res.json({
      success: true,
      message: 'KYC information submitted successfully. Verification in progress.',
      user
    });
  } catch (error) {
    console.error('KYC submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during KYC submission'
    });
  }
});

// @route   POST /api/users/documents
// @desc    Upload KYC documents
// @access  Private
router.post('/documents', auth, upload.array('documents', 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    const user = await User.findById(req.user._id);
    const documents = [];
    
    // Process each uploaded file
    for (const file of req.files) {
      const { fieldname, mimetype, buffer } = file;
      
      // In production, upload to cloud storage (AWS S3, Cloudinary, etc.)
      // For now, we'll simulate this
      const documentUrl = `https://storage.example.com/documents/${req.user._id}/${Date.now()}-${fieldname}`;
      
      documents.push({
        type: fieldname,
        url: documentUrl,
        uploadedAt: new Date(),
        verified: false
      });
    }
    
    // Add documents to user
    user.documents.push(...documents);
    await user.save();
    
    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      documents
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during document upload'
    });
  }
});

// @route   GET /api/users/referrals
// @desc    Get user's referral information
// @access  Private
router.get('/referrals', auth, async (req, res) => {
  try {
    const referrals = await User.find({ referredBy: req.user._id })
      .select('firstName lastName email createdAt')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      referralCode: req.user.referralCode,
      referralCount: req.user.referralCount,
      referrals
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Deactivate user account
// @access  Private
router.delete('/account', auth, async (req, res) => {
  try {
    // Check if user has active loans
    const activeLoans = await Loan.countDocuments({
      user: req.user._id,
      status: { $in: ['approved', 'disbursed', 'active'] }
    });
    
    if (activeLoans > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate account with active loans'
      });
    }
    
    // Deactivate account
    await User.findByIdAndUpdate(req.user._id, {
      accountStatus: 'closed'
    });
    
    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;