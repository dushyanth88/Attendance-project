export default {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/Attendance-Track',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret_key_change_in_production',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
