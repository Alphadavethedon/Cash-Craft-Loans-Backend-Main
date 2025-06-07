const jwt = require('jsonwebtoken');
const axios = require('axios');
const express = require('express');
const express = require('express');
const router = express.Router();

// Example Express route handler for initiating STK Push
router.post('/initiate-stk-push', async (req, res) => {
    try {
        const { user, amount, phoneNumber, loanId, timestamp, accessToken } = req.body;
        const MPESA_BASE_URL = process.env.MPESA_BASE_URL;

        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        const email = decoded.email;

        const stkPushData = {
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phoneNumber,
            PartyB: process.env.MPESA_SHORTCODE,
            PhoneNumber: phoneNumber,
            CallBackURL: `${process.env.BASE_URL}/api/mpesa/callback`,
            AccountReference: `Loan Payment ${loanId}`,
            TransactionDesc: `Payment for loan ${loanId}`
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
            message: 'STK Push initiated successfully',
            data: response.data
        });
    } catch (error) {
        console.error('STK Push error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate STK Push',
            error: error.message
        });
    }
});

module.exports = router;

exports.router = router;
