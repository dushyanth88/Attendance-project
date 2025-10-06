import mongoose from 'mongoose';
import Holiday from '../models/Holiday.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function migrateHolidaySchema() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Attendance-Track');
    console.log('✅ Connected to MongoDB');

    // Update all existing holidays to use isDeleted instead of isActive
    const result = await Holiday.updateMany(
      { isActive: { $exists: true } },
      [
        {
          $set: {
            isDeleted: { $not: '$isActive' },
            deletedAt: { $cond: [{ $not: '$isActive' }, new Date(), null] }
          }
        },
        {
          $unset: 'isActive'
        }
      ]
    );

    console.log('✅ Migration completed:', {
      matchedDocuments: result.matchedCount,
      modifiedDocuments: result.modifiedCount
    });

    // Verify the migration
    const activeHolidays = await Holiday.countDocuments({ isDeleted: { $ne: true } });
    const deletedHolidays = await Holiday.countDocuments({ isDeleted: true });
    
    console.log('📊 Migration verification:', {
      activeHolidays,
      deletedHolidays,
      totalHolidays: activeHolidays + deletedHolidays
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateHolidaySchema();
}

export default migrateHolidaySchema;
