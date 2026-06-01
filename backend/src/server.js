const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorMiddleware');

// Model references for seeding
const Admin = require('./models/Admin');
const Turf = require('./models/Turf');
const Coupon = require('./models/Coupon');

// Route Imports
const adminRoutes = require('./routes/adminRoutes');
const turfRoutes = require('./routes/turfRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const couponRoutes = require('./routes/couponRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Initialize app
const app = express();

// Set security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allows displaying local images or visual data if needed
  })
);

// CORS Config
const corsOptions = {
  origin: true, // Auto matches origin
  credentials: true, // Allows HTTP-only cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiter to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 300, // limit each IP to 300 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});
app.use('/api/', limiter);

// Mount Routes
app.use('/api/admin', adminRoutes);
app.use('/api`${import.meta.env.VITE_API_URL}/api/turfs`', turfRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Base route test
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MERN Turf Booking System API operational',
  });
});

// Central Error Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect Database & Start Server
const startServer = async () => {
  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Auto-Seed Initial Super Admin Account
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      console.log('No admin records found. Initializing auto-seeding...');
      const seedEmail = process.env.ADMIN_EMAIL || 'learn.microx@gmail.com';
      const seedPassword = process.env.ADMIN_PASSWORD || 'MicroX@01';

      await Admin.create({
        name: 'Super Admin',
        email: seedEmail,
        password: seedPassword,
        role: 'superadmin',
        isActive: true,
      });

      console.log(`--------------------------------------------------`);
      console.log(`AUTO-SEED: Admin created successfully!`);
      console.log(`Email: ${seedEmail}`);
      console.log(`Password: ${seedPassword}`);
      console.log(`--------------------------------------------------`);
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`Server executing in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Server failed to boot: ${error.message}`);
    process.exit(1);
  }
};

startServer();
