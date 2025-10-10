/**
 * Simple migration script to add classId to existing student records
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Student from '../models/Student.js';

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

async function migrateStudentClassIds() {
  try {
    console.log('🔧 Starting classId migration...');
    
    // Find all students without classId
    const students = await Student.find({
      $or: [
        { classId: { $exists: false } },
        { classId: null },
        { classId: '' }
      ]
    });
    
    console.log(`📊 Found ${students.length} students to migrate`);
    
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
        
        await Student.updateOne(
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
    console.error('❌ Migration error:', error);
    throw error;
  }
}

async function runMigration() {
  try {
    console.log('🚀 Starting Student classId migration...\n');
    
    await connectDB();
    await migrateStudentClassIds();
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
}

// Run migration
runMigration();
