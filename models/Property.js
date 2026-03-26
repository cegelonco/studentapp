const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: 'USA' },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    }
  },
  images: [{
    type: String,
    default: []
  }],
  size: {
    type: String,
    default: null
  },
  
  price: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['apartment', 'house', 'studio', 'dorm'],
    default: 'apartment'
  },
  rooms: {
    type: Number,
    default: 1,
    min: 1
  },
  floor: {
    type: Number,
    default: null
  },
  amenities: [{
    type: String
  }],
  offer: {
    type: String,
    default: null
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  applicants: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp
propertySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Property', propertySchema);



