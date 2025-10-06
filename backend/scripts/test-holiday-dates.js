import mongoose from 'mongoose';
import dotenv from 'dotenv';
import config from '../config/config.js';
import Holiday from '../models/Holiday.js';

// Load environment variables
dotenv.config();

const testHolidayDates = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test creating a holiday with a specific date
    const testDate = '2025-10-05';
    console.log(`🧪 Testing holiday creation with date: ${testDate}`);

    // Create a test holiday
    const testHoliday = new Holiday({
      holidayDate: testDate,
      reason: 'Test Holiday',
      createdBy: new mongoose.Types.ObjectId(),
      department: 'CSE'
    });

    await testHoliday.save();
    console.log('✅ Test holiday created successfully');

    // Retrieve the holiday
    const retrievedHoliday = await Holiday.findById(testHoliday._id);
    console.log('📅 Retrieved holiday date:', retrievedHoliday.holidayDate);
    console.log('📅 Date type:', typeof retrievedHoliday.holidayDate);
    console.log('📅 Date matches input:', retrievedHoliday.holidayDate === testDate);

    // Test date comparison
    const comparisonDate = '2025-10-05';
    console.log('🔍 Comparing with:', comparisonDate);
    console.log('🔍 Comparison result:', retrievedHoliday.holidayDate === comparisonDate);

    // Clean up test data
    await Holiday.findByIdAndDelete(testHoliday._id);
    console.log('🧹 Test data cleaned up');

    console.log('🎉 Date consistency test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
};

testHolidayDates();
