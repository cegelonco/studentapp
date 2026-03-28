const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable');
}

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

// Generate verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, phoneCode, userType, ...additionalData } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    console.log('Generated verification code for registration:', verificationCode);
    console.log('User email:', email.toLowerCase());
    console.log('User firstName:', firstName);

    // Create user data
    const userData = {
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phone,
      phoneCode: phoneCode || '+1',
      userType,
      emailVerificationCode: verificationCode,
      isEmailVerified: false
    };

    // Add user type specific fields
    if (userType === 'student') {
      userData.university = additionalData.university || null;
      userData.department = additionalData.department || null;
      userData.age = additionalData.age || null;
      userData.budget = additionalData.budget || null;
      userData.studentIdFile = additionalData.studentIdFile || null;
    } else if (userType === 'owner') {
      userData.rating = 0;
      userData.totalProperties = 0;
      userData.responseTime = '< 2 hours';
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Return response immediately, send email in background
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationCode;

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification code.',
      user: userResponse
    });

    // Send verification email in background (fire-and-forget)
    sendVerificationEmail(email, firstName, verificationCode)
      .then(() => console.log('Verification email sent successfully to', email))
      .catch((emailError) => console.error('Failed to send verification email:', emailError.message));
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if email is verified (skip for admin users)
    if (!user.isEmailVerified && user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        requiresVerification: true
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationCode;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and verification code'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.emailVerificationCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationCode = null;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationCode;

    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying email',
      error: error.message
    });
  }
});

// Resend verification code
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    user.emailVerificationCode = verificationCode;
    await user.save();

    // Respond immediately, send email in background
    res.json({
      success: true,
      message: 'Verification code sent to your email'
    });

    sendVerificationEmail(email, user.firstName, verificationCode)
      .then(() => console.log('Resend verification email sent to', email))
      .catch((emailError) => console.error('Failed to resend verification email:', emailError.message));
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending verification code',
      error: error.message
    });
  }
});

// Forgot password - send reset code
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({
        success: true,
        message: 'If email exists, reset code has been sent'
      });
    }

    // Generate reset code
    const resetCode = generateVerificationCode();
    user.emailVerificationCode = resetCode;
    await user.save();

    // Respond immediately, send email in background
    res.json({
      success: true,
      message: 'Password reset code sent to your email'
    });

    sendPasswordResetEmail(email, user.firstName, resetCode)
      .then(() => console.log('Password reset email sent to', email))
      .catch((emailError) => console.error('Failed to send password reset email:', emailError.message));
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing forgot password request',
      error: error.message
    });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, code, and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.emailVerificationCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset code'
      });
    }

    // Update password
    user.password = newPassword;
    user.emailVerificationCode = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
});

module.exports = router;



