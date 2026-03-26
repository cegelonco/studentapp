const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  phoneCode: {
    type: String,
    default: '+1'
  },
  userType: {
    type: String,
    enum: ['student', 'owner', 'admin'],
    required: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationCode: {
    type: String,
    default: null
  },
  // Student specific fields
  studentId: {
    type: String,
    default: null
  },
  studentIdFile: {
    type: String,
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
  age: {
    type: Number,
    default: null
  },
  // Owner specific fields
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalProperties: {
    type: Number,
    default: 0
  },
  responseTime: {
    type: String,
    default: null
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update timestamp
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);

