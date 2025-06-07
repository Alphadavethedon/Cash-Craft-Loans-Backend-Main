const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
<<<<<<< HEAD
const router = express.Router();
require('dotenv').config();

const { PORT } = require('./PORT');

// Import routes
const authRoutes = require('./node');
=======
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
>>>>>>> 9b62138fef25ee7d3bbd83ad976b8dbce93617d6
const userRoutes = require('./routes/users');
const loanRoutes = require('./routes/loans');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const mpesaRoutes = require('./routes/mpesa');

const app = express();

// Security middleware
app.use(helmet());
<<<<<<< HEAD

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  // Note: useNewUrlParser and useUnifiedTopology are no longer needed in latest mongoose versions
=======
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
>>>>>>> 9b62138fef25ee7d3bbd83ad976b8dbce93617d6
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mpesa', mpesaRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
<<<<<<< HEAD
  res.json({
    status: 'OK',
    message: 'CashCraft Loans API is running',
    timestamp: new Date().toISOString(),
=======
  res.json({ 
    status: 'OK', 
    message: 'CashCraft Loans API is running',
    timestamp: new Date().toISOString()
>>>>>>> 9b62138fef25ee7d3bbd83ad976b8dbce93617d6
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
<<<<<<< HEAD
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
=======
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
>>>>>>> 9b62138fef25ee7d3bbd83ad976b8dbce93617d6
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
<<<<<<< HEAD
    message: 'API endpoint not found',
  });
});

// Start server
=======
    message: 'API endpoint not found'
  });
});

const PORT = process.env.PORT || 5000;
>>>>>>> 9b62138fef25ee7d3bbd83ad976b8dbce93617d6
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
<<<<<<< HEAD
=======

module.exports = app;
>>>>>>> 9b62138fef25ee7d3bbd83ad976b8dbce93617d6
