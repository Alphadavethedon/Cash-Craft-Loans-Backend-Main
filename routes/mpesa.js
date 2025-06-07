const express = require('express');
const axios = require('axios');
const Payment = require('../models/Payment');
const Loan = require('../models/Loan');
const User = require('../models/User');

const router = express.Router();

// M-Pesa configuration
const MPESA_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.safaricom.co.ke' 
  : 'https://sandbox.safaricom.co.ke';

  
// Generate M-Pesa access token
const generateAccessToken = async () => {
  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');
    
    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('M-Pesa token generation error:', error);
    throw new Error('Failed to generate M-Pesa access token');
  }
};

// Generate M-Pesa password
const generatePassword = () => {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(
    process.env.MPESA_SHORTCODE + process.env.MPESA_PASSKEY + timestamp
  ).toString('base64');
  
  return { password, timestamp };
};

// @route   POST /api/mpesa/stk-push
// @desc    Initiate M-Pesa STK Push
// @access  Internal (called from payment route)
router.post('/stk-push', async (req, res) => {
  try {
    const { phoneNumber, amount, loanId, paymentId } = req.body;
    
    const accessToken = await generateAccessToken();
    const { password, timestamp } = generatePassword();
    
    const stkPushData = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: `${process.env.MPESA_CALLBACK_URL}/${paymentId}`,
      AccountReference: `LOAN_${loanId}`,
      TransactionDesc: 'Loan Repayment'
    };
    
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      stkPushData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('STK Push error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate M-Pesa payment'
    });
  }
});

// @route   POST /api/mpesa/callback/:paymentId
// @desc    M-Pesa callback handler
// @access  Public (M-Pesa callback)
router.post('/callback/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const callbackData = req.body;
    
    console.log('M-Pesa Callback:', JSON.stringify(callbackData, null, 2));
    
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Update payment with callback data
    payment.mpesaResponse = callbackData;
    
    // Check if payment was successful
    if (callbackData.Body?.stkCallback?.ResultCode === 0) {
      // Payment successful
      payment.status = 'completed';
      payment.processedDate = new Date();
      
      // Extract transaction details
      const callbackMetadata = callbackData.Body.stkCallback.CallbackMetadata?.Item || [];
      const transactionId = callbackMetadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      
      if (transactionId) {
        payment.transactionId = transactionId;
      }
      
      await payment.save();
      
      // Update loan
      const loan = await Loan.findById(payment.loan);
      loan.totalPaid += payment.amount;
      loan.lastPaymentDate = new Date();
      
      // Calculate next payment date
      const nextPayment = new Date();
      nextPayment.setDate(nextPayment.getDate() + 1);
      loan.nextPaymentDate = nextPayment;
      
      // Check if loan is fully paid
      if (loan.totalPaid >= loan.totalAmount) {
        loan.status = 'completed';
        loan.completionDate = new Date();
        
        // Update user stats
        const user = await User.findById(loan.user);
        user.activeLoanCount = Math.max(0, user.activeLoanCount - 1);
        user.creditScore += 20; // Bonus for completing loan
        await user.save();
      }
      
      await loan.save();
      
      // TODO: Send SMS confirmation to user
      console.log(`Payment of KES ${payment.amount} received for loan ${loan._id}`);
      
    } else {
      // Payment failed
      payment.status = 'failed';
      await payment.save();
      
      console.log(`Payment failed for payment ${paymentId}: ${callbackData.Body?.stkCallback?.ResultDesc}`);
    }
    
    res.json({
      success: true,
      message: 'Callback processed successfully'
    });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Callback processing failed'
    });
  }
});

// @route   POST /api/mpesa/b2c
// @desc    M-Pesa B2C (Business to Customer) - for loan disbursement
// @access  Internal
router.post('/b2c', async (req, res) => {
  try {
    const { phoneNumber, amount, loanId, remarks } = req.body;
    
    const accessToken = await generateAccessToken();
    
    const b2cData = {
      InitiatorName: process.env.MPESA_INITIATOR_NAME,
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
      CommandID: 'BusinessPayment',
      Amount: amount,
      PartyA: process.env.MPESA_SHORTCODE,
      PartyB: phoneNumber,
      Remarks: remarks || 'Loan Disbursement',
      QueueTimeOutURL: `${process.env.MPESA_CALLBACK_URL}/b2c/timeout`,
      ResultURL: `${process.env.MPESA_CALLBACK_URL}/b2c/result/${loanId}`,
      Occasion: `Loan Disbursement - ${loanId}`
    };
    
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/b2c/v1/paymentrequest`,
      b2cData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('B2C disbursement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disburse loan via M-Pesa'
    });
  }
});

// @route   POST /api/mpesa/b2c/result/:loanId
// @desc    M-Pesa B2C result callback
// @access  Public (M-Pesa callback)
router.post('/b2c/result/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    const resultData = req.body;
    
    console.log('B2C Result:', JSON.stringify(resultData, null, 2));
    
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }
    
    // Check if disbursement was successful
    if (resultData.Result?.ResultCode === 0) {
      // Disbursement successful
      loan.status = 'active';
      loan.disbursementDate = new Date();
      
      // Update user stats
      const user = await User.findById(loan.user);
      user.activeLoanCount += 1;
      await user.save();
      
      await loan.save();
      
      console.log(`Loan ${loanId} disbursed successfully`);
    } else {
      // Disbursement failed
      loan.status = 'approved'; // Revert to approved status
      await loan.save();
      
      console.log(`Loan disbursement failed for ${loanId}: ${resultData.Result?.ResultDesc}`);
    }
    
    res.json({
      success: true,
      message: 'B2C result processed successfully'
    });
  } catch (error) {
    console.error('B2C result callback error:', error);
    res.status(500).json({
      success: false,
      message: 'B2C result processing failed'
    });
  }
});

module.exports = router;
