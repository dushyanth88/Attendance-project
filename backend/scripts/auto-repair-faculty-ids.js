/**
 * Auto-repair script for existing student records with incorrect or missing facultyId
 * This is a one-time maintenance script to fix previously affected data
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import { resolveFacultyId, validateFacultyClassBinding, parseClassId } from '../services/facultyResolutionService.js';

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

async function autoRepairFacultyIds() {
  try {
    console.log('🔧 Starting auto-repair of faculty IDs...\n');
    
    // Find all students that need repair
    const studentsToRepair = await Student.find({
      $or: [
        { facultyId: { $exists: false } },
        { facultyId: null },
        { facultyId: '' }
      ]
    });
    
    console.log(`📊 Found ${studentsToRepair.length} students needing faculty ID repair`);
    
    if (studentsToRepair.length === 0) {
      console.log('✅ No students need repair - all have valid facultyId');
      return;
    }
    
    let repairedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const auditLog = [];
    
    for (const student of studentsToRepair) {
      try {
        console.log(`\n🔍 Processing student: ${student.rollNumber} - ${student.name}`);
        console.log(`   Current facultyId: ${student.facultyId || 'NULL'}`);
        console.log(`   ClassId: ${student.classId || 'NULL'}`);
        console.log(`   CreatedBy: ${student.createdBy || 'NULL'}`);
        
        // Try to resolve faculty ID using classId
        let facultyResolution = null;
        
        if (student.classId) {
          try {
            const classMetadata = parseClassId(student.classId);
            facultyResolution = await resolveFacultyId({
              classId: student.classId,
              batch: student.batch,
              year: student.year,
              semester: student.semester,
              section: student.section,
              department: student.department
            });
          } catch (error) {
            console.log(`   ⚠️ Could not resolve from classId: ${error.message}`);
          }
        }
        
        // If classId resolution failed, try using createdBy
        if (!facultyResolution && student.createdBy) {
          try {
            const faculty = await Faculty.findOne({
              userId: student.createdBy,
              is_class_advisor: true,
              status: 'active'
            });
            
            if (faculty) {
              facultyResolution = {
                facultyId: faculty._id,
                faculty,
                source: 'created_by_lookup'
              };
            }
          } catch (error) {
            console.log(`   ⚠️ Could not resolve from createdBy: ${error.message}`);
          }
        }
        
        // If still no resolution, try batch/year/semester lookup
        if (!facultyResolution) {
          try {
            facultyResolution = await resolveFacultyId({
              batch: student.batch,
              year: student.year,
              semester: student.semester,
              section: student.section,
              department: student.department
            });
          } catch (error) {
            console.log(`   ⚠️ Could not resolve from batch/year/semester: ${error.message}`);
          }
        }
        
        if (facultyResolution) {
          const { facultyId, faculty, source } = facultyResolution;
          
          console.log(`   ✅ Resolved faculty: ${facultyId} (${faculty.name}) via ${source}`);
          
          // Validate the binding
          const classMetadata = {
            batch: student.batch,
            year: student.year,
            semester: student.semester,
            section: student.section,
            department: student.department
          };
          
          const isValidBinding = await validateFacultyClassBinding(facultyId, student.classId, classMetadata);
          
          if (isValidBinding) {
            // Update the student record
            await Student.updateOne(
              { _id: student._id },
              { 
                $set: { 
                  facultyId: facultyId
                }
              }
            );
            
            console.log(`   ✅ Updated facultyId to ${facultyId}`);
            repairedCount++;
            
            // Add to audit log
            auditLog.push({
              studentId: student._id,
              rollNumber: student.rollNumber,
              name: student.name,
              oldFacultyId: student.facultyId,
              newFacultyId: facultyId,
              source,
              facultyName: faculty.name,
              repairedAt: new Date()
            });
          } else {
            console.log(`   ⚠️ Faculty-class binding validation failed, skipping`);
            skippedCount++;
          }
        } else {
          console.log(`   ❌ Could not resolve faculty ID for this student`);
          errorCount++;
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing student ${student.rollNumber}: ${error.message}`);
        errorCount++;
      }
    }
    
    // Generate repair summary
    console.log(`\n📊 Auto-repair Summary:`);
    console.log(`  - Repaired: ${repairedCount} students`);
    console.log(`  - Skipped: ${skippedCount} students`);
    console.log(`  - Errors: ${errorCount} students`);
    console.log(`  - Total processed: ${studentsToRepair.length} students`);
    
    // Verify the repair
    console.log('\n🔍 Verifying repair...');
    const remainingUnrepaired = await Student.find({
      $or: [
        { facultyId: { $exists: false } },
        { facultyId: null },
        { facultyId: '' }
      ]
    });
    
    console.log(`   Students still without facultyId: ${remainingUnrepaired.length}`);
    
    if (remainingUnrepaired.length === 0) {
      console.log('✅ All students now have valid facultyId!');
    } else {
      console.log('⚠️ Some students still need manual attention:');
      remainingUnrepaired.forEach(student => {
        console.log(`   - ${student.rollNumber} (${student.name})`);
        console.log(`     ClassId: ${student.classId || 'NULL'}`);
        console.log(`     CreatedBy: ${student.createdBy || 'NULL'}`);
      });
    }
    
    // Save audit log
    if (auditLog.length > 0) {
      const fs = await import('fs');
      const auditLogPath = `faculty-id-repair-audit-${new Date().toISOString().split('T')[0]}.json`;
      fs.writeFileSync(auditLogPath, JSON.stringify(auditLog, null, 2));
      console.log(`\n📝 Audit log saved to: ${auditLogPath}`);
    }
    
  } catch (error) {
    console.error('❌ Auto-repair error:', error);
  }
}

async function runAutoRepair() {
  try {
    console.log('🚀 Starting faculty ID auto-repair...\n');
    
    await connectDB();
    await autoRepairFacultyIds();
    
    console.log('\n🎉 Auto-repair completed!');
    
  } catch (error) {
    console.error('❌ Auto-repair failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
}

// Run auto-repair
runAutoRepair();

