const Turf = require('../models/Turf');

// @desc    Get All Turfs (public/admin list)
// @route   GET /api`${import.meta.env.VITE_API_URL}/api/turfs`
// @access  Public
const getTurfs = async (req, res, next) => {
  try {
    const turfs = await Turf.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: turfs.length,
      turfs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get All Turfs for Admin Panel (including inactive)
// @route   GET /api`${import.meta.env.VITE_API_URL}/api/turfs`/admin
// @access  Private
const getAdminTurfs = async (req, res, next) => {
  try {
    const turfs = await Turf.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: turfs.length,
      turfs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Single Turf Details
// @route   GET /api`${import.meta.env.VITE_API_URL}/api/turfs`/:id
// @access  Public
const getTurfById = async (req, res, next) => {
  try {
    const turf = await Turf.findById(req.params.id);
    if (!turf) {
      return res.status(404).json({
        success: false,
        message: 'Turf not found',
      });
    }
    res.status(200).json({
      success: true,
      turf,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a Turf
// @route   POST /api`${import.meta.env.VITE_API_URL}/api/turfs`
// @access  Private (Admins)
const createTurf = async (req, res, next) => {
  try {
    const { name, location, pricePerHour, description, sportType } = req.body;

    if (!name || !location || !pricePerHour || !sportType) {
      return res.status(400).json({
        success: false,
        message: 'Please fill name, location, price per hour, and sport type',
      });
    }

    const turf = await Turf.create({
      name,
      location,
      pricePerHour,
      description,
      sportType,
    });

    res.status(201).json({
      success: true,
      message: 'Turf created successfully',
      turf,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a Turf
// @route   PUT /api`${import.meta.env.VITE_API_URL}/api/turfs`/:id
// @access  Private (Admins)
const updateTurf = async (req, res, next) => {
  try {
    const { name, location, pricePerHour, description, sportType, isActive } = req.body;

    let turf = await Turf.findById(req.params.id);
    if (!turf) {
      return res.status(404).json({
        success: false,
        message: 'Turf not found',
      });
    }

    turf.name = name || turf.name;
    turf.location = location || turf.location;
    turf.pricePerHour = pricePerHour !== undefined ? pricePerHour : turf.pricePerHour;
    turf.description = description || turf.description;
    turf.sportType = sportType || turf.sportType;
    if (isActive !== undefined) {
      turf.isActive = isActive;
    }

    const updatedTurf = await turf.save();

    res.status(200).json({
      success: true,
      message: 'Turf updated successfully',
      turf: updatedTurf,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a Turf
// @route   DELETE /api`${import.meta.env.VITE_API_URL}/api/turfs`/:id
// @access  Private (Admins)
const deleteTurf = async (req, res, next) => {
  try {
    const turf = await Turf.findById(req.params.id);
    if (!turf) {
      return res.status(404).json({
        success: false,
        message: 'Turf not found',
      });
    }

    await Turf.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Turf deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update price for all turfs/slots
// @route   PUT /api`${import.meta.env.VITE_API_URL}/api/turfs`/update-price-all
// @access  Private (Admins)
const updateAllTurfPrices = async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (amount === undefined || amount === null || amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid pricing amount',
      });
    }

    await Turf.updateMany({}, { pricePerHour: Number(amount) });

    res.status(200).json({
      success: true,
      message: `Global slot pricing successfully set to ₹${amount} for all arenas!`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTurfs,
  getAdminTurfs,
  getTurfById,
  createTurf,
  updateTurf,
  deleteTurf,
  updateAllTurfPrices,
};
