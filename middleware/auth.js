const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid'
      });
    }
    
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended or closed'
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }
    
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

const adminAuth = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

const agentAuth = (req, res, next) => {
  if (!['admin', 'agent'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Agent privileges required.'
    });
  }
  next();
};

module.exports = { auth, adminAuth, agentAuth };