const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const Property = require('../models/Property');

// Get user's favorites
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.favorites || user.favorites.length === 0) {
      return res.json({
        success: true,
        favorites: []
      });
    }

    const properties = await Property.find({ _id: { $in: user.favorites } })
      .populate('owner', 'firstName lastName email rating totalProperties responseTime');

    res.json({
      success: true,
      favorites: properties
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching favorites',
      error: error.message
    });
  }
});

// Add property to favorites
router.post('/:propertyId', authenticate, async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const user = await User.findById(req.user._id);

    // Check if already favorited
    if (user.favorites && user.favorites.includes(propertyId)) {
      return res.status(400).json({
        success: false,
        message: 'Property already in favorites'
      });
    }

    // Add to favorites
    if (!user.favorites) {
      user.favorites = [];
    }
    user.favorites.push(propertyId);
    await user.save();

    res.json({
      success: true,
      message: 'Property added to favorites',
      favorites: user.favorites
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding to favorites',
      error: error.message
    });
  }
});

// Remove property from favorites
router.delete('/:propertyId', authenticate, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const user = await User.findById(req.user._id);

    if (!user.favorites || !user.favorites.includes(propertyId)) {
      return res.status(400).json({
        success: false,
        message: 'Property not in favorites'
      });
    }

    // Remove from favorites
    user.favorites = user.favorites.filter(
      id => id.toString() !== propertyId
    );
    await user.save();

    res.json({
      success: true,
      message: 'Property removed from favorites',
      favorites: user.favorites
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removing from favorites',
      error: error.message
    });
  }
});

// Check if property is favorited
router.get('/check/:propertyId', authenticate, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const user = await User.findById(req.user._id);
    const isFavorited = user.favorites && user.favorites.includes(propertyId);

    res.json({
      success: true,
      isFavorited
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking favorite status',
      error: error.message
    });
  }
});

module.exports = router;



