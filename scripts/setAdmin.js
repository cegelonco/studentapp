const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://fayez:7atoun1234@webcluster.ryugoh0.mongodb.net/student_housing?retryWrites=true&w=majority&appName=webcluster';

async function setAdmin() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const email = 'fayezharb8@gmail.com';
    const password = 'fayez123';

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create admin user if doesn't exist
      console.log('Creating new admin user...');
      user = new User({
        firstName: 'Fayez',
        lastName: 'Harb',
        email: email.toLowerCase(),
        password: password,
        userType: 'admin',
        isEmailVerified: true
      });
      await user.save();
      console.log('✅ Admin user created successfully');
    } else {
      // Update existing user to admin
      console.log('Updating existing user to admin...');
      user.userType = 'admin';
      user.isEmailVerified = true;
      await user.save();
      console.log('✅ User updated to admin successfully');
    }

    console.log('Admin user details:');
    console.log(`Email: ${user.email}`);
    console.log(`User Type: ${user.userType}`);
    console.log(`Email Verified: ${user.isEmailVerified}`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

setAdmin();

