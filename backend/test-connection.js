import mongoose from 'mongoose';
import config from './config/config.js';

const testConnection = async () => {
  try {
    console.log('🔌 Testing MongoDB connection...');
    console.log('Connection string:', config.MONGODB_URI);
    
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ MongoDB connected successfully!');
    
    // Test database operations
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📊 Available collections:', collections.map(c => c.name));
    
    // Test if we can access the users collection
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();
    console.log('👥 Number of users in database:', userCount);
    
    if (userCount === 0) {
      console.log('⚠️  No users found. You may need to run: npm run seed');
    }
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure MongoDB is running: mongod');
    console.log('2. Check if the connection string is correct');
    console.log('3. Verify MongoDB is accessible on localhost:27017');
  } finally {
    mongoose.connection.close();
    console.log('🔌 Connection closed');
  }
};

testConnection();
