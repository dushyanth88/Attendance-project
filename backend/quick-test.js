import mongoose from 'mongoose';
import User from './models/User.js';
import config from './config/config.js';

const quickTest = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if users exist
    const userCount = await User.countDocuments();
    console.log(`📊 Current users in database: ${userCount}`);

    if (userCount === 0) {
      console.log('👥 No users found. Creating sample users...');
      
      // Create users one by one
      const users = [
        {
          name: 'System Admin',
          email: 'admin@attendance.com',
          password: 'admin123',
          role: 'admin'
        },
        {
          name: 'Dr. Sarah Johnson',
          email: 'principal@attendance.com',
          password: 'principal123',
          role: 'principal'
        },
        {
          name: 'Prof. Michael Chen',
          email: 'hod@attendance.com',
          password: 'hod123',
          role: 'hod',
          department: 'Computer Science'
        },
        {
          name: 'Dr. Emily Davis',
          email: 'faculty@attendance.com',
          password: 'faculty123',
          role: 'faculty',
          department: 'Computer Science'
        },
        {
          name: 'John Smith',
          email: 'student@attendance.com',
          password: 'student123',
          role: 'student',
          department: 'Computer Science'
        }
      ];

      for (const userData of users) {
        const user = new User(userData);
        await user.save();
        console.log(`✅ Created ${userData.role.toUpperCase()}: ${userData.email}`);
      }
    } else {
      console.log('👥 Users already exist. Listing them:');
      const users = await User.find({}, 'name email role department');
      users.forEach(user => {
        console.log(`   ${user.role.toUpperCase()}: ${user.email} (${user.name})`);
      });
    }

    // Test a specific user lookup
    console.log('\n🧪 Testing user lookup...');
    const testUser = await User.findOne({ email: 'student@attendance.com' });
    if (testUser) {
      console.log('✅ Found test user:', testUser.email);
      console.log('   Role:', testUser.role);
      console.log('   Department:', testUser.department);
      console.log('   Password hash length:', testUser.password.length);
      
      // Test password comparison
      const bcrypt = await import('bcryptjs');
      const isMatch = await bcrypt.compare('student123', testUser.password);
      console.log('   Password "student123" matches:', isMatch);
    } else {
      console.log('❌ Test user not found');
    }

    console.log('\n🎉 Database setup complete!');
    console.log('🚀 You can now start the server with: npm run dev');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

quickTest();
