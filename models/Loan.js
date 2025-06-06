const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Loan Details
  amount: {
    type: Number,
    required: true,
    min: 500,
    max: 500000
  },
  interestRate: {
    type: Number,
    required: true,
    default: 15 // 15% per month
  },
  term: {
    type: Number,
    required: true,
    min: 7,
    max: 365 // days
  },
  purpose: {
    type: String,
    enum: ['business', 'emergency', 'education', 'medical', 'personal', 'other'],
    required: true
  },
  
  // Calculated Fields
  totalAmount: Number, // Principal + Interest
  dailyAmount: Number, // For daily repayment
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'disbursed', 'active', 'completed', 'defaulted'],
    default: 'pending'
  },
  
  // Dates
  applicationDate: {
    type: Date,
    default: Date.now
  },
  approvalDate: Date,
  disbursementDate: Date,
  dueDate: Date,
  completionDate: Date,
  
  // Payment Information
  disbursementMethod: {
    type: String,
    enum: ['mpesa', 'airtel', 'bank'],
    default: 'mpesa'
  },
  disbursementPhone: String,
  repaymentMethod: {
    type: String,
    enum: ['mpesa', 'airtel', 'bank', 'cash'],
    default: 'mpesa'
  },
  
  // Approval/Rejection
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: String,
  approvalNotes: String,
  
  // Risk Assessment
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  creditScoreAtApplication: Number,
  
  // Payment Tracking
  totalPaid: {
    type: Number,
    default: 0
  },
  lastPaymentDate: Date,
  nextPaymentDate: Date,
  missedPayments: {
    type: Number,
    default: 0
  },
  
  // Extensions
  extensions: [{
    extensionDate: Date,
    previousDueDate: Date,
    newDueDate: Date,
    extensionFee: Number,
    reason: String
  }],
  
  // Collection
  collectionAttempts: {
    type: Number,
    default: 0
  },
  collectionNotes: [String]
  
}, {
  timestamps: true
});

// Calculate total amount before saving
loanSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('interestRate') || this.isModified('term')) {
    const interest = (this.amount * this.interestRate * this.term) / (100 * 30);
    this.totalAmount = this.amount + interest;
    this.dailyAmount = this.totalAmount / this.term;
  }
  
  // Set due date
  if (this.isModified('disbursementDate') && this.disbursementDate) {
    this.dueDate = new Date(this.disbursementDate);
    this.dueDate.setDate(this.dueDate.getDate() + this.term);
    this.nextPaymentDate = new Date(this.disbursementDate);
    this.nextPaymentDate.setDate(this.nextPaymentDate.getDate() + 1);
  }
  
  next();
});

// Static methods
loanSchema.statics.getUserLoanLimit = async function(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) return 0;
  
  // Base limit calculation
  let limit = 5000; // Base limit KES 5,000
  
  // Increase limit based on credit score
  if (user.creditScore > 600) limit = 10000;
  if (user.creditScore > 700) limit = 25000;
  if (user.creditScore > 750) limit = 50000;
  if (user.creditScore > 800) limit = 100000;
  
  // Reduce limit if user has active loans
  if (user.activeLoanCount > 0) {
    limit = Math.floor(limit * 0.5);
  }
  
  // KYC bonus
  if (user.kycStatus === 'verified') {
    limit = Math.floor(limit * 1.2);
  }
  
  return limit;
};

loanSchema.index({ user: 1, status: 1 });
loanSchema.index({ status: 1, dueDate: 1 });
loanSchema.index({ disbursementDate: 1 });

module.exports = mongoose.model('Loan', loanSchema);