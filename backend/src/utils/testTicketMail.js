const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Pre-register all Mongoose schemas to prevent MissingSchemaError during populates/imports
const Admin = require('../models/Admin');
const Turf = require('../models/Turf');
const Coupon = require('../models/Coupon');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

const { sendReceiptEmail } = require('./mailer');
const { generateReceiptQR } = require('../controllers/bookingController');

const testTicketEmail = async () => {
  try {
    const user = process.env.EMAIL_USER;
    if (!user) {
      console.error('Missing EMAIL_USER environment variable.');
      process.exit(1);
    }

    console.log('Generating high-fidelity mock booking data...');
    
    // Construct mock booking matching database schema structure
    const mockBooking = {
      bookingId: 'TBOOK-997733',
      customerName: 'Devadarsh',
      customerEmail: user, // Sends directly to yourself for validation!
      customerPhone: '9745275297',
      date: '2026-06-02',
      slot: '18:00 - 19:00',
      price: 500,
      discount: 100,
      finalAmount: 400,
      paymentMethod: 'Razorpay',
      paymentStatus: 'Paid',
    };

    console.log('Generating secure base64 QR Code Receipt...');
    mockBooking.qrCodeData = await generateReceiptQR({
      bookingId: mockBooking.bookingId,
      turfName: 'Badminton Championship Court',
      customerName: mockBooking.customerName,
      date: mockBooking.date,
      slot: mockBooking.slot,
      finalAmount: mockBooking.finalAmount,
    });

    console.log('Invoking production sendReceiptEmail utility...');
    const result = await sendReceiptEmail(mockBooking, 'Badminton Championship Court');

    if (result) {
      console.log('\n🎉 SUCCESS! Real ticket email with QR code sent successfully.');
      console.log(`Please check your inbox at: ${user}`);
      process.exit(0);
    } else {
      console.error('❌ Failed to dispatch email. Check SMTP transporter logs.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Mailing failed with error:', error);
    process.exit(1);
  }
};

testTicketEmail();
