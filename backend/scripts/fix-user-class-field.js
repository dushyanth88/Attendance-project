import mongoose from 'mongoose';
import Student from '../models/Student.js';
import User from '../models/User.js';
import config from '../config/config.js';

async function connectDB() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function fixUserClassField() {
  try {
    console.log('🔍 Finding students with incorrect User class field...');
    
    // Find all students
    const students = await Student.find({ status: 'active' });
    console.log(`📊 Found ${students.length} students in Student model`);
    
    let updatedCount = 0;
    
    for (const student of students) {
      // Find corresponding User record
      const user = await User.findById(student.userId);
      
      if (user && user.role === 'student') {
        // Generate correct class string with batch information
        const correctClassString = `${student.batch}, ${student.year}, Sem ${student.semester}`;
        
        console.log(`🔍 Student ${student.rollNumber} (${student.name}):`);
        console.log(`  - Current User class: "${user.class}"`);
        console.log(`  - Correct class should be: "${correctClassString}"`);
        
        if (user.class !== correctClassString) {
          // Update User class field
          await User.updateOne(
            { _id: user._id },
            { $set: { class: correctClassString } }
          );
          
          console.log(`  ✅ Updated User class field`);
          updatedCount++;
        } else {
          console.log(`  ✅ User class field is already correct`);
        }
      }
    }
    
    console.log(`\n🎉 Updated ${updatedCount} User records with correct class field`);
    
    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const user = await User.findOne({ email: 'kiran@example.com' });
    if (user) {
      console.log(`📊 User "dhu" class field is now: "${user.class}"`);
    }

  } catch (error) {
    console.error('❌ Error fixing User class field:', error);
    throw error;
  }
}

async function runFix() {
  try {
    await connectDB();
    await fixUserClassField();
    console.log('🎉 Fix completed successfully!');
  } catch (error) {
    console.error('💥 Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the fix
runFix();
