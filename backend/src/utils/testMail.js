const mongoose = require('mongoose');
const dotenv = require('dotenv');
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const Turf = require('../models/Turf');
const { sendReceiptEmail } = require('./mailer');

// Load environment variables
dotenv.config();

const runTest = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is not defined in environment variables.');
      process.exit(1);
    }

    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully!');

    // Fetch the single most recent booking in the system
    console.log('Querying the latest booking...');
    const booking = await Booking.findOne()
      .populate('turf')
      .sort({ createdAt: -1 });

    if (!booking) {
      console.error('No bookings found in the database. Please create a booking first.');
      process.exit(1);
    }

    const turfName = booking.turf ? booking.turf.name : 'Badminton Arena';
    console.log(`Found Booking: ${booking.bookingId} for Customer: ${booking.customerName} (${booking.customerEmail})`);

    // If booking doesn't have a QR Code, generate a fresh one now for testing
    if (!booking.qrCodeData) {
      console.log('Generating high-fidelity ticket QR Code data...');
      const textData = JSON.stringify({
        bookingId: booking.bookingId,
        turf: turfName,
        customer: booking.customerName,
        date: booking.date,
        slot: booking.slot,
        amountPaid: `₹${booking.finalAmount}`,
        status: 'CONFIRMED',
      });
      booking.qrCodeData = await QRCode.toDataURL(textData);
      await booking.save();
    }

    console.log(`Sending high-fidelity QR Code Ticket receipt to: ${booking.customerEmail}...`);
    
    // Call the exact production mailing helper
    const success = await sendReceiptEmail(booking, turfName);

    if (success) {
      console.log('🎉 Success! Live Ticket Email sent successfully with the QR Code and summary details.');
    } else {
      console.error('❌ Failed! The email dispatcher returned an error.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runTest();
