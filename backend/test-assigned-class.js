import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function testAssignedClass() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/attendance_tracker');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // 1. Create/Update User
    const usersCollection = db.collection('users');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    await usersCollection.updateOne(
      { email: 'test.advisor@example.com' },
      {
        $set: {
          name: 'Test Advisor',
          email: 'test.advisor@example.com',
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

    const user = await usersCollection.findOne({ email: 'test.advisor@example.com' });
    console.log('✅ User setup complete:', user.email);

    // 2. Create/Update Faculty Profile as Class Advisor with proper assignedClass
    const facultiesCollection = db.collection('faculties');
    
    const batch = '2023-2027';
    const year = '2nd Year';
    const semester = 3;
    const assignedClass = `${batch}, ${year}, Sem ${semester}`;
    
    await facultiesCollection.updateOne(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          name: 'Test Advisor',
          email: 'test.advisor@example.com',
          employeeId: 'ADV001',
          department: 'CSE',
          position: 'Assistant Professor',
          phone: '9876543210',
          is_class_advisor: true,
          batch: batch,
          year: year,
          semester: semester,
          assignedClass: assignedClass, // This should be properly set
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
        rollNumber: 'CS2023001',
        name: 'John Doe',
        email: 'john.doe@student.com',
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
        rollNumber: 'CS2023002',
        name: 'Jane Smith',
        email: 'jane.smith@student.com',
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
    console.log(`👥 Students: ${studentCount} students in this class`);

    console.log('\n🎉 Test Setup Ready! You can now:');
    console.log('1. Login with: test.advisor@example.com / password123');
    console.log('2. Check Faculty List - should show assigned class instead of "None"');
    console.log('3. Access Faculty Dashboard - should show assigned class info');
    console.log('4. Click "Manage Classes" - should redirect to student management');
    console.log('5. Verify student list shows only assigned class students');

    console.log('\n📝 Expected Results:');
    console.log('✅ Faculty List: Shows "2023-2027, 2nd Year, Sem 3" instead of "None"');
    console.log('✅ Faculty Dashboard: Shows assigned class information');
    console.log('✅ Manage Classes: Redirects directly to student management');
    console.log('✅ Student Management: Shows only assigned class students');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testAssignedClass();
