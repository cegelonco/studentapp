const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable');
}

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided. Authentication required.' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired.' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Authentication error.' 
    });
  }
};

// Check if user is owner
const isOwner = (req, res, next) => {
  if (req.user.userType !== 'owner') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Owner privileges required.' 
    });
  }
  next();
};

// Check if user is student
const isStudent = (req, res, next) => {
  if (req.user.userType !== 'student') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Student privileges required.' 
    });
  }
  next();
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.userType !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

module.exports = { authenticate, isOwner, isStudent, isAdmin };



