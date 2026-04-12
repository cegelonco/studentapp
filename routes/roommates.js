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
      const data = {
        student: req.user._id,
        university: req.user.university || null,
        department: req.user.department || null,
        isLookingForRoommate: true
      };
      if (req.user.age) data.age = req.user.age;
      if (req.user.budget && req.user.budget.min != null) data.budget = req.user.budget;
      roommate = new Roommate(data);
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

    // Filter out already connected roommates and invalid entries
    const connectedIds = currentRoommate?.connections
      .filter(c => c.user != null)
      .map(c => c.user.toString()) || [];
    const filtered = potentialRoommates.filter(r =>
      r.student != null && !connectedIds.includes(r.student._id.toString())
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

    // Find the roommate profile that contains this connection
    // (the connection lives on the SENDER's profile, not the receiver's)
    const senderRoommate = await Roommate.findOne({
      'connections._id': connectionId
    });

    if (!senderRoommate) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    const connection = senderRoommate.connections.id(connectionId);

    // Verify the current user is the TARGET of this connection
    if (connection.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to respond to this request'
      });
    }

    if (action === 'accept') {
      connection.status = 'accepted';

      // Also create a reverse connection on the receiver's profile
      let receiverRoommate = await Roommate.findOne({ student: req.user._id });
      if (!receiverRoommate) {
        receiverRoommate = new Roommate({ student: req.user._id, isLookingForRoommate: true });
      }
      const existingReverse = receiverRoommate.connections.find(
        c => c.user.toString() === senderRoommate.student.toString()
      );
      if (existingReverse) {
        existingReverse.status = 'accepted';
      } else {
        receiverRoommate.connections.push({
          user: senderRoommate.student,
          status: 'accepted'
        });
      }
      await receiverRoommate.save();

      // Create notification for the sender
      await Notification.create({
        user: senderRoommate.student,
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

    await senderRoommate.save();

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

// Get incoming pending requests
router.get('/requests', authenticate, isStudent, async (req, res) => {
  try {
    // Find all roommate profiles that have a pending connection to the current user
    const incoming = await Roommate.find({
      'connections.user': req.user._id,
      'connections.status': 'pending'
    }).populate('student', 'firstName lastName email university department age');

    const requests = incoming.map(r => {
      const conn = r.connections.find(
        c => c.user.toString() === req.user._id.toString() && c.status === 'pending'
      );
      return {
        connectionId: conn?._id,
        fromStudent: r.student,
        status: conn?.status,
        createdAt: conn?.createdAt
      };
    }).filter(r => r.connectionId);

    res.json({
      success: true,
      requests: requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching requests',
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



