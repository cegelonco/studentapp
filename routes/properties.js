const express = require('express');
const router = express.Router();
const { authenticate, isOwner } = require('../middleware/auth');
const Property = require('../models/Property');
const User = require('../models/User');

// Get all properties with filters
router.get('/', async (req, res) => {
  try {
    const {
      type,
      minPrice,
      maxPrice,
      minRooms,
      maxRooms,
      floor,
      city,
      amenities,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const query = { isAvailable: true };

    // Apply filters
    if (type && type !== 'ALL') query.type = type;
    if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };
    if (minRooms) query.rooms = { ...query.rooms, $gte: Number(minRooms) };
    if (maxRooms) query.rooms = { ...query.rooms, $lte: Number(maxRooms) };
    if (floor) query.floor = Number(floor);
    if (city) query['location.city'] = new RegExp(city, 'i');
    if (amenities) {
      const amenityArray = Array.isArray(amenities) ? amenities : [amenities];
      query.amenities = { $in: amenityArray };
    }
    if (search) {
      // Map search terms to property types for better matching
      const searchLower = search.toLowerCase();
      const typeMatches = [];
      if (searchLower.includes('studio') || searchLower === 'studio') typeMatches.push('studio');
      if (searchLower.includes('apartment') || searchLower === 'apartment' || searchLower.includes('apt')) typeMatches.push('apartment');
      if (searchLower.includes('house') || searchLower === 'house') typeMatches.push('house');
      if (searchLower.includes('dorm') || searchLower === 'dorm' || searchLower.includes('dormitory')) typeMatches.push('dorm');
      
      const searchConditions = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { address: new RegExp(search, 'i') },
        { 'location.city': new RegExp(search, 'i') },
        { 'location.state': new RegExp(search, 'i') }
      ];
      
      // Add type matches if found
      if (typeMatches.length > 0) {
        searchConditions.push({ type: { $in: typeMatches } });
      }
      
      // Add amenities search
      searchConditions.push({ amenities: new RegExp(search, 'i') });
      
      query.$or = searchConditions;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const properties = await Property.find(query)
      .populate('owner', 'firstName lastName email phone phoneCode rating totalProperties responseTime')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Property.countDocuments(query);

    res.json({
      success: true,
      properties,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
});

// Get property by ID
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('owner', 'firstName lastName email phone phoneCode rating totalProperties responseTime');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.json({
      success: true,
      property
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching property',
      error: error.message
    });
  }
});

// Create new property (Owner only)
router.post('/', authenticate, isOwner, async (req, res) => {
  try {
    const {
      title,
      description,
      address,
      location,
      images,
      size,
      sizeSqFt,
      price,
      type,
      rooms,
      floor,
      amenities,
      offer
    } = req.body;

    if (!title || !address || !price) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, address, and price'
      });
    }

    const property = new Property({
      owner: req.user._id,
      title,
      description: description || '',
      address,
      location: location || {},
      images: images || [],
      size,
      sizeSqFt,
      price: Number(price),
      type: type || 'apartment',
      rooms: Number(rooms) || 1,
      floor: floor ? Number(floor) : null,
      amenities: amenities || [],
      offer: offer || null,
      isAvailable: true,
      applicants: 0
    });

    await property.save();

    // Update owner's total properties count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalProperties: 1 }
    });

    const populatedProperty = await Property.findById(property._id)
      .populate('owner', 'firstName lastName email phone rating totalProperties responseTime');

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      property: populatedProperty
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating property',
      error: error.message
    });
  }
});

// Update property (Owner only)
router.put('/:id', authenticate, isOwner, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user owns this property
    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own properties'
      });
    }

    const updates = req.body;
    delete updates.owner; // Don't allow owner change
    delete updates.applicants; // Don't allow direct applicants update

    Object.assign(property, updates);
    await property.save();

    const populatedProperty = await Property.findById(property._id)
      .populate('owner', 'firstName lastName email phone rating totalProperties responseTime');

    res.json({
      success: true,
      message: 'Property updated successfully',
      property: populatedProperty
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating property',
      error: error.message
    });
  }
});

// Delete property (Owner only)
router.delete('/:id', authenticate, isOwner, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user owns this property
    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own properties'
      });
    }

    await Property.findByIdAndDelete(req.params.id);

    // Update owner's total properties count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalProperties: -1 }
    });

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting property',
      error: error.message
    });
  }
});

// Get owner's properties
router.get('/owner/my-properties', authenticate, isOwner, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      properties
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching your properties',
      error: error.message
    });
  }
});

// Increment applicants count
router.post('/:id/increment-applicants', async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { $inc: { applicants: 1 } },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.json({
      success: true,
      applicants: property.applicants
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating applicants count',
      error: error.message
    });
  }
});

module.exports = router;



