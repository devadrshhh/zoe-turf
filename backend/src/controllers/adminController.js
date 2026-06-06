const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_turf_booking_key_123456!', {
    expiresIn: '7d', // Token expires in 7 days
  });
};

// Helper to set cookie options
const getCookieOptions = () => {
  return {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true in production (HTTPS required)
    sameSite: 'strict',
  };
};

// @desc    Admin Login
// @route   POST /api/admin/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check admin existence
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check active status
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact Super Admin.',
      });
    }

    // Validate password
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login timestamp
    admin.lastLogin = new Date();
    await admin.save({ validateBeforeSave: false });

    // Generate JWT
    const token = generateToken(admin._id);

    // Store in cookie
    res.cookie('token', token, getCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Logout
// @route   POST /api/admin/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    // Clear cookies
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 1000), // expire immediately
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Current Logged in Admin Profile
// @route   GET /api/admin/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      admin: req.admin,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create New Admin
// @route   POST /api/admin/create
// @access  Private (Super Admin Only)
const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Check if email already exists
    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists',
      });
    }

    // Create the admin
    const newAdmin = await Admin.create({
      name,
      email,
      password,
      role,
      phone,
    });

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        phone: newAdmin.phone,
        role: newAdmin.role,
        isActive: newAdmin.isActive,
        createdAt: newAdmin.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Admin Details
// @route   PUT /api/admin/update/:id
// @access  Private (Super Admin Only)
const updateAdmin = async (req, res, next) => {
  try {
    const { name, email, role, isActive, phone } = req.body;
    const adminId = req.params.id;

    let admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found',
      });
    }

    // Prevent Super Admin from changing their own role or deactivating themselves
    if (adminId.toString() === req.admin._id.toString()) {
      if (role && role !== admin.role) {
        return res.status(400).json({
          success: false,
          message: 'You cannot change your own role',
        });
      }
      if (isActive !== undefined && isActive === false) {
        return res.status(400).json({
          success: false,
          message: 'You cannot deactivate your own account',
        });
      }
    }

    admin.name = name || admin.name;
    admin.email = email || admin.email;
    admin.role = role || admin.role;
    if (phone !== undefined) {
      admin.phone = phone;
    }
    if (isActive !== undefined) {
      admin.isActive = isActive;
    }

    const updatedAdmin = await admin.save();

    res.status(200).json({
      success: true,
      message: 'Admin details updated successfully',
      admin: {
        id: updatedAdmin._id,
        name: updatedAdmin.name,
        email: updatedAdmin.email,
        phone: updatedAdmin.phone,
        role: updatedAdmin.role,
        isActive: updatedAdmin.isActive,
        updatedAt: updatedAdmin.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change Password
// @route   PUT /api/admin/change-password/:id
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const targetId = req.params.id;

    // Check permissions: Target account owner OR Super Admin can change password
    const isOwner = req.admin._id.toString() === targetId;
    const isSuperAdmin = req.admin.role === 'superadmin';

    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to change this password',
      });
    }

    const admin = await Admin.findById(targetId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found',
      });
    }

    // If request made by owner, require currentPassword verification
    if (isOwner) {
      const isMatch = await admin.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Incorrect current password',
        });
      }
    }

    // Set new password (will be automatically hashed via model pre-save middleware)
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Admin Account
// @route   DELETE /api/admin/delete/:id
// @access  Private (Super Admin Only)
const deleteAdmin = async (req, res, next) => {
  try {
    const adminId = req.params.id;

    // Check existence
    const adminToDelete = await Admin.findById(adminId);
    if (!adminToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found',
      });
    }

    // Prevent self deletion
    if (adminId === req.admin._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own admin account',
      });
    }

    // Delete
    await Admin.findByIdAndDelete(adminId);

    res.status(200).json({
      success: true,
      message: 'Admin account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get All Admins
// @route   GET /api/admin/all
// @access  Private
const getAllAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      admins,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
  getMe,
  createAdmin,
  updateAdmin,
  changePassword,
  deleteAdmin,
  getAllAdmins,
};
