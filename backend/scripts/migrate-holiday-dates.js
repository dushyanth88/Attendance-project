import mongoose from 'mongoose';
import dotenv from 'dotenv';
import config from '../config/config.js';
import Holiday from '../models/Holiday.js';

// Load environment variables
dotenv.config();

const migrateHolidayDates = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all holidays
    const holidays = await Holiday.find({});
    console.log(`📅 Found ${holidays.length} holidays to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const holiday of holidays) {
      // Check if holidayDate is already a string
      if (typeof holiday.holidayDate === 'string') {
        console.log(`⏭️  Skipping holiday ${holiday._id} - already string format`);
        skippedCount++;
        continue;
      }

      // Convert Date to YYYY-MM-DD string
      if (holiday.holidayDate instanceof Date) {
        const dateString = holiday.holidayDate.toISOString().split('T')[0];
        
        // Update the holiday with string date
        await Holiday.findByIdAndUpdate(holiday._id, {
          holidayDate: dateString
        });
        
        console.log(`✅ Migrated holiday ${holiday._id}: ${holiday.holidayDate.toISOString()} → ${dateString}`);
        migratedCount++;
      } else {
        console.log(`⚠️  Skipping holiday ${holiday._id} - invalid date type: ${typeof holiday.holidayDate}`);
        skippedCount++;
      }
    }

    console.log(`🎉 Migration completed!`);
    console.log(`   - Migrated: ${migratedCount} holidays`);
    console.log(`   - Skipped: ${skippedCount} holidays`);

    // Verify the migration
    const allHolidays = await Holiday.find({});
    const stringDates = allHolidays.filter(h => typeof h.holidayDate === 'string');
    const dateObjects = allHolidays.filter(h => h.holidayDate instanceof Date);
    
    console.log(`📊 Verification:`);
    console.log(`   - String dates: ${stringDates.length}`);
    console.log(`   - Date objects: ${dateObjects.length}`);
    
    if (dateObjects.length === 0) {
      console.log('✅ All holidays are now in string format!');
    } else {
      console.log('⚠️  Some holidays are still Date objects');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
};

migrateHolidayDates();
