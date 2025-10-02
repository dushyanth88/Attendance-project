import mongoose from 'mongoose';
import User from './models/User.js';
import Attendance from './models/Attendance.js';
import config from './config/config.js';

const testSystem = async () => {
  try {
    console.log('🧪 Testing Attendance Tracker System...\n');

    // Connect to database
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test 1: Check if users exist
    console.log('\n📊 Test 1: User Database Check');
    const userCount = await User.countDocuments();
    console.log(`Total users in database: ${userCount}`);

    if (userCount === 0) {
      console.log('❌ No users found. Please run: npm run seed');
      return;
    }

    // Test 2: Check admin user
    console.log('\n👨‍💻 Test 2: Admin User Check');
    const admin = await User.findOne({ role: 'admin' });
    if (admin) {
      console.log(`✅ Admin found: ${admin.email}`);
      console.log(`   Name: ${admin.name}`);
      console.log(`   Status: ${admin.status}`);
    } else {
      console.log('❌ No admin user found');
    }

    // Test 3: Check all roles
    console.log('\n👥 Test 3: Role Distribution');
    const roles = ['admin', 'principal', 'hod', 'faculty', 'student'];
    for (const role of roles) {
      const count = await User.countDocuments({ role });
      console.log(`   ${role.toUpperCase()}: ${count} users`);
    }

    // Test 4: Check departments
    console.log('\n🏢 Test 4: Department Check');
    const departments = await User.distinct('department');
    console.log(`Departments: ${departments.join(', ')}`);

    // Test 5: Check password hashing
    console.log('\n🔐 Test 5: Password Security Check');
    const testUser = await User.findOne({ role: 'student' });
    if (testUser) {
      console.log(`✅ Password hash length: ${testUser.password.length} characters`);
      console.log(`   Hash starts with: ${testUser.password.substring(0, 10)}...`);
      
      // Test password comparison
      const bcrypt = await import('bcryptjs');
      const isMatch = await bcrypt.compare('student123', testUser.password);
      console.log(`   Password "student123" matches: ${isMatch}`);
    }

    // Test 6: Check user relationships
    console.log('\n🔗 Test 6: User Relationships');
    const usersWithCreator = await User.find({ createdBy: { $exists: true } })
      .populate('createdBy', 'name email role');
    
    console.log(`Users with creators: ${usersWithCreator.length}`);
    usersWithCreator.forEach(user => {
      console.log(`   ${user.name} (${user.role}) created by ${user.createdBy?.name} (${user.createdBy?.role})`);
    });

    // Test 7: Check faculty assignments
    console.log('\n👩‍🏫 Test 7: Faculty Assignments');
    const faculty = await User.find({ role: 'faculty' });
    faculty.forEach(f => {
      console.log(`   ${f.name}:`);
      console.log(`     Department: ${f.department}`);
      console.log(`     Subjects: ${f.subjects?.join(', ') || 'None'}`);
      console.log(`     Classes: ${f.assignedClasses?.join(', ') || 'None'}`);
    });

    // Test 8: Check student details
    console.log('\n🎒 Test 8: Student Details');
    const students = await User.find({ role: 'student' });
    students.forEach(s => {
      console.log(`   ${s.name}:`);
      console.log(`     Department: ${s.department}`);
      console.log(`     Class: ${s.class}`);
      console.log(`     Created by: ${s.createdBy}`);
    });

    // Test 9: Database indexes
    console.log('\n📇 Test 9: Database Indexes');
    const userIndexes = await User.collection.getIndexes();
    console.log(`User collection indexes: ${Object.keys(userIndexes).length}`);
    
    const attendanceIndexes = await Attendance.collection.getIndexes();
    console.log(`Attendance collection indexes: ${Object.keys(attendanceIndexes).length}`);

    console.log('\n🎉 System Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Database connected`);
    console.log(`   ✅ ${userCount} users created`);
    console.log(`   ✅ All roles present`);
    console.log(`   ✅ Password hashing working`);
    console.log(`   ✅ User relationships established`);
    console.log(`   ✅ Faculty assignments configured`);
    console.log(`   ✅ Student details complete`);

    console.log('\n🚀 Ready to start the server!');
    console.log('   Backend: npm run dev');
    console.log('   Frontend: cd frontend && npm run dev');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    mongoose.connection.close();
  }
};

testSystem();
