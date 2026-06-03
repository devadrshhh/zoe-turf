const Booking = require('../models/Booking');
const Turf = require('../models/Turf');
const Coupon = require('../models/Coupon');
const Payment = require('../models/Payment');
const QRCode = require('qrcode');
const ExcelJS = require('exceljs');
const { sendReceiptEmail, sendVerificationEmail } = require('../utils/mailer');

// Operating Slot definitions (Hourly slots)
const OPERATING_SLOTS = [
  '06:00 - 07:00',
  '07:00 - 08:00',
  '08:00 - 09:00',
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '13:00 - 14:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
  '16:00 - 17:00',
  '17:00 - 18:00',
  '18:00 - 19:00',
  '19:00 - 20:00',
  '20:00 - 21:00',
  '21:00 - 22:00',
  '22:00 - 23:00',
];

// Helper to generate base64 QR receipt
const generateReceiptQR = async (bookingDetails) => {
  try {
    const textData = JSON.stringify({
      bookingId: bookingDetails.bookingId,
      turf: bookingDetails.turfName,
      customer: bookingDetails.customerName,
      date: bookingDetails.date,
      slot: bookingDetails.slot,
      amountPaid: `₹${bookingDetails.finalAmount}`,
      status: 'CONFIRMED',
    });
    return await QRCode.toDataURL(textData);
  } catch (err) {
    console.error('QR code generation failed:', err);
    return '';
  }
};

// @desc    Get All Bookings with Filter, Search and Pagination
// @route   GET /api/bookings
// @access  Private (Admins Only)
const getBookings = async (req, res, next) => {
  try {
    const { search, paymentStatus, status, turfId, date } = req.query;
    let query = {};

    // Apply filters
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    if (status) {
      query.status = status;
    }
    if (turfId) {
      query.turf = turfId;
    }
    if (date) {
      query.date = date;
    }

    // Apply search for Customer Name/Email/Phone/Booking ID
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { bookingId: { $regex: search, $options: 'i' } },
      ];
    }

    const bookings = await Booking.find(query)
      .populate('turf', 'name location pricePerHour sportType')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available slots for a Turf on a specific Date
// @route   GET /api/bookings/slots-available
// @access  Public
const getSlotsAvailable = async (req, res, next) => {
  try {
    const { turfId, date } = req.query;

    if (!turfId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide turfId and date (YYYY-MM-DD)',
      });
    }

    const turf = await Turf.findById(turfId);
    if (!turf) {
      return res.status(404).json({
        success: false,
        message: 'Turf not found',
      });
    }

    // Find all bookings for this turf on the given date that are not cancelled
    const activeBookings = await Booking.find({
      turf: turfId,
      date,
      status: 'Confirmed',
    }).select('slot').lean();

    const bookedSlots = activeBookings.map((b) => b.slot);

    // Build slots map
    const slots = OPERATING_SLOTS.map((slotTime) => {
      return {
        time: slotTime,
        isAvailable: !bookedSlots.includes(slotTime),
      };
    });

    res.status(200).json({
      success: true,
      turf: {
        id: turf._id,
        name: turf.name,
        pricePerHour: turf.pricePerHour,
      },
      date,
      slots,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new slot booking (Admin Walk-in or Customer Front-end)
// @route   POST /api/bookings
// @access  Public (Can be created by customer or admin)
const createBooking = async (req, res, next) => {
  try {
    const {
      turfId,
      date,
      slot,
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod,
      couponCode,
    } = req.body;

    if (!turfId || !date || !slot || !customerName || !customerEmail || !customerPhone || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required booking details',
      });
    }

    const turf = await Turf.findById(turfId);
    if (!turf || !turf.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Active Turf not found',
      });
    }

    // Check if slot is already booked
    const slotExists = await Booking.findOne({
      turf: turfId,
      date,
      slot,
      status: 'Confirmed',
    }).select('_id').lean();

    if (slotExists) {
      return res.status(400).json({
        success: false,
        message: 'This slot has already been booked. Please pick another timing.',
      });
    }

    // Pricing calculation
    const basePrice = turf.pricePerHour;
    let discount = 0;

    // Apply Coupon if present
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (coupon) {
        const now = new Date();
        if (now >= coupon.startDate && now <= coupon.endDate && basePrice >= coupon.minBookingAmount) {
          if (coupon.discountType === 'Fixed') {
            discount = coupon.discountValue;
          } else if (coupon.discountType === 'Percentage') {
            discount = (basePrice * coupon.discountValue) / 100;
            if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
              discount = coupon.maxDiscount;
            }
          }
        }
      }
    }

    const finalAmount = Math.max(0, basePrice - discount);
    const uniqueBookingId = `TBOOK-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    let bookingData = {
      bookingId: uniqueBookingId,
      turf: turfId,
      customerName,
      customerEmail,
      customerPhone,
      date,
      slot,
      price: basePrice,
      discount,
      finalAmount,
      paymentMethod,
      couponCode: couponCode ? couponCode.toUpperCase() : undefined,
    };

    if (paymentMethod === 'Cash') {
      // Walk-in booking or manual payment
      bookingData.paymentStatus = 'Paid';
      
      // Generate base64 QR Code Receipt
      bookingData.qrCodeData = await generateReceiptQR({
        bookingId: uniqueBookingId,
        turfName: turf.name,
        customerName,
        date,
        slot,
        finalAmount,
      });

      const newBooking = await Booking.create(bookingData);

      // Create Payment Ledger entry
      await Payment.create({
        booking: newBooking._id,
        amount: finalAmount,
        status: 'Paid',
        method: 'Cash',
      });

      // Trigger automated email receipt dispatch asynchronously
      sendReceiptEmail(newBooking, turf.name);

      return res.status(201).json({
        success: true,
        message: 'Walk-in booking created successfully!',
        booking: newBooking,
      });
    } else {
      // Razorpay checkout
      bookingData.paymentStatus = 'Pending';
      
      let razorpayOrderId = `order_sandbox_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
      let isRealOrder = false;

      // Attempt to create a real Razorpay order if real keys are available
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (keyId && keySecret && !keyId.includes('mock') && !keyId.includes('test_mock') && keyId.startsWith('rzp_')) {
        try {
          const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
          const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify({
              amount: Math.round(finalAmount * 100), // paise
              currency: 'INR',
              receipt: uniqueBookingId,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.id) {
              razorpayOrderId = data.id;
              isRealOrder = true;
              console.log(`Real Razorpay order created successfully: ${razorpayOrderId}`);
            } else {
              console.warn('Razorpay response missing order ID, falling back to sandbox');
            }
          } else {
            const errText = await response.text();
            console.error(`Razorpay API error (status ${response.status}):`, errText);
          }
        } catch (apiError) {
          console.error('Failed to connect to Razorpay API, falling back to sandbox:', apiError);
        }
      }

      bookingData.razorpayOrderId = razorpayOrderId;
      const newBooking = await Booking.create(bookingData);

      return res.status(201).json({
        success: true,
        message: isRealOrder
          ? 'Booking initialized. Complete transaction to confirm.'
          : 'Booking initialized in Sandbox Mode. Complete simulation to confirm.',
        booking: newBooking,
        razorpayParameters: {
          key: keyId || 'rzp_test_mock_keys',
          amount: finalAmount * 100, // paise
          currency: 'INR',
          order_id: razorpayOrderId,
          name: 'Turf Booking Hub',
          description: `Booking for ${turf.name}`,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel an existing booking
// @route   PUT /api/bookings/cancel/:id
// @access  Private (Admins Only)
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled',
      });
    }

    booking.status = 'Cancelled';
    await booking.save();

    // If there is an associated payment, we can mark it as refunded or leave it,
    // let's update associated payments to show Refunded or status Cancelled
    await Payment.updateMany({ booking: booking._id }, { status: 'Refunded' });

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export Bookings or Payments to Excel (.xlsx) with date filters & custom styles
// @route   GET /api/bookings/export
// @access  Private (Admins Only)
const exportBookings = async (req, res, next) => {
  try {
    const { type, range, startDate, endDate } = req.query;

    let query = {};
    const now = new Date();

    let rangeText = 'All-Time';
    if (range === 'today') {
      rangeText = 'Today';
    } else if (range === 'last_week') {
      rangeText = 'Last Week';
    } else if (range === 'last_month') {
      rangeText = 'Last Month';
    } else if (range === 'custom') {
      rangeText = startDate && endDate ? `${startDate} to ${endDate}` : 'Custom Range';
    }

    if (range === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfToday, $lte: endOfToday };
    } else if (range === 'last_week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query.createdAt = { $gte: sevenDaysAgo };
    } else if (range === 'last_month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.createdAt = { $gte: thirtyDaysAgo };
    } else if (range === 'custom') {
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: start, $lte: end };
      }
    }

    const workbook = new ExcelJS.Workbook();

    if (type === 'payments') {
      // Export Payments
      const payments = await Payment.find(query)
        .populate({
          path: 'booking',
          populate: { path: 'turf', select: 'name' }
        })
        .sort({ createdAt: -1 });

      const worksheet = workbook.addWorksheet('Payments');

      // Define columns
      worksheet.columns = [
        { header: 'Booking ID', key: 'bookingId' },
        { header: 'Customer Name', key: 'customerName' },
        { header: 'Payment Date', key: 'paymentDate' },
        { header: 'Amount', key: 'amount' },
        { header: 'Status', key: 'status' },
        { header: 'Payment Method', key: 'method' },
        { header: 'Razorpay Order ID', key: 'razorpayOrderId' },
        { header: 'Razorpay Payment ID', key: 'razorpayPaymentId' }
      ];

      let totalEarnings = 0;
      let totalBookingsCount = 0;

      payments.forEach((p) => {
        const bookingId = p.booking ? p.booking.bookingId : 'N/A';
        const customerName = p.booking ? p.booking.customerName : 'N/A';
        const paymentDate = p.createdAt.toISOString().split('T')[0];
        const amountStr = `₹${p.amount}`;

        if (p.status === 'Paid') {
          totalEarnings += p.amount;
          totalBookingsCount += 1;
        }

        const row = worksheet.addRow({
          bookingId,
          customerName,
          paymentDate,
          amount: amountStr,
          status: p.status,
          method: p.method,
          razorpayOrderId: p.razorpayOrderId || 'N/A',
          razorpayPaymentId: p.razorpayPaymentId || 'N/A'
        });

        // Highlight cells based on status (Paid = green, Pending/Failed = red)
        const statusCell = row.getCell('status');
        if (p.status === 'Paid') {
          statusCell.font = { color: { argb: 'FF008000' }, bold: true }; // green
        } else {
          statusCell.font = { color: { argb: 'FFFF0000' }, bold: true }; // red
        }
      });

      // Add summary
      worksheet.addRow([]);
      const bookingsRow = worksheet.addRow([`Total Bookings (${rangeText})`, totalBookingsCount]);
      bookingsRow.getCell(1).font = { bold: true };
      bookingsRow.getCell(2).font = { bold: true };

      const earningsRow = worksheet.addRow([`Total Earnings (${rangeText})`, `₹${totalEarnings}`]);
      earningsRow.getCell(1).font = { bold: true };
      earningsRow.getCell(2).font = { bold: true };

      // Set headings font to bold
      worksheet.getRow(1).font = { bold: true };

      // Column Auto-width calculation
      worksheet.columns.forEach(column => {
        let maxLength = column.header ? column.header.toString().length : 10;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength + 3;
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Payments_Export_${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      return res.status(200).end();

    } else {
      // Export Bookings (default)
      const bookings = await Booking.find(query)
        .populate('turf', 'name location pricePerHour')
        .sort({ createdAt: -1 })
        .lean();

      const worksheet = workbook.addWorksheet('Bookings');

      // Define columns
      worksheet.columns = [
        { header: 'Booking ID', key: 'bookingId' },
        { header: 'Turf Name', key: 'turfName' },
        { header: 'Customer Name', key: 'customerName' },
        { header: 'Email', key: 'customerEmail' },
        { header: 'Phone', key: 'customerPhone' },
        { header: 'Date', key: 'date' },
        { header: 'Slot', key: 'slot' },
        { header: 'Price', key: 'price' },
        { header: 'Discount', key: 'discount' },
        { header: 'Final Amount', key: 'finalAmount' },
        { header: 'Payment Status', key: 'paymentStatus' },
        { header: 'Payment Method', key: 'paymentMethod' },
        { header: 'Booking Status', key: 'status' },
        { header: 'Created Date', key: 'createdDate' }
      ];

      let totalEarnings = 0;
      let totalBookingsCount = 0;

      bookings.forEach((b) => {
        if (b.status === 'Confirmed') {
          totalBookingsCount += 1;
          if (b.paymentStatus === 'Paid') {
            totalEarnings += b.finalAmount;
          }
        }
        const turfName = b.turf ? b.turf.name : 'N/A';
        const createdDate = b.createdAt.toISOString().split('T')[0];

        const row = worksheet.addRow({
          bookingId: b.bookingId,
          turfName,
          customerName: b.customerName,
          customerEmail: b.customerEmail,
          customerPhone: b.customerPhone,
          date: b.date,
          slot: b.slot,
          price: `₹${b.price}`,
          discount: `₹${b.discount}`,
          finalAmount: `₹${b.finalAmount}`,
          paymentStatus: b.paymentStatus,
          paymentMethod: b.paymentMethod,
          status: b.status,
          createdDate
        });

        // Colors (Paid = green, Pending/Failed = red)
        const payStatusCell = row.getCell('paymentStatus');
        if (b.paymentStatus === 'Paid') {
          payStatusCell.font = { color: { argb: 'FF008000' }, bold: true }; // green
        } else {
          payStatusCell.font = { color: { argb: 'FFFF0000' }, bold: true }; // red
        }

        const statusCell = row.getCell('status');
        if (b.status === 'Confirmed') {
          statusCell.font = { color: { argb: 'FF008000' }, bold: true }; // green
        } else {
          statusCell.font = { color: { argb: 'FFFF0000' }, bold: true }; // red
        }
      });

      // Add summary
      worksheet.addRow([]);
      const bookingsRow = worksheet.addRow([`Total Bookings (${rangeText})`, totalBookingsCount]);
      bookingsRow.getCell(1).font = { bold: true };
      bookingsRow.getCell(2).font = { bold: true };

      const earningsRow = worksheet.addRow([`Total Earnings (${rangeText})`, `₹${totalEarnings}`]);
      earningsRow.getCell(1).font = { bold: true };
      earningsRow.getCell(2).font = { bold: true };

      // Set headings font to bold
      worksheet.getRow(1).font = { bold: true };

      // Column Auto-width calculation
      worksheet.columns.forEach(column => {
        let maxLength = column.header ? column.header.toString().length : 10;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength + 3;
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Bookings_Export_${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      return res.status(200).end();
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Mark an existing pending booking as Paid
// @route   PUT /api/bookings/mark-paid/:id
// @access  Private (Admins Only)
const markBookingAsPaid = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('turf', 'name pricePerHour');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.paymentStatus === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already paid',
      });
    }

    booking.paymentStatus = 'Paid';
    
    // Generate secure base64 QR Code Receipt
    booking.qrCodeData = await generateReceiptQR({
      bookingId: booking.bookingId,
      turfName: booking.turf ? booking.turf.name : 'Main Turf Arena',
      customerName: booking.customerName,
      date: booking.date,
      slot: booking.slot,
      finalAmount: booking.finalAmount,
    });

    await booking.save();

    // Create Payment Ledger entry if it doesn't already exist
    const existingPayment = await Payment.findOne({ booking: booking._id });
    if (!existingPayment) {
      await Payment.create({
        booking: booking._id,
        amount: booking.finalAmount,
        status: 'Paid',
        razorpayOrderId: booking.razorpayOrderId,
        method: booking.paymentMethod || 'Razorpay',
      });
    } else {
      existingPayment.status = 'Paid';
      await existingPayment.save();
    }

    // Trigger automated email receipt dispatch asynchronously
    sendReceiptEmail(booking, booking.turf ? booking.turf.name : 'Main Turf Arena');

    res.status(200).json({
      success: true,
      message: 'Booking marked as Paid successfully',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lookup booking by string bookingId
// @route   GET /api/bookings/lookup/:bookingId
// @access  Private (Admins Only)
const lookupBookingById = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId })
      .populate('turf', 'name pricePerHour location')
      .lean();
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found with the provided ID',
      });
    }

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify booking ticket (Admin scanned)
// @route   PUT /api/bookings/verify/:id
// @access  Private (Admins Only)
const verifyBookingTicket = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.isVerified) {
      return res.status(400).json({
        success: false,
        message: `This ticket has already been verified on ${booking.verifiedAt}`,
        verifiedAt: booking.verifiedAt,
      });
    }

    booking.isVerified = true;
    booking.verifiedAt = new Date();
    await booking.save();

    // Fetch booking with turf populated to get the name for the check-in email
    const populatedBooking = await Booking.findById(booking._id).populate('turf', 'name');
    const turfName = populatedBooking && populatedBooking.turf ? populatedBooking.turf.name : 'Main Turf Arena';

    // Trigger verification check-in email dispatch asynchronously to notify customer
    sendVerificationEmail(booking, turfName);

    res.status(200).json({
      success: true,
      message: 'Ticket verified successfully',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBookings,
  getSlotsAvailable,
  createBooking,
  cancelBooking,
  exportBookings,
  generateReceiptQR,
  markBookingAsPaid,
  lookupBookingById,
  verifyBookingTicket,
};
