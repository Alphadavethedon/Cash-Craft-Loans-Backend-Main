const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details[0].message
      });
    }
    next();
  };
};

// Validation schemas
const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(30).required(),
  lastName: Joi.string().min(2).max(30).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^254[0-9]{9}$/).required().messages({
    'string.pattern.base': 'Phone number must be in format 254XXXXXXXXX'
  }),
  password: Joi.string().min(6).required(),
  referralCode: Joi.string().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const loanApplicationSchema = Joi.object({
  amount: Joi.number().min(500).max(500000).required(),
  term: Joi.number().min(7).max(365).required(),
  purpose: Joi.string().valid('business', 'emergency', 'education', 'medical', 'personal', 'other').required(),
  disbursementMethod: Joi.string().valid('mpesa', 'airtel', 'bank').default('mpesa'),
  disbursementPhone: Joi.string().pattern(/^254[0-9]{9}$/).required()
});

const kycSchema = Joi.object({
  nationalId: Joi.string().pattern(/^[0-9]{8}$/).required(),
  dateOfBirth: Joi.date().max('now').required(),
  county: Joi.string().required(),
  town: Joi.string().required(),
  occupation: Joi.string().required(),
  monthlyIncome: Joi.number().min(0).required(),
  mpesaNumber: Joi.string().pattern(/^254[0-9]{9}$/).optional(),
  airtelNumber: Joi.string().pattern(/^254[0-9]{9}$/).optional()
});

const paymentSchema = Joi.object({
  loanId: Joi.string().required(),
  amount: Joi.number().min(1).required(),
  method: Joi.string().valid('mpesa', 'airtel', 'bank', 'cash').required(),
  phoneNumber: Joi.string().pattern(/^254[0-9]{9}$/).when('method', {
    is: Joi.string().valid('mpesa', 'airtel'),
    then: Joi.required()
  })
});

module.exports = {
  validateRequest,
  registerSchema,
  loginSchema,
  loanApplicationSchema,
  kycSchema,
  paymentSchema
};