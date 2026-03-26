const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Property = require('../models/Property');

// All admin routes require authentication and admin privileges
router.use(authenticate);
router.use(isAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -emailVerificationCode')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// Get all properties
router.get('/properties', async (req, res) => {
  try {
    const properties = await Property.find()
      .populate('owner', 'firstName lastName email userType')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      properties
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
});

module.exports = router;

