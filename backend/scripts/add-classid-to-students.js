/**
 * Simple script to add classId to existing student records
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-tracker';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function addClassIdToStudents() {
  try {
    console.log('🔧 Adding classId to existing students...');
    
    // Get the students collection directly
    const studentsCollection = mongoose.connection.db.collection('students');
    
    // Find all students without classId
    const students = await studentsCollection.find({
      $or: [
        { classId: { $exists: false } },
        { classId: null },
        { classId: '' }
      ]
    }).toArray();
    
    console.log(`📊 Found ${students.length} students to update`);
    
    if (students.length === 0) {
      console.log('✅ All students already have classId');
      return;
    }
    
    // Update each student
    let updatedCount = 0;
    for (const student of students) {
      try {
        // Generate classId from existing fields
        const classId = `${student.batch}_${student.year}_${student.semester}_${student.section || 'A'}`;
        
        await studentsCollection.updateOne(
          { _id: student._id },
          { 
            $set: { 
              classId: classId,
              section: student.section || 'A'
            }
          }
        );
        
        console.log(`✅ Updated ${student.rollNumber}: ${classId}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Error updating ${student.rollNumber}:`, error.message);
      }
    }
    
    console.log(`✅ Successfully updated ${updatedCount} students`);
    
  } catch (error) {
    console.error('❌ Error adding classId:', error);
    throw error;
  }
}

async function runScript() {
  try {
    console.log('🚀 Starting classId addition script...\n');
    
    await connectDB();
    await addClassIdToStudents();
    
    console.log('\n🎉 Script completed successfully!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
}

// Run script
runScript();
