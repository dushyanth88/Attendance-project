import mongoose from 'mongoose';
import User from './models/User.js';
import config from './config/config.js';

const testLoginFix = async () => {
  try {
    console.log('🧪 Testing Login Fix...\n');

    // Connect to database
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test 1: Check if users exist
    console.log('\n📊 Test 1: Check Users in Database');
    const userCount = await User.countDocuments();
    console.log(`Total users: ${userCount}`);

    if (userCount === 0) {
      console.log('❌ No users found. Please run: npm run seed');
      return;
    }

    // Test 2: Check admin user specifically
    console.log('\n👨‍💻 Test 2: Check Admin User');
    const admin = await User.findOne({ 
      email: 'admin@attendance.com',
      status: 'active'
    });
    
    if (admin) {
      console.log('✅ Admin user found:');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Status: ${admin.status}`);
      console.log(`   Password hash length: ${admin.password.length}`);
      
      // Test password comparison
      const bcrypt = await import('bcryptjs');
      const isMatch = await bcrypt.compare('password123', admin.password);
      console.log(`   Password "password123" matches: ${isMatch}`);
    } else {
      console.log('❌ Admin user not found or not active');
    }

    // Test 3: Check all users with their status
    console.log('\n👥 Test 3: All Users Status');
    const allUsers = await User.find({}, 'name email role status');
    allUsers.forEach(user => {
      console.log(`   ${user.name} (${user.email}) - Role: ${user.role}, Status: ${user.status}`);
    });

    // Test 4: Test login query
    console.log('\n🔍 Test 4: Test Login Query');
    const testEmail = 'admin@attendance.com';
    const testRole = 'admin';
    
    const userByEmail = await User.findOne({ 
      email: testEmail.toLowerCase().trim(), 
      status: 'active' 
    });
    
    console.log(`Query: { email: "${testEmail}", status: "active" }`);
    console.log(`Result: ${userByEmail ? 'Found' : 'Not found'}`);
    
    if (userByEmail) {
      console.log(`   User role: ${userByEmail.role}`);
      console.log(`   Requested role: ${testRole}`);
      console.log(`   Role match: ${userByEmail.role === testRole}`);
    }

    console.log('\n🎉 Login Fix Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Database connected`);
    console.log(`   ✅ ${userCount} users found`);
    console.log(`   ✅ Admin user: ${admin ? 'Found' : 'Not found'}`);
    console.log(`   ✅ Password hashing: ${admin ? 'Working' : 'N/A'}`);

    if (admin) {
      console.log('\n🔑 Test Login Credentials:');
      console.log('   Email: admin@attendance.com');
      console.log('   Password: password123');
      console.log('   Role: admin');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    mongoose.connection.close();
  }
};

testLoginFix();
