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

async function fixSemesterFormat() {
  try {
    console.log('🔍 Fixing semester format in User class field...');
    
    // Find all student users
    const users = await User.find({ role: 'student' });
    console.log(`📊 Found ${users.length} student users`);
    
    let updatedCount = 0;
    
    for (const user of users) {
      if (user.class && user.class.includes('Sem Sem')) {
        // Fix the double "Sem" issue
        const correctedClass = user.class.replace('Sem Sem', 'Sem');
        
        console.log(`🔍 User ${user.name}:`);
        console.log(`  - Current class: "${user.class}"`);
        console.log(`  - Corrected class: "${correctedClass}"`);
        
        await User.updateOne(
          { _id: user._id },
          { $set: { class: correctedClass } }
        );
        
        console.log(`  ✅ Updated User class field`);
        updatedCount++;
      }
    }
    
    console.log(`\n🎉 Fixed semester format in ${updatedCount} User records`);
    
    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const user = await User.findOne({ email: 'kiran@example.com' });
    if (user) {
      console.log(`📊 User "dhu" class field is now: "${user.class}"`);
    }

  } catch (error) {
    console.error('❌ Error fixing semester format:', error);
    throw error;
  }
}

async function runFix() {
  try {
    await connectDB();
    await fixSemesterFormat();
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
