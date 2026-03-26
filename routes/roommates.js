const express = require('express');
const router = express.Router();
const { authenticate, isStudent } = require('../middleware/auth');
const Roommate = require('../models/Roommate');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Get or create roommate profile
router.get('/profile', authenticate, isStudent, async (req, res) => {
  try {
    let roommate = await Roommate.findOne({ student: req.user._id });

    if (!roommate) {
      // Create roommate profile from user data
      roommate = new Roommate({
        student: req.user._id,
        age: req.user.age,
        university: req.user.university,
        department: req.user.department,
        budget: req.user.budget,
        isLookingForRoommate: true
      });
      await roommate.save();
    }

    const populatedRoommate = await Roommate.findById(roommate._id)
      .populate('student', 'firstName lastName email university department age')
      .populate('connections.user', 'firstName lastName email university department age');

    res.json({
      success: true,
      roommate: populatedRoommate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching roommate profile',
      error: error.message
    });
  }
});

// Update roommate profile
router.put('/profile', authenticate, isStudent, async (req, res) => {
  try {
    const { age, university, department, budget, isLookingForRoommate } = req.body;

    let roommate = await Roommate.findOne({ student: req.user._id });

    if (!roommate) {
      roommate = new Roommate({ student: req.user._id });
    }

    if (age !== undefined) roommate.age = age;
    if (university !== undefined) roommate.university = university;
    if (department !== undefined) roommate.department = department;
    if (budget !== undefined) roommate.budget = budget;
    if (isLookingForRoommate !== undefined) roommate.isLookingForRoommate = isLookingForRoommate;

    await roommate.save();

    // Also update user profile
    const userUpdates = {};
    if (age !== undefined) userUpdates.age = age;
    if (university !== undefined) userUpdates.university = university;
    if (department !== undefined) userUpdates.department = department;
    if (budget !== undefined) userUpdates.budget = budget;

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(req.user._id, { $set: userUpdates });
    }

    const populatedRoommate = await Roommate.findById(roommate._id)
      .populate('student', 'firstName lastName email university department age')
      .populate('connections.user', 'firstName lastName email university department age');

    res.json({
      success: true,
      message: 'Roommate profile updated successfully',
      roommate: populatedRoommate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating roommate profile',
      error: error.message
    });
  }
});

// Get potential roommates
router.get('/potential', authenticate, isStudent, async (req, res) => {
  try {
    const currentRoommate = await Roommate.findOne({ student: req.user._id });
    
    // Get all other students looking for roommates
    const potentialRoommates = await Roommate.find({
      student: { $ne: req.user._id },
      isLookingForRoommate: true
    })
    .populate('student', 'firstName lastName email university department age')
    .limit(20);

    // Filter out already connected roommates
    const connectedIds = currentRoommate?.connections.map(c => c.user.toString()) || [];
    const filtered = potentialRoommates.filter(r => 
      !connectedIds.includes(r.student._id.toString())
    );

    res.json({
      success: true,
      roommates: filtered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching potential roommates',
      error: error.message
    });
  }
});

// Connect with roommate
router.post('/connect/:roommateId', authenticate, isStudent, async (req, res) => {
  try {
    const { roommateId } = req.params;

    const targetRoommate = await Roommate.findOne({ student: roommateId });
    if (!targetRoommate) {
      return res.status(404).json({
        success: false,
        message: 'Roommate profile not found'
      });
    }

    let currentRoommate = await Roommate.findOne({ student: req.user._id });
    if (!currentRoommate) {
      currentRoommate = new Roommate({ student: req.user._id });
      await currentRoommate.save();
    }

    // Check if already connected
    const existingConnection = currentRoommate.connections.find(
      c => c.user.toString() === roommateId
    );

    if (existingConnection) {
      return res.status(400).json({
        success: false,
        message: 'Already connected with this roommate'
      });
    }

    // Add connection
    currentRoommate.connections.push({
      user: roommateId,
      status: 'pending'
    });
    await currentRoommate.save();

    // Create notification for target roommate
    await Notification.create({
      user: roommateId,
      type: 'roommate',
      title: 'New Roommate Request',
      message: `${req.user.firstName} ${req.user.lastName} wants to connect with you as a roommate`,
      icon: 'fa-user-plus',
      relatedId: req.user._id,
      relatedType: 'roommate'
    });

    res.json({
      success: true,
      message: 'Roommate connection request sent'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error connecting with roommate',
      error: error.message
    });
  }
});

// Accept/reject roommate connection
router.put('/connection/:connectionId', authenticate, isStudent, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be "accept" or "reject"'
      });
    }

    const roommate = await Roommate.findOne({
      'connections._id': connectionId,
      student: req.user._id
    });

    if (!roommate) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    const connection = roommate.connections.id(connectionId);
    if (action === 'accept') {
      connection.status = 'accepted';
      
      // Also update the other roommate's connection
      const otherRoommate = await Roommate.findOne({ student: connection.user });
      if (otherRoommate) {
        const otherConnection = otherRoommate.connections.find(
          c => c.user.toString() === req.user._id.toString()
        );
        if (otherConnection) {
          otherConnection.status = 'accepted';
          await otherRoommate.save();
        }
      }

      // Create notification
      await Notification.create({
        user: connection.user,
        type: 'roommate',
        title: 'Roommate Connection Accepted',
        message: `${req.user.firstName} ${req.user.lastName} accepted your roommate connection request`,
        icon: 'fa-user-check',
        relatedId: req.user._id,
        relatedType: 'roommate'
      });
    } else {
      connection.status = 'rejected';
    }

    await roommate.save();

    res.json({
      success: true,
      message: `Roommate connection ${action}ed successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating roommate connection',
      error: error.message
    });
  }
});

// Get connected roommates
router.get('/connections', authenticate, isStudent, async (req, res) => {
  try {
    const roommate = await Roommate.findOne({ student: req.user._id })
      .populate('connections.user', 'firstName lastName email university department age budget');

    if (!roommate) {
      return res.json({
        success: true,
        connections: []
      });
    }

    const acceptedConnections = roommate.connections.filter(c => c.status === 'accepted');

    res.json({
      success: true,
      connections: acceptedConnections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching connections',
      error: error.message
    });
  }
});

module.exports = router;



