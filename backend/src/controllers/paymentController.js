const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Turf = require('../models/Turf');
const crypto = require('crypto');
const { generateReceiptQR } = require('./bookingController');
const { sendReceiptEmail } = require('../utils/mailer');

// @desc    Get All Payments list
// @route   GET /api/payments
// @access  Private (Admins Only)
const getPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: 'booking',
        populate: {
          path: 'turf',
          select: 'name pricePerHour sportType',
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay Payment Signature (Real or Simulation)
// @route   POST /api/payments/verify
// @access  Public
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    if (!razorpay_order_id || !bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Missing order_id or bookingId details',
      });
    }

    const booking = await Booking.findOne({ bookingId }).populate('turf', 'name pricePerHour');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking reference not found',
      });
    }

    // Check if slot has already been booked and paid for by another user
    const alreadyBooked = await Booking.findOne({
      turf: booking.turf._id,
      date: booking.date,
      slot: booking.slot,
      status: 'Confirmed',
      paymentStatus: 'Paid',
      _id: { $ne: booking._id }
    });

    if (alreadyBooked) {
      return res.status(400).json({
        success: false,
        message: 'This slot has already been booked and paid for by another user.',
        alreadyBooked: true
      });
    }

    // 1. Check if order is simulated (starts with 'order_sandbox_') OR real keys not set
    const isMock = razorpay_order_id.startsWith('order_sandbox_') || !process.env.RAZORPAY_KEY_SECRET;

    if (isMock) {
      // Complete mock payment flow successfully
      booking.paymentStatus = 'Paid';
      booking.razorpayPaymentId = razorpay_payment_id || `pay_mock_${Date.now()}`;
      booking.razorpayOrderId = razorpay_order_id;
      
      // Generate secure base64 QR Code Receipt
      booking.qrCodeData = await generateReceiptQR({
        bookingId: booking.bookingId,
        turfName: booking.turf.name,
        customerName: booking.customerName,
        date: booking.date,
        slot: booking.slot,
        finalAmount: booking.finalAmount,
      });

      await booking.save();

      // Log Payment Ledger Entry
      await Payment.create({
        booking: booking._id,
        amount: booking.finalAmount,
        status: 'Paid',
        razorpayOrderId: booking.razorpayOrderId,
        razorpayPaymentId: booking.razorpayPaymentId,
        method: 'Razorpay',
      });

      // Trigger automated email receipt dispatch asynchronously
      sendReceiptEmail(booking, booking.turf ? booking.turf.name : 'Main Turf Arena');

      return res.status(200).json({
        success: true,
        message: 'Sandbox Payment verified and confirmed successfully!',
        booking,
      });
    }

    // 2. Real Razorpay Signature verification
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      booking.paymentStatus = 'Paid';
      booking.razorpayPaymentId = razorpay_payment_id;
      booking.razorpayOrderId = razorpay_order_id;

      // Generate base64 QR Code Receipt
      booking.qrCodeData = await generateReceiptQR({
        bookingId: booking.bookingId,
        turfName: booking.turf.name,
        customerName: booking.customerName,
        date: booking.date,
        slot: booking.slot,
        finalAmount: booking.finalAmount,
      });

      await booking.save();

      // Log Payment Ledger Entry
      await Payment.create({
        booking: booking._id,
        amount: booking.finalAmount,
        status: 'Paid',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        method: 'Razorpay',
      });

      // Trigger automated email receipt dispatch asynchronously
      sendReceiptEmail(booking, booking.turf ? booking.turf.name : 'Main Turf Arena');

      res.status(200).json({
        success: true,
        message: 'Payment verified and confirmed successfully!',
        booking,
      });
    } else {
      booking.paymentStatus = 'Failed';
      await booking.save();
      
      res.status(400).json({
        success: false,
        message: 'Payment signature verification failed. Transaction invalid.',
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPayments,
  verifyPayment,
};
