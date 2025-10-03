import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function setupTestFaculty() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/attendance_tracker');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // 1. Create/Update User
    const usersCollection = db.collection('users');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    await usersCollection.updateOne(
      { email: 'faculty@test.com' },
      {
        $set: {
          name: 'Test Faculty',
          email: 'faculty@test.com',
          password: hashedPassword,
          role: 'faculty',
          department: 'CSE',
          status: 'active',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    const user = await usersCollection.findOne({ email: 'faculty@test.com' });
    console.log('✅ User setup complete');

    // 2. Create/Update Faculty Profile
    const facultiesCollection = db.collection('faculties');
    
    await facultiesCollection.updateOne(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          name: 'Test Faculty',
          email: 'faculty@test.com',
          employeeId: 'FAC001',
          department: 'CSE',
          position: 'Assistant Professor',
          phone: '9876543210',
          is_class_advisor: true,
          batch: '2023-2027',
          year: '2nd Year',
          semester: 3,
          status: 'active',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log('✅ Faculty profile setup complete');

    // 3. Add some test students
    const studentsCollection = db.collection('students');
    
    const testStudents = [
      {
        rollNumber: 'CS2023001',
        name: 'John Doe',
        email: 'john.doe@student.com',
        mobile: '9876543210',
        batch: '2023-2027',
        year: '2nd Year',
        semester: 'Sem 3',
        department: 'CSE',
        userId: new mongoose.Types.ObjectId(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        rollNumber: 'CS2023002',
        name: 'Jane Smith',
        email: 'jane.smith@student.com',
        mobile: '9876543211',
        batch: '2023-2027',
        year: '2nd Year',
        semester: 'Sem 3',
        department: 'CSE',
        userId: new mongoose.Types.ObjectId(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        rollNumber: 'CS2023003',
        name: 'Bob Johnson',
        email: 'bob.johnson@student.com',
        mobile: '9876543212',
        batch: '2023-2027',
        year: '2nd Year',
        semester: 'Sem 3',
        department: 'CSE',
        userId: new mongoose.Types.ObjectId(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const student of testStudents) {
      await studentsCollection.updateOne(
        { rollNumber: student.rollNumber },
        { $set: student },
        { upsert: true }
      );
    }

    console.log('✅ Test students added');

    // 4. Verify Setup
    const faculty = await facultiesCollection.findOne({ userId: user._id });
    const studentCount = await studentsCollection.countDocuments({ 
      batch: '2023-2027', 
      year: '2nd Year', 
      semester: 'Sem 3',
      department: 'CSE'
    });

    console.log('\n📋 Setup Summary:');
    console.log(`👤 User: ${user.name} (${user.email})`);
    console.log(`🏫 Department: ${faculty.department}`);
    console.log(`👨‍🏫 Position: ${faculty.position}`);
    console.log(`📚 Class Advisor: ${faculty.is_class_advisor ? 'Yes' : 'No'}`);
    console.log(`🎓 Assigned: ${faculty.batch}, ${faculty.year}, Semester ${faculty.semester}`);
    console.log(`👥 Students: ${studentCount} students in this batch`);

    console.log('\n🎉 Setup Complete! You can now:');
    console.log('1. Login with: faculty@test.com / password123');
    console.log('2. Access Faculty Dashboard');
    console.log('3. Click "Manage Classes" to see assigned batches');
    console.log('4. Select a batch to manage students');
    console.log('5. Add, edit, or delete students');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

setupTestFaculty();
