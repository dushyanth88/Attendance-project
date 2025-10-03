import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function testFacultyWithSection() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/attendance_tracker');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // 1. Create/Update User
    const usersCollection = db.collection('users');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    await usersCollection.updateOne(
      { email: 'section.advisor@test.com' },
      {
        $set: {
          name: 'Section Advisor',
          email: 'section.advisor@test.com',
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

    const user = await usersCollection.findOne({ email: 'section.advisor@test.com' });
    console.log('✅ User setup complete:', user.email);

    // 2. Create/Update Faculty Profile as Class Advisor with section
    const facultiesCollection = db.collection('faculties');
    
    const batch = '2024-2028';
    const year = '1st Year';
    const semester = 1;
    const section = 'A';
    const assignedClass = `${batch}, ${year}, Sem ${semester}, Section ${section}`;
    
    await facultiesCollection.updateOne(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          name: 'Section Advisor',
          email: 'section.advisor@test.com',
          employeeId: 'ADV002',
          department: 'CSE',
          position: 'Assistant Professor',
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
        rollNumber: 'CS2024001',
        name: 'Alice Johnson',
        email: 'alice.johnson@student.com',
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
        rollNumber: 'CS2024002',
        name: 'Bob Wilson',
        email: 'bob.wilson@student.com',
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

    console.log('\n🎉 Test Setup Ready! You can now:');
    console.log('1. Login with: section.advisor@test.com / password123');
    console.log('2. Check Faculty List - should show assigned class with section');
    console.log('3. Access Faculty Dashboard - should show assigned class info with section');
    console.log('4. Click "Manage Classes" - should redirect to student management');
    console.log('5. Verify student list shows only assigned class students');

    console.log('\n📝 Expected Results:');
    console.log('✅ Faculty List: Shows "2024-2028, 1st Year, Sem 1, Section A"');
    console.log('✅ Faculty Dashboard: Shows assigned class with section');
    console.log('✅ Manage Classes: Redirects directly to student management');
    console.log('✅ Student Management: Shows only assigned class students');
    console.log('✅ No validation errors for assignedClass field');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testFacultyWithSection();
