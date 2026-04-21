const mongoose = require('mongoose');

const roommateSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  age: {
    type: Number,
    default: null
  },
  university: {
    type: String,
    default: null
  },
  department: {
    type: String,
    default: null
  },
  budget: {
    min: { type: Number, default: null },
    max: { type: Number, default: null }
  },
  isLookingForRoommate: {
    type: Boolean,
    default: true
  },
  connections: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
roommateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Roommate', roommateSchema);



