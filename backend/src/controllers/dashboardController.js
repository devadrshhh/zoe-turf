const Booking = require('../models/Booking');
const Coupon = require('../models/Coupon');
const Turf = require('../models/Turf');

// @desc    Get Analytics Dashboard Statistics
// @route   GET /api/dashboard/analytics
// @access  Private (Admins Only)
const getDashboardAnalytics = async (req, res, next) => {
  try {
    const now = new Date();

    // 1. Total Revenue Aggregation
    const revenueResult = await Booking.aggregate([
      {
        $match: {
          paymentStatus: 'Paid',
          status: 'Confirmed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalAmount' },
        },
      },
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // 2. Total Confirmed Bookings count
    const totalBookings = await Booking.countDocuments({ status: 'Confirmed' });

    // Today Confirmed Bookings count (timezone immune local calculation)
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayBookings = await Booking.countDocuments({ date: todayStr, status: 'Confirmed' });

    // 3. Active Coupons count
    const activeCoupons = await Coupon.countDocuments({
      isActive: true,
      endDate: { $gte: now },
    });

    // 4. Monthly Revenue Aggregation (Last 6 Months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); // Set to start of month

    const monthlyRevenue = await Booking.aggregate([
      {
        $match: {
          paymentStatus: 'Paid',
          status: 'Confirmed',
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' },
          },
          revenue: { $sum: '$finalAmount' },
          bookingsCount: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);

    // Format Monthly Revenue for charting
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Create base 6 months array
    let chartDataMap = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const key = `${y}-${m}`;
      chartDataMap[key] = {
        name: monthNames[m - 1],
        revenue: 0,
        bookings: 0,
        sortKey: y * 12 + m,
      };
    }

    monthlyRevenue.forEach((r) => {
      const key = `${r._id.year}-${r._id.month}`;
      if (chartDataMap[key]) {
        chartDataMap[key].revenue = r.revenue;
        chartDataMap[key].bookings = r.bookingsCount;
      }
    });

    const revenueChartData = Object.values(chartDataMap).sort((a, b) => a.sortKey - b.sortKey);

    // 5. Sport Type bookings breakdown for Pie Chart
    const sportBreakdown = await Booking.aggregate([
      {
        $match: {
          status: 'Confirmed',
        },
      },
      {
        $lookup: {
          from: 'turfs',
          localField: 'turf',
          foreignField: '_id',
          as: 'turfDetails',
        },
      },
      {
        $unwind: '$turfDetails',
      },
      {
        $group: {
          _id: '$turfDetails.sportType',
          value: { $sum: 1 },
        },
      },
    ]);

    const sportChartData = sportBreakdown.map((item) => ({
      name: item._id,
      value: item.value,
    }));

    // If no sports found, set standard placeholders for chart visual
    if (sportChartData.length === 0) {
      sportChartData.push(
        { name: 'Football', value: 0 },
        { name: 'Cricket', value: 0 },
        { name: 'Tennis', value: 0 }
      );
    }

    // Recent Bookings (Last 5)
    const recentBookings = await Booking.find()
      .populate('turf', 'name location sportType')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json({
      success: true,
      analytics: {
        totalRevenue,
        totalBookings,
        todayBookings,
        activeCoupons,
        revenueChartData,
        sportChartData,
        recentBookings,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardAnalytics,
};
