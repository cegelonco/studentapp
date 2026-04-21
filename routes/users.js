const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const Roommate = require('../models/Roommate');

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -emailVerificationCode');
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
});

// Update user profile
router.put('/me', authenticate, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password; // Don't allow password update through this route
    delete updates.email; // Don't allow email update
    delete updates.userType; // Don't allow userType update

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -emailVerificationCode');

    // Keep the Roommate profile in sync with User fields so that the
    // same-university discovery filter stays correct when a student
    // updates their university / department / age / budget.
    if (user && user.userType === 'student') {
      const roommateUpdates = {};
      if (updates.university !== undefined) roommateUpdates.university = updates.university;
      if (updates.department !== undefined) roommateUpdates.department = updates.department;
      if (updates.age !== undefined) roommateUpdates.age = updates.age;
      if (updates.budget !== undefined) roommateUpdates.budget = updates.budget;

      if (Object.keys(roommateUpdates).length > 0) {
        await Roommate.findOneAndUpdate(
          { student: req.user._id },
          { $set: roommateUpdates },
          { new: true }
        );
      }
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -emailVerificationCode');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

module.exports = router;



