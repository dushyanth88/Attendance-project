import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function testFacultyCreationFix() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/attendance_tracker');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // 1. Create/Update User
    const usersCollection = db.collection('users');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    await usersCollection.updateOne(
      { email: 'fixed.advisor@test.com' },
      {
        $set: {
          name: 'Fixed Advisor',
          email: 'fixed.advisor@test.com',
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

    const user = await usersCollection.findOne({ email: 'fixed.advisor@test.com' });
    console.log('✅ User setup complete:', user.email);

    // 2. Create/Update Faculty Profile as Class Advisor with all fields
    const facultiesCollection = db.collection('faculties');
    
    const batch = '2025-2029';
    const year = '3rd Year';
    const semester = 5;
    const section = 'B';
    const assignedClass = `${batch}, ${year}, Sem ${semester}, Section ${section}`;
    
    await facultiesCollection.updateOne(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          name: 'Fixed Advisor',
          email: 'fixed.advisor@test.com',
          employeeId: 'ADV003',
          department: 'CSE',
          position: 'Associate Professor',
          phone: '9876543210',
          is_class_advisor: true,
          batch: batch,
          year: year,
          semester: semester,
          section: section,
          assignedClass: assignedClass,
          status: 'active',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log('✅ Faculty advisor profile setup complete');

    // 3. Add test students for the assigned class
    const studentsCollection = db.collection('students');
    
    const testStudents = [
      {
        rollNumber: 'CS2025001',
        name: 'Charlie Brown',
        email: 'charlie.brown@student.com',
        mobile: '9876543210',
        batch: batch,
        year: year,
        semester: `Sem ${semester}`,
        department: 'CSE',
        userId: new mongoose.Types.ObjectId(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        rollNumber: 'CS2025002',
        name: 'Diana Prince',
        email: 'diana.prince@student.com',
        mobile: '9876543211',
        batch: batch,
        year: year,
        semester: `Sem ${semester}`,
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
      batch: batch, 
      year: year, 
      semester: `Sem ${semester}`,
      department: 'CSE'
    });

    console.log('\n📋 Test Setup Summary:');
    console.log(`👤 User: ${user.name} (${user.email})`);
    console.log(`🏫 Department: ${faculty.department}`);
    console.log(`👨‍🏫 Position: ${faculty.position}`);
    console.log(`📚 Class Advisor: ${faculty.is_class_advisor ? 'Yes' : 'No'}`);
    console.log(`🎓 Assigned Class: ${faculty.assignedClass}`);
    console.log(`📊 Batch: ${faculty.batch}`);
    console.log(`📊 Year: ${faculty.year}`);
    console.log(`📊 Semester: ${faculty.semester}`);
    console.log(`📊 Section: ${faculty.section}`);
    console.log(`👥 Students: ${studentCount} students in this class`);

    console.log('\n🎉 Faculty Creation Fix Test Ready!');
    console.log('Now you can test:');
    console.log('1. Login as Admin or HOD');
    console.log('2. Create a new faculty member');
    console.log('3. Check "Assign as Class Advisor"');
    console.log('4. Fill in Batch, Year, Semester, and Section');
    console.log('5. Submit - should work without validation errors');

    console.log('\n📝 Expected Results:');
    console.log('✅ All fields (batch, year, semester, section) are sent to backend');
    console.log('✅ Backend validation passes with all fields present');
    console.log('✅ Faculty is created successfully with assigned class');
    console.log('✅ Assigned class shows: "2025-2029, 3rd Year, Sem 5, Section B"');
    console.log('✅ No "fields are required" error');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testFacultyCreationFix();
