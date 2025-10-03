import mongoose from 'mongoose';
import dotenv from 'dotenv';
import config from '../config/config.js';

// Load environment variables
dotenv.config();

const fixHolidayIndexes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('holidays');

    // Get current indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:', indexes.map(idx => idx.name));

    // Drop the old unique index on holidayDate only
    try {
      await collection.dropIndex('holidayDate_1');
      console.log('✅ Dropped old holidayDate_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  holidayDate_1 index does not exist, skipping...');
      } else {
        console.error('❌ Error dropping holidayDate_1 index:', error.message);
      }
    }

    // Create the new compound unique index
    try {
      await collection.createIndex(
        { holidayDate: 1, department: 1 },
        { unique: true, name: 'holidayDate_1_department_1' }
      );
      console.log('✅ Created compound unique index: holidayDate_1_department_1');
    } catch (error) {
      console.error('❌ Error creating compound index:', error.message);
    }

    // Verify the new indexes
    const newIndexes = await collection.indexes();
    console.log('📋 Updated indexes:', newIndexes.map(idx => ({ name: idx.name, key: idx.key, unique: idx.unique })));

    console.log('🎉 Holiday index migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the migration
fixHolidayIndexes();
