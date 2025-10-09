/**
 * Migration script to fix attendance date offset issue
 * This script updates existing attendance records to use proper IST dates
 */

import mongoose from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration function
const migrateAttendanceDates = async () => {
  try {
    console.log('🔄 Starting attendance date migration...\n');

    // Get all attendance records
    const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }));
    const records = await Attendance.find({});
    
    console.log(`📊 Found ${records.length} attendance records to migrate\n`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        // Calculate IST date from the stored UTC date
        const utcDate = new Date(record.date);
        const istDate = dayjs(utcDate).tz(IST_TIMEZONE);
        const localDate = istDate.format('YYYY-MM-DD');
        
        // Update the record with localDate
        await Attendance.updateOne(
          { _id: record._id },
          { 
            $set: { 
              localDate: localDate,
              updatedAt: new Date()
            } 
          }
        );

        console.log(`✅ Migrated record ${record._id}: ${record.date} → ${localDate}`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Error migrating record ${record._id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   - Total records: ${records.length}`);
    console.log(`   - Successfully migrated: ${migratedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Success rate: ${((migratedCount / records.length) * 100).toFixed(2)}%`);

    if (migratedCount > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('🎯 All attendance records now have proper IST localDate fields.');
    } else {
      console.log('\n⚠️ No records were migrated.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
};

// Test the migration
const testMigration = async () => {
  try {
    console.log('🧪 Testing migration results...\n');

    const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }));
    
    // Get a sample of records to verify
    const sampleRecords = await Attendance.find({}).limit(5);
    
    console.log('📋 Sample records after migration:');
    sampleRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record._id}`);
      console.log(`      Date: ${record.date}`);
      console.log(`      LocalDate: ${record.localDate || 'NOT SET'}`);
      console.log(`      Status: ${record.status}`);
      console.log('');
    });

    // Check for records without localDate
    const recordsWithoutLocalDate = await Attendance.countDocuments({ localDate: { $exists: false } });
    console.log(`🔍 Records without localDate: ${recordsWithoutLocalDate}`);

    if (recordsWithoutLocalDate === 0) {
      console.log('✅ All records have localDate field!');
    } else {
      console.log('⚠️ Some records still missing localDate field.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Attendance Date Migration Script');
    console.log('=====================================\n');
    
    // Run migration
    await migrateAttendanceDates();
    
    // Test results
    await testMigration();
    
    console.log('\n🎉 Migration process completed!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
main();
