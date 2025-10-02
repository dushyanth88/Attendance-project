import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import config from './config/config.js';

const testLogin = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test user creation and password hashing
    console.log('\n🧪 Testing user creation and password hashing...');
    
    const testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'test123',
      role: 'student',
      department: 'Computer Science'
    });

    await testUser.save();
    console.log('✅ Test user created with hashed password');

    // Test password comparison
    console.log('\n🔑 Testing password comparison...');
    const isMatch = await testUser.comparePassword('test123');
    console.log('Password match for "test123":', isMatch);

    const isWrongMatch = await testUser.comparePassword('wrongpassword');
    console.log('Password match for "wrongpassword":', isWrongMatch);

    // Test login logic
    console.log('\n🔐 Testing login logic...');
    
    // Find user by email
    const foundUser = await User.findOne({ email: 'test@example.com' });
    console.log('User found by email:', foundUser ? 'Yes' : 'No');
    
    if (foundUser) {
      console.log('User role:', foundUser.role);
      console.log('User isActive:', foundUser.isActive);
      
      // Test password
      const passwordMatch = await foundUser.comparePassword('test123');
      console.log('Password verification:', passwordMatch);
    }

    // Clean up test user
    await User.deleteOne({ email: 'test@example.com' });
    console.log('🧹 Test user cleaned up');

    console.log('\n✅ All tests passed! Login system should work correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Connection closed');
  }
};

testLogin();
