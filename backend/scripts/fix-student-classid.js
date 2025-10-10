/**
 * Migration script to fix null classId values in existing student records
 * and update the database schema
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

async function fixStudentClassIds() {
  try {
    console.log('🔧 Starting classId migration...');
    
    // Find all students with null or missing classId
    const studentsWithoutClassId = await Student.find({
      $or: [
        { classId: { $exists: false } },
        { classId: null },
        { classId: '' }
      ]
    });
    
    console.log(`📊 Found ${studentsWithoutClassId.length} students without classId`);
    
    if (studentsWithoutClassId.length === 0) {
      console.log('✅ All students already have classId');
      return;
    }
    
    // Update each student with a proper classId
    let updatedCount = 0;
    for (const student of studentsWithoutClassId) {
      try {
        // Generate classId from existing fields
        const classId = `${student.batch}_${student.year}_${student.semester}_${student.section || 'A'}`;
        
        await Student.updateOne(
          { _id: student._id },
          { 
            $set: { 
              classId: classId,
              // Also ensure section is set if missing
              section: student.section || 'A'
            }
          }
        );
        
        console.log(`✅ Updated student ${student.rollNumber}: ${classId}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Error updating student ${student.rollNumber}:`, error.message);
      }
    }
    
    console.log(`✅ Successfully updated ${updatedCount} students`);
    
    // Verify the fix
    const remainingStudents = await Student.find({
      $or: [
        { classId: { $exists: false } },
        { classId: null },
        { classId: '' }
      ]
    });
    
    if (remainingStudents.length === 0) {
      console.log('✅ All students now have valid classId');
    } else {
      console.log(`⚠️ ${remainingStudents.length} students still missing classId`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing classId:', error);
    throw error;
  }
}

async function dropAndRecreateIndexes() {
  try {
    console.log('🔧 Dropping and recreating indexes...');
    
    // Drop the problematic index
    try {
      await Student.collection.dropIndex('classId_1_rollNumber_1');
      console.log('✅ Dropped classId_1_rollNumber_1 index');
    } catch (error) {
      console.log('ℹ️ Index classId_1_rollNumber_1 not found or already dropped');
    }
    
    // Drop other indexes that might conflict
    try {
      await Student.collection.dropIndex('batch_1_rollNumber_1');
      console.log('✅ Dropped batch_1_rollNumber_1 index');
    } catch (error) {
      console.log('ℹ️ Index batch_1_rollNumber_1 not found or already dropped');
    }
    
    // Recreate the indexes
    await Student.collection.createIndex(
      { classId: 1, rollNumber: 1 }, 
      { unique: true, name: 'classId_1_rollNumber_1' }
    );
    console.log('✅ Created classId_1_rollNumber_1 index');
    
    await Student.collection.createIndex(
      { classId: 1, status: 1 }, 
      { name: 'classId_1_status_1' }
    );
    console.log('✅ Created classId_1_status_1 index');
    
    await Student.collection.createIndex(
      { facultyId: 1, status: 1 }, 
      { name: 'facultyId_1_status_1' }
    );
    console.log('✅ Created facultyId_1_status_1 index');
    
    await Student.collection.createIndex(
      { department: 1, status: 1 }, 
      { name: 'department_1_status_1' }
    );
    console.log('✅ Created department_1_status_1 index');
    
  } catch (error) {
    console.error('❌ Error recreating indexes:', error);
    throw error;
  }
}

async function verifyDataIntegrity() {
  try {
    console.log('🔍 Verifying data integrity...');
    
    // Check for duplicate roll numbers within the same class
    const duplicates = await Student.aggregate([
      {
        $group: {
          _id: { classId: '$classId', rollNumber: '$rollNumber' },
          count: { $sum: 1 },
          students: { $push: { id: '$_id', name: '$name' } }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    if (duplicates.length > 0) {
      console.log('⚠️ Found duplicate roll numbers within classes:');
      duplicates.forEach(dup => {
        console.log(`  - Class: ${dup._id.classId}, Roll: ${dup._id.rollNumber}, Count: ${dup.count}`);
        dup.students.forEach(student => {
          console.log(`    * ${student.name} (${student.id})`);
        });
      });
    } else {
      console.log('✅ No duplicate roll numbers found within classes');
    }
    
    // Check total students
    const totalStudents = await Student.countDocuments();
    console.log(`📊 Total students in database: ${totalStudents}`);
    
    // Check students with valid classId
    const studentsWithClassId = await Student.countDocuments({
      classId: { $exists: true, $ne: null, $ne: '' }
    });
    console.log(`📊 Students with valid classId: ${studentsWithClassId}`);
    
  } catch (error) {
    console.error('❌ Error verifying data integrity:', error);
    throw error;
  }
}

async function runMigration() {
  try {
    console.log('🚀 Starting Student classId migration...\n');
    
    await connectDB();
    
    // Step 1: Fix null classId values
    await fixStudentClassIds();
    
    // Step 2: Drop and recreate indexes
    await dropAndRecreateIndexes();
    
    // Step 3: Verify data integrity
    await verifyDataIntegrity();
    
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
