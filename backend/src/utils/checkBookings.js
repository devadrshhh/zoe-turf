const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Booking = require('../models/Booking');
const Turf = require('../models/Turf');

// Load environment variables
dotenv.config();

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is not defined in environment variables.');
      process.exit(1);
    }

    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully!');

    console.log('Fetching the 10 most recent bookings...');
    const recentBookings = await Booking.find()
      .populate('turf', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    if (recentBookings.length === 0) {
      console.log('No bookings found in the database.');
    } else {
      recentBookings.forEach((b, idx) => {
        console.log(`\n--- Booking #${idx + 1} ---`);
        console.log(`ID: ${b._id}`);
        console.log(`Booking ID: ${b.bookingId}`);
        console.log(`Customer: ${b.customerName} (${b.customerEmail}, ${b.customerPhone})`);
        console.log(`Turf: ${b.turf ? b.turf.name : 'N/A'}`);
        console.log(`Date: ${b.date} (${b.slot})`);
        console.log(`Amount: ₹${b.finalAmount}`);
        console.log(`Payment Status: ${b.paymentStatus} (Method: ${b.paymentMethod})`);
        console.log(`Razorpay Order ID: ${b.razorpayOrderId || 'N/A'}`);
        console.log(`Razorpay Payment ID: ${b.razorpayPaymentId || 'N/A'}`);
        console.log(`Booking Status: ${b.status}`);
        console.log(`Created At: ${b.createdAt}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    process.exit(1);
  }
};

run();
