const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  loan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  method: {
    type: String,
    enum: ['mpesa', 'airtel', 'bank', 'cash', 'agent'],
    required: true
  },
  
  // Transaction Details
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  phoneNumber: String,
  reference: String,
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // Dates
  paymentDate: {
    type: Date,
    default: Date.now
  },
  processedDate: Date,
  
  // Fees
  transactionFee: {
    type: Number,
    default: 0
  },
  
  // Processing
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  
  // Mobile Money Response
  mpesaResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Reconciliation
  reconciled: {
    type: Boolean,
    default: false
  },
  reconciledDate: Date
  
}, {
  timestamps: true
});

paymentSchema.index({ loan: 1, paymentDate: -1 });
paymentSchema.index({ user: 1, paymentDate: -1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ status: 1, paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);