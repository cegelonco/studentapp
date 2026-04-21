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
      .populate('student', 'firstName lastName email userType university department age phone phoneCode')
      .populate('connections.user', 'firstName lastName email userType university department age phone phoneCode');

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
      .populate('student', 'firstName lastName email userType university department age phone phoneCode')
      .populate('connections.user', 'firstName lastName email userType university department age phone phoneCode');

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

// Get potential roommates (same university only)
router.get('/potential', authenticate, isStudent, async (req, res) => {
  try {
    const currentUniversity = req.user.university;

    // If current user has not set their university, we cannot match them
    if (!currentUniversity) {
      return res.json({
        success: true,
        roommates: [],
        message: 'Please set your university in your profile to discover roommates'
      });
    }

    const currentRoommate = await Roommate.findOne({ student: req.user._id });

    // Find all OTHER students from the SAME university.
    // We query Users directly so that students who haven't yet opened the
    // roommates tab (and therefore don't have a Roommate document) still
    // appear to their peers.
    const sameUniStudents = await User.find({
      _id: { $ne: req.user._id },
      userType: 'student',
      university: currentUniversity
    }).select('_id firstName lastName email userType university department age phone phoneCode budget');

    if (sameUniStudents.length === 0) {
      return res.json({ success: true, roommates: [] });
    }

    const studentIds = sameUniStudents.map(u => u._id);

    // Auto-provision a Roommate profile for any same-university student
    // that doesn't have one yet, so they become discoverable.
    const existingRoommates = await Roommate.find({ student: { $in: studentIds } });
    const existingStudentIds = new Set(existingRoommates.map(r => r.student.toString()));

    const toCreate = sameUniStudents
      .filter(u => !existingStudentIds.has(u._id.toString()))
      .map(u => {
        const doc = {
          student: u._id,
          university: u.university || null,
          department: u.department || null,
          isLookingForRoommate: true
        };
        if (u.age != null) doc.age = u.age;
        if (u.budget && u.budget.min != null) doc.budget = u.budget;
        return doc;
      });

    if (toCreate.length > 0) {
      try {
        await Roommate.insertMany(toCreate, { ordered: false });
      } catch (e) {
        // Ignore duplicate-key or partial-insert errors; we'll re-query below.
      }
    }

    // Fetch the full list of discoverable roommates from the same university.
    const potentialRoommates = await Roommate.find({
      student: { $in: studentIds },
      isLookingForRoommate: true
    })
      .populate('student', 'firstName lastName email userType university department age phone phoneCode')
      .limit(100);

    // Exclude students the current user already has a pending/accepted
    // connection with, plus any orphaned docs whose student was deleted.
    const connectedIds = (currentRoommate?.connections || [])
      .filter(c => c.user != null && c.status !== 'rejected')
      .map(c => c.user.toString());

    // Also exclude students who have a PENDING incoming request to this
    // user — they live on the Requests tab, not Discover.
    const incomingPending = await Roommate.find({
      'connections.user': req.user._id,
      'connections.status': 'pending'
    }).select('student');
    const incomingSenderIds = incomingPending
      .filter(r => r.student != null)
      .map(r => r.student.toString());

    const excludeIds = new Set([...connectedIds, ...incomingSenderIds]);

    const filtered = potentialRoommates.filter(r =>
      r.student != null && !excludeIds.has(r.student._id.toString())
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
        c => c.user != null && c.user.toString() === senderRoommate.student.toString()
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
    }).populate('student', 'firstName lastName email userType university department age phone phoneCode');

    const requests = incoming.map(r => {
      const conn = r.connections.find(
        c => c.user != null && c.user.toString() === req.user._id.toString() && c.status === 'pending'
      );
      return {
        connectionId: conn?._id,
        fromStudent: r.student,
        status: conn?.status,
        createdAt: conn?.createdAt
      };
    }).filter(r => r.connectionId && r.fromStudent);

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
    const roommate = await Roommate.findOne({ student: req.user._id });

    if (!roommate) {
      return res.json({
        success: true,
        connections: []
      });
    }

    const acceptedConnections = roommate.connections.filter(
      c => c.status === 'accepted' && c.user != null
    );

    if (acceptedConnections.length === 0) {
      return res.json({ success: true, connections: [] });
    }

    // The client's ConnectionDto expects `user` to be a RoommateDto with a
    // nested `student` field (UserDto). Fetch each connected user's Roommate
    // profile and return that full shape so names/universities render.
    const userIds = acceptedConnections.map(c => c.user);
    const connectedRoommates = await Roommate.find({ student: { $in: userIds } })
      .populate('student', 'firstName lastName email userType university department age phone phoneCode');

    const byStudentId = new Map(
      connectedRoommates
        .filter(r => r.student != null)
        .map(r => [r.student._id.toString(), r])
    );

    const connections = acceptedConnections
      .map(c => ({
        user: byStudentId.get(c.user.toString()) || null,
        status: c.status,
        createdAt: c.createdAt
      }))
      .filter(c => c.user != null);

    res.json({
      success: true,
      connections
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



