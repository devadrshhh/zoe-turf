const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
    },
    turf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Turf',
      required: true,
    },
    customerName: {
      type: String,
      required: [true, 'Please provide customer name'],
      trim: true,
    },
    customerEmail: {
      type: String,
      required: [true, 'Please provide customer email'],
      trim: true,
      lowercase: true,
    },
    customerPhone: {
      type: String,
      required: [true, 'Please provide customer phone number'],
      trim: true,
    },
    date: {
      type: String, // Stored as YYYY-MM-DD to avoid standard timezone shifting bugs
      required: true,
    },
    slot: {
      type: String, // Format: "06:00 AM - 07:00 AM" or "18:00 - 19:00"
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending',
    },
    paymentMethod: {
      type: String,
      enum: ['Razorpay', 'Cash'],
      required: true,
    },
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    couponCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    qrCodeData: {
      type: String, // Holds base64 encoded QR Code source
    },
    status: {
      type: String,
      enum: ['Confirmed', 'Cancelled', 'Pending'],
      default: 'Confirmed',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Optimize slot availability checks and booking lookups
bookingSchema.index({ turf: 1, date: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
