const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // KYC Information
  nationalId: {
    type: String,
    unique: true,
    sparse: true
  },
  dateOfBirth: Date,
  county: String,
  town: String,
  occupation: String,
  monthlyIncome: Number,
  
  // Account Status
  isVerified: {
    type: Boolean,
    default: false
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'closed'],
    default: 'active'
  },
  
  // Credit Information
  creditScore: {
    type: Number,
    default: 500,
    min: 300,
    max: 850
  },
  totalLoans: {
    type: Number,
    default: 0
  },
  activeLoanCount: {
    type: Number,
    default: 0
  },
  defaultedLoans: {
    type: Number,
    default: 0
  },
  
  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['id_front', 'id_back', 'payslip', 'bank_statement']
    },
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    verified: {
      type: Boolean,
      default: false
    }
  }],
  
  // Mobile Money
  mpesaNumber: String,
  airtelNumber: String,
  
  // Referral
  referralCode: {
    type: String,
    unique: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referralCount: {
    type: Number,
    default: 0
  },
  
  // System fields
  role: {
    type: String,
    enum: ['user', 'admin', 'agent'],
    default: 'user'
  },
  lastLogin: Date,
  fcmToken: String, // For push notifications
  
}, {
  timestamps: true
});

// Generate referral code before saving
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.referralCode) {
    this.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.updateCreditScore = function() {
  // Simple credit scoring algorithm
  let score = 500; // Base score
  
  // Positive factors
  if (this.totalLoans > 0) score += this.totalLoans * 10;
  if (this.kycStatus === 'verified') score += 50;
  if (this.monthlyIncome > 20000) score += 30;
  if (this.monthlyIncome > 50000) score += 50;
  
  // Negative factors
  if (this.defaultedLoans > 0) score -= this.defaultedLoans * 100;
  
  // Ensure score is within bounds
  this.creditScore = Math.min(Math.max(score, 300), 850);
  return this.creditScore;
};

userSchema.index({ email: 1, phone: 1 });
userSchema.index({ nationalId: 1 });
userSchema.index({ referralCode: 1 });

module.exports = mongoose.model('User', userSchema);