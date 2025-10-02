#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🎓 Attendance Tracker Setup Script');
console.log('=====================================\n');

// Check if .env file exists in backend
const backendEnvPath = path.join(__dirname, 'backend', '.env');
if (!fs.existsSync(backendEnvPath)) {
  console.log('📝 Creating .env file for backend...');
  const envContent = `PORT=5000
MONGODB_URI=mongodb://localhost:27017/attendance-tracker
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production_${Date.now()}
NODE_ENV=development`;
  
  fs.writeFileSync(backendEnvPath, envContent);
  console.log('✅ Backend .env file created successfully!\n');
} else {
  console.log('✅ Backend .env file already exists\n');
}

console.log('🚀 Setup Instructions:');
console.log('======================');
console.log('1. Install backend dependencies:');
console.log('   cd backend && npm install\n');

console.log('2. Install frontend dependencies:');
console.log('   cd frontend && npm install\n');

console.log('3. Start MongoDB (if running locally):');
console.log('   mongod\n');

console.log('4. Start the backend server:');
console.log('   cd backend && npm run dev\n');

console.log('5. Start the frontend server (in a new terminal):');
console.log('   cd frontend && npm run dev\n');

console.log('6. Open your browser and go to:');
console.log('   http://localhost:5173\n');

console.log('🎯 Demo Credentials:');
console.log('====================');
console.log('Admin:     admin@attendance.com / admin123');
console.log('Principal: principal@attendance.com / principal123');
console.log('HOD:       hod@attendance.com / hod123');
console.log('Faculty:   faculty@attendance.com / faculty123');
console.log('Student:   student@attendance.com / student123\n');

console.log('📚 For detailed setup instructions, see README.md');
console.log('🎉 Happy coding!');
