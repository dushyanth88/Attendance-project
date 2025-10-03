import mongoose from 'mongoose';
import dotenv from 'dotenv';
import config from '../config/config.js';

// Load environment variables
dotenv.config();

const dropOldIndex = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('holidays');

    // List current indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique})`);
    });

    // Drop the problematic unique index on holidayDate only
    try {
      await collection.dropIndex('holidayDate_1');
      console.log('✅ Successfully dropped holidayDate_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  holidayDate_1 index does not exist');
      } else {
        console.error('❌ Error dropping index:', error.message);
      }
    }

    // Create compound unique index
    try {
      await collection.createIndex(
        { holidayDate: 1, department: 1 },
        { unique: true, name: 'holidayDate_1_department_1' }
      );
      console.log('✅ Successfully created compound unique index');
    } catch (error) {
      console.error('❌ Error creating compound index:', error.message);
    }

    // List indexes after changes
    const newIndexes = await collection.indexes();
    console.log('📋 Updated indexes:');
    newIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique})`);
    });

    console.log('🎉 Index migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
};

dropOldIndex();
