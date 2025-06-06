const axios = require('axios');

class SMSService {
  constructor() {
    this.apiKey = process.env.SMS_API_KEY;
    this.username = process.env.SMS_USERNAME;
    this.baseUrl = 'https://api.africastalking.com/version1/messaging';
  }

  async sendSMS(phoneNumber, message) {
    try {
      if (!this.apiKey || !this.username) {
        console.log('SMS not configured, would send:', message);
        return { success: true, simulated: true };
      }

      const payload = {
        username: this.username,
        to: phoneNumber,
        message: message,
        from: 'CashCraft'
      };

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'apiKey': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('SMS sending error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Predefined message templates
  async sendLoanApprovalSMS(phoneNumber, amount, firstName) {
    const message = `Hello ${firstName}, your loan application for KES ${amount.toLocaleString()} has been approved! Funds will be disbursed shortly. - CashCraft Loans`;
    return this.sendSMS(phoneNumber, message);
  }

  async sendLoanRejectionSMS(phoneNumber, firstName, reason) {
    const message = `Hello ${firstName}, your loan application has been rejected. Reason: ${reason}. You can reapply after addressing the issues. - CashCraft Loans`;
    return this.sendSMS(phoneNumber, message);
  }

  async sendLoanDisbursementSMS(phoneNumber, amount, firstName) {
    const message = `Hello ${firstName}, KES ${amount.toLocaleString()} has been disbursed to your M-Pesa account. Thank you for choosing CashCraft Loans!`;
    return this.sendSMS(phoneNumber, message);
  }

  async sendPaymentConfirmationSMS(phoneNumber, amount, balance, firstName) {
    const message = `Hello ${firstName}, we have received your payment of KES ${amount.toLocaleString()}. Remaining balance: KES ${balance.toLocaleString()}. Thank you! - CashCraft Loans`;
    return this.sendSMS(phoneNumber, message);
  }

  async sendPaymentReminderSMS(phoneNumber, amount, dueDate, firstName) {
    const message = `Hello ${firstName}, your loan payment of KES ${amount.toLocaleString()} is due on ${dueDate}. Please pay via M-Pesa to avoid penalties. - CashCraft Loans`;
    return this.sendSMS(phoneNumber, message);
  }

  async sendWelcomeSMS(phoneNumber, firstName, referralCode) {
    const message = `Welcome to CashCraft Loans, ${firstName}! Complete your KYC to access loans up to KES 100,000. Your referral code: ${referralCode}. Share and earn!`;
    return this.sendSMS(phoneNumber, message);
  }
}

module.exports = new SMSService();