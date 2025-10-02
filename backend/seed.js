import mongoose from 'mongoose';
import User from './models/User.js';
import Attendance from './models/Attendance.js';
import config from './config/config.js';

const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const seedUsers = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Attendance.deleteMany({});
    console.log('🗑️  Cleared existing data');

    console.log('👥 Creating comprehensive user database...');

    // 1. Create Admin (seeded by default)
    const admin = new User({
      name: 'System Administrator',
      email: 'admin@attendance.com',
      password: 'password123',
      role: 'admin',
      phone: '+1-555-0100',
      address: '123 Admin Street, Tech City'
    });
    await admin.save();
    console.log('✅ Created ADMIN: admin@attendance.com / password123');

    // 2. Create Principal
    const principal = new User({
      name: 'Dr. Sarah Johnson',
      email: 'principal@attendance.com',
      password: 'principal123',
      role: 'principal',
      phone: '+1-555-0101',
      address: '456 Principal Avenue, Tech City',
      createdBy: admin._id
    });
    await principal.save();
    console.log('✅ Created PRINCIPAL: principal@attendance.com / principal123');

    // 3. Create HODs
    const hodCS = new User({
      name: 'Prof. Michael Chen',
      email: 'hod.cs@attendance.com',
      password: 'hod123',
      role: 'hod',
      department: 'Computer Science',
      phone: '+1-555-0102',
      address: '789 CS Department, Tech City',
      createdBy: admin._id
    });
    await hodCS.save();
    console.log('✅ Created HOD (CS): hod.cs@attendance.com / hod123');

    const hodEE = new User({
      name: 'Dr. Lisa Wang',
      email: 'hod.ee@attendance.com',
      password: 'hod123',
      role: 'hod',
      department: 'Electrical Engineering',
      phone: '+1-555-0103',
      address: '321 EE Department, Tech City',
      createdBy: admin._id
    });
    await hodEE.save();
    console.log('✅ Created HOD (EE): hod.ee@attendance.com / hod123');

    // 4. Create Faculty
    const faculty1 = new User({
      name: 'Dr. Emily Davis',
      email: 'faculty.cs1@attendance.com',
      password: 'faculty123',
      role: 'faculty',
      department: 'Computer Science',
      subjects: ['Data Structures', 'Algorithms', 'Database Systems'],
      assignedClasses: ['CS-101', 'CS-201', 'CS-301'],
      phone: '+1-555-0104',
      address: '654 Faculty Lane, Tech City',
      createdBy: hodCS._id
    });
    await faculty1.save();
    console.log('✅ Created FACULTY (CS): faculty.cs1@attendance.com / faculty123');

    const faculty2 = new User({
      name: 'Prof. James Wilson',
      email: 'faculty.cs2@attendance.com',
      password: 'faculty123',
      role: 'faculty',
      department: 'Computer Science',
      subjects: ['Computer Networks', 'Operating Systems'],
      assignedClasses: ['CS-102', 'CS-202'],
      phone: '+1-555-0105',
      address: '987 Faculty Street, Tech City',
      createdBy: hodCS._id
    });
    await faculty2.save();
    console.log('✅ Created FACULTY (CS): faculty.cs2@attendance.com / faculty123');

    const faculty3 = new User({
      name: 'Dr. Maria Rodriguez',
      email: 'faculty.ee1@attendance.com',
      password: 'faculty123',
      role: 'faculty',
      department: 'Electrical Engineering',
      subjects: ['Circuit Analysis', 'Digital Electronics'],
      assignedClasses: ['EE-101', 'EE-201'],
      phone: '+1-555-0106',
      address: '147 EE Faculty Ave, Tech City',
      createdBy: hodEE._id
    });
    await faculty3.save();
    console.log('✅ Created FACULTY (EE): faculty.ee1@attendance.com / faculty123');

    // 5. Create Students
    const students = [
      {
        name: 'John Smith',
        email: 'student.cs1@attendance.com',
        password: 'student123',
        role: 'student',
        department: 'Computer Science',
        class: 'CS-101',
        phone: '+1-555-0201',
        address: '111 Student Street, Tech City',
        dateOfBirth: new Date('2000-05-15'),
        emergencyContact: {
          name: 'Jane Smith',
          phone: '+1-555-0202',
          relationship: 'Mother'
        },
        createdBy: faculty1._id
      },
      {
        name: 'Alice Johnson',
        email: 'student.cs2@attendance.com',
        password: 'student123',
        role: 'student',
        department: 'Computer Science',
        class: 'CS-101',
        phone: '+1-555-0203',
        address: '222 Student Avenue, Tech City',
        dateOfBirth: new Date('2000-08-22'),
        emergencyContact: {
          name: 'Bob Johnson',
          phone: '+1-555-0204',
          relationship: 'Father'
        },
        createdBy: faculty1._id
      },
      {
        name: 'David Brown',
        email: 'student.cs3@attendance.com',
        password: 'student123',
        role: 'student',
        department: 'Computer Science',
        class: 'CS-201',
        phone: '+1-555-0205',
        address: '333 Student Lane, Tech City',
        dateOfBirth: new Date('1999-12-10'),
        emergencyContact: {
          name: 'Sarah Brown',
          phone: '+1-555-0206',
          relationship: 'Sister'
        },
        createdBy: faculty2._id
      },
      {
        name: 'Emma Wilson',
        email: 'student.ee1@attendance.com',
        password: 'student123',
        role: 'student',
        department: 'Electrical Engineering',
        class: 'EE-101',
        phone: '+1-555-0207',
        address: '444 EE Student Street, Tech City',
        dateOfBirth: new Date('2000-03-18'),
        emergencyContact: {
          name: 'Tom Wilson',
          phone: '+1-555-0208',
          relationship: 'Brother'
        },
        createdBy: faculty3._id
      },
      {
        name: 'Michael Davis',
        email: 'student.ee2@attendance.com',
        password: 'student123',
        role: 'student',
        department: 'Electrical Engineering',
        class: 'EE-101',
        phone: '+1-555-0209',
        address: '555 EE Student Ave, Tech City',
        dateOfBirth: new Date('2000-07-25'),
        emergencyContact: {
          name: 'Linda Davis',
          phone: '+1-555-0210',
          relationship: 'Mother'
        },
        createdBy: faculty3._id
      }
    ];

    for (const studentData of students) {
      const student = new User(studentData);
      await student.save();
      console.log(`✅ Created STUDENT: ${studentData.email} / student123`);
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   👨‍💻 1 Admin');
    console.log('   🎓 1 Principal');
    console.log('   🧑‍🏫 2 HODs (CS, EE)');
    console.log('   👩‍🏫 3 Faculty (2 CS, 1 EE)');
    console.log('   🎒 5 Students (3 CS, 2 EE)');
    console.log('\n🔑 Login Credentials:');
    console.log('   Admin: admin@attendance.com / password123');
    console.log('   Principal: principal@attendance.com / principal123');
    console.log('   HOD (CS): hod.cs@attendance.com / hod123');
    console.log('   HOD (EE): hod.ee@attendance.com / hod123');
    console.log('   Faculty (CS): faculty.cs1@attendance.com / faculty123');
    console.log('   Faculty (CS): faculty.cs2@attendance.com / faculty123');
    console.log('   Faculty (EE): faculty.ee1@attendance.com / faculty123');
    console.log('   Students: student.cs1@attendance.com / student123');
    console.log('   Students: student.cs2@attendance.com / student123');
    console.log('   Students: student.cs3@attendance.com / student123');
    console.log('   Students: student.ee1@attendance.com / student123');
    console.log('   Students: student.ee2@attendance.com / student123');

  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    console.error('Full error:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the seeding process
connectDB().then(() => {
  seedUsers();
});
