const User = require('../models/User');
const Loan = require('../models/Loan');
const Payment = require('../models/Payment');

class CreditScoringService {
  
  // Calculate comprehensive credit score
  static async calculateCreditScore(userId) {
    try {
      const user = await User.findById(userId);
      const loans = await Loan.find({ user: userId });
      const payments = await Payment.find({ user: userId, status: 'completed' });
      
      let score = 500; // Base score
      
      // 1. KYC Verification (10% weight)
      if (user.kycStatus === 'verified') {
        score += 50;
      }
      
      // 2. Income Level (15% weight)
      if (user.monthlyIncome) {
        if (user.monthlyIncome >= 100000) score += 60;
        else if (user.monthlyIncome >= 50000) score += 40;
        else if (user.monthlyIncome >= 20000) score += 20;
        else if (user.monthlyIncome >= 10000) score += 10;
      }
      
      // 3. Loan History (40% weight)
      const completedLoans = loans.filter(loan => loan.status === 'completed');
      const defaultedLoans = loans.filter(loan => loan.status === 'defaulted');
      const activeLoans = loans.filter(loan => loan.status === 'active');
      
      // Positive factors
      score += completedLoans.length * 15; // Completed loans boost score
      
      // Payment history
      const totalPayments = payments.length;
      if (totalPayments > 0) {
        score += Math.min(totalPayments * 2, 40); // Up to 40 points for payment history
      }
      
      // Negative factors
      score -= defaultedLoans.length * 100; // Heavy penalty for defaults
      score -= user.missedPayments * 10; // Penalty for missed payments
      
      // 4. Account Age (10% weight)
      const accountAge = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24); // days
      if (accountAge > 365) score += 30;
      else if (accountAge > 180) score += 20;
      else if (accountAge > 90) score += 10;
      
      // 5. Activity and Engagement (10% weight)
      if (user.referralCount > 0) {
        score += Math.min(user.referralCount * 5, 25);
      }
      
      // 6. Current Debt-to-Income (15% weight)
      if (user.monthlyIncome && activeLoans.length > 0) {
        const totalActiveDebt = activeLoans.reduce((sum, loan) => {
          return sum + (loan.totalAmount - loan.totalPaid);
        }, 0);
        
        const monthlyDebtRatio = totalActiveDebt / user.monthlyIncome;
        
        if (monthlyDebtRatio < 0.3) score += 30;
        else if (monthlyDebtRatio < 0.5) score += 15;
        else if (monthlyDebtRatio < 0.7) score += 5;
        else score -= 20; // High debt ratio penalty
      }
      
      // Ensure score is within bounds
      score = Math.min(Math.max(score, 300), 850);
      
      return Math.round(score);
    } catch (error) {
      console.error('Credit scoring error:', error);
      return 500; // Default score on error
    }
  }
  
  // Determine loan eligibility and limit
  static async getLoanEligibility(userId) {
    try {
      const creditScore = await this.calculateCreditScore(userId);
      const user = await User.findById(userId);
      
      // Base eligibility
      if (creditScore < 400) {
        return {
          eligible: false,
          reason: 'Credit score too low',
          maxAmount: 0,
          suggestedAction: 'Complete KYC and build payment history'
        };
      }
      
      if (user.kycStatus !== 'verified') {
        return {
          eligible: false,
          reason: 'KYC not verified',
          maxAmount: 0,
          suggestedAction: 'Complete KYC verification'
        };
      }
      
      // Check for active loans
      const activeLoans = await Loan.countDocuments({
        user: userId,
        status: { $in: ['approved', 'disbursed', 'active'] }
      });
      
      if (activeLoans > 0) {
        return {
          eligible: false,
          reason: 'Active loan exists',
          maxAmount: 0,
          suggestedAction: 'Complete current loan repayment'
        };
      }
      
      // Calculate loan limit based on credit score
      let maxAmount = 5000; // Base limit
      
      if (creditScore >= 750) maxAmount = 100000;
      else if (creditScore >= 700) maxAmount = 50000;
      else if (creditScore >= 650) maxAmount = 25000;
      else if (creditScore >= 600) maxAmount = 15000;
      else if (creditScore >= 550) maxAmount = 10000;
      else if (creditScore >= 500) maxAmount = 7500;
      
      // Adjust based on income
      if (user.monthlyIncome) {
        const incomeBasedLimit = user.monthlyIncome * 0.5; // Max 50% of monthly income
        maxAmount = Math.min(maxAmount, incomeBasedLimit);
      }
      
      return {
        eligible: true,
        creditScore,
        maxAmount: Math.round(maxAmount),
        recommendedAmount: Math.round(maxAmount * 0.7), // 70% of max as recommended
        interestRate: this.calculateInterestRate(creditScore),
        maxTerm: this.calculateMaxTerm(creditScore)
      };
    } catch (error) {
      console.error('Loan eligibility error:', error);
      return {
        eligible: false,
        reason: 'System error',
        maxAmount: 0
      };
    }
  }
  
  // Calculate interest rate based on credit score
  static calculateInterestRate(creditScore) {
    if (creditScore >= 750) return 8;  // 8% per month for excellent credit
    if (creditScore >= 700) return 10; // 10% per month for good credit
    if (creditScore >= 650) return 12; // 12% per month for fair credit
    if (creditScore >= 600) return 15; // 15% per month for poor credit
    return 18; // 18% per month for very poor credit
  }
  
  // Calculate maximum loan term based on credit score
  static calculateMaxTerm(creditScore) {
    if (creditScore >= 750) return 90;  // 3 months max
    if (creditScore >= 700) return 60;  // 2 months max
    if (creditScore >= 650) return 45;  // 1.5 months max
    if (creditScore >= 600) return 30;  // 1 month max
    return 14; // 2 weeks max for poor credit
  }
  
  // Risk assessment
  static async assessRisk(userId, loanAmount) {
    try {
      const eligibility = await this.getLoanEligibility(userId);
      
      if (!eligibility.eligible) {
        return { riskLevel: 'high', score: 0 };
      }
      
      const riskScore = eligibility.creditScore;
      const amountRatio = loanAmount / eligibility.maxAmount;
      
      let riskLevel = 'medium';
      
      if (riskScore >= 700 && amountRatio <= 0.5) {
        riskLevel = 'low';
      } else if (riskScore < 550 || amountRatio > 0.8) {
        riskLevel = 'high';
      }
      
      return {
        riskLevel,
        score: riskScore,
        factors: {
          creditScore: riskScore,
          amountRatio: Math.round(amountRatio * 100),
          maxAmount: eligibility.maxAmount
        }
      };
    } catch (error) {
      console.error('Risk assessment error:', error);
      return { riskLevel: 'high', score: 0 };
    }
  }
}

module.exports = CreditScoringService;