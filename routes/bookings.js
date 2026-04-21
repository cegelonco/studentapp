const express = require('express');
const router = express.Router();
const { authenticate, isStudent } = require('../middleware/auth');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const Notification = require('../models/Notification');

// Create booking (Student only)
router.post('/', authenticate, isStudent, async (req, res) => {
  try {
    const { propertyId, hasRoommate, roommateId, finalPrice } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide property ID'
      });
    }

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (!property.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Property is not available'
      });
    }

    const booking = new Booking({
      student: req.user._id,
      property: propertyId,
      owner: property.owner,
      price: property.price,
      finalPrice: finalPrice || property.price,
      hasRoommate: hasRoommate || false,
      roommate: roommateId || null,
      status: 'pending'
    });

    await booking.save();

    // Create notification for owner
    await Notification.create({
      user: property.owner,
      type: 'reservation',
      title: 'New Reservation Request',
      message: `${req.user.firstName} ${req.user.lastName} wants to book your property "${property.title}"`,
      icon: 'fa-calendar-check',
      relatedId: booking._id,
      relatedType: 'booking'
    });

    // Increment applicants count
    await Property.findByIdAndUpdate(propertyId, {
      $inc: { applicants: 1 }
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('student', 'firstName lastName email')
      .populate('property', 'title address price')
      .populate('owner', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: populatedBooking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating booking',
      error: error.message
    });
  }
});

// Confirm booking (after payment)
router.put('/:id/confirm', authenticate, async (req, res) => {
  try {
    const { paymentInfo } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is the student or owner
    const isStudent = booking.student.toString() === req.user._id.toString();
    const isOwner = booking.owner.toString() === req.user._id.toString();

    if (!isStudent && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only confirm your own bookings'
      });
    }

    booking.status = 'confirmed';
    booking.paymentDate = new Date();
    if (paymentInfo) {
      booking.paymentInfo = paymentInfo;
    }
    await booking.save();

    // Mark property as unavailable
    await Property.findByIdAndUpdate(booking.property, {
      isAvailable: false
    });

    // Create notification for owner
    if (isStudent) {
      await Notification.create({
        user: booking.owner,
        type: 'payment',
        title: 'Payment Received',
        message: `Payment of $${booking.finalPrice} received for "${booking.property.title}"`,
        icon: 'fa-dollar-sign',
        relatedId: booking._id,
        relatedType: 'booking'
      });
    }

    // Create notification for student
    await Notification.create({
      user: booking.student,
      type: 'reservation',
      title: 'Booking Confirmed',
      message: `Your booking for "${booking.property.title}" has been confirmed`,
      icon: 'fa-calendar-check',
      relatedId: booking._id,
      relatedType: 'booking'
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('student', 'firstName lastName email')
      .populate('property', 'title address price')
      .populate('owner', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: populatedBooking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error confirming booking',
      error: error.message
    });
  }
});

// Get user's bookings
router.get('/my-bookings', authenticate, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.userType === 'student') {
      query.student = req.user._id;
    } else if (req.user.userType === 'owner') {
      query.owner = req.user._id;
    }

    const bookings = await Booking.find(query)
      .populate('student', 'firstName lastName email phone phoneCode university department')
      .populate('property', 'title address price images')
      .populate('owner', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: error.message
    });
  }
});

// Get booking by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('student', 'firstName lastName email phone')
      .populate('property', 'title address price images amenities')
      .populate('owner', 'firstName lastName email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user has access
    const isStudent = booking.student._id.toString() === req.user._id.toString();
    const isOwner = booking.owner._id.toString() === req.user._id.toString();

    if (!isStudent && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching booking',
      error: error.message
    });
  }
});

// Cancel booking
router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user has permission
    const isStudent = booking.student.toString() === req.user._id.toString();
    const isOwner = booking.owner.toString() === req.user._id.toString();

    if (!isStudent && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own bookings'
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Mark property as available
    await Property.findByIdAndUpdate(booking.property, {
      isAvailable: true
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
});

module.exports = router;



