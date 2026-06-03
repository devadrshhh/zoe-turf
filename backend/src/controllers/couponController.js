const Coupon = require('../models/Coupon');

// @desc    Get All Coupons
// @route   GET /api/coupons
// @access  Private (Admins Only)
const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      coupons,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a Coupon
// @route   POST /api/coupons
// @access  Private (Admins Only)
const createCoupon = async (req, res, next) => {
  try {
    const { code, discountType, discountValue, minBookingAmount, maxDiscount, startDate, endDate } = req.body;

    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required coupon details',
      });
    }

    // Check duplicate code
    const couponExists = await Coupon.findOne({ code: code.toUpperCase() });
    if (couponExists) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists',
      });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      minBookingAmount: minBookingAmount || 0,
      maxDiscount: maxDiscount || 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Coupon Active State
// @route   PUT /api/coupons/toggle/:id
// @access  Private (Admins Only)
const toggleCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      coupon,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a Coupon
// @route   DELETE /api/coupons/:id
// @access  Private (Admins Only)
const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    await Coupon.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate and Apply Coupon
// @route   POST /api/coupons/apply
// @access  Public
const applyCoupon = async (req, res, next) => {
  try {
    const { code, bookingAmount } = req.body;

    if (!code || !bookingAmount) {
      return res.status(400).json({
        success: false,
        message: 'Please provide coupon code and booking amount',
      });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true }).lean();
    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive coupon code',
      });
    }

    const now = new Date();
    if (now < coupon.startDate) {
      return res.status(400).json({
        success: false,
        message: 'Coupon promotion has not started yet',
      });
    }

    if (now > coupon.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code has expired',
      });
    }

    if (bookingAmount < coupon.minBookingAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum booking amount of ₹${coupon.minBookingAmount} required to use this coupon`,
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'Fixed') {
      discount = coupon.discountValue;
    } else if (coupon.discountType === 'Percentage') {
      discount = (bookingAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    }

    // Secure discount from exceeding booking amount
    if (discount > bookingAmount) {
      discount = bookingAmount;
    }

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      discount,
      couponCode: coupon.code,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCoupons,
  createCoupon,
  toggleCoupon,
  deleteCoupon,
  applyCoupon,
};
