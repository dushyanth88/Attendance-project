# 🎓 Complete Attendance Tracker Setup Guide

## 🚀 **System Overview**

This is a comprehensive MERN stack attendance management system with:

- **Secure JWT Authentication** with role-based access control
- **Admin User Management** - Only admin can create users
- **Role-based Dashboards** for Admin, Principal, HOD, Faculty, and Students
- **Attendance Tracking** with detailed reporting
- **Responsive UI** with modern design

## 🏗️ **System Architecture**

### **Backend (Node.js + Express + MongoDB)**
- **Authentication**: JWT with access/refresh tokens
- **Authorization**: Role-based middleware
- **Models**: User, Attendance with comprehensive schemas
- **Routes**: Auth, Admin, Attendance with full CRUD operations

### **Frontend (React + Tailwind CSS)**
- **Authentication**: Context-based state management
- **Routing**: Protected routes with role-based access
- **UI**: Modern, responsive design with role-specific dashboards

## 📋 **User Roles & Permissions**

| Role | Created By | Can Create | Access Level |
|------|------------|------------|--------------|
| **Admin** | Seeded | All roles | Full system access |
| **Principal** | Admin | HOD, Faculty, Students | Institution-wide reports |
| **HOD** | Admin/Principal | Faculty, Students | Department management |
| **Faculty** | Admin/HOD | Students | Class attendance |
| **Student** | Admin/Faculty | None | Personal records only |

## 🛠️ **Setup Instructions**

### **Step 1: Prerequisites**
```bash
# Ensure you have:
- Node.js (v16+)
- MongoDB (local or cloud)
- Git
```

### **Step 2: Backend Setup**
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start MongoDB (if running locally)
mongod
# Or on Windows: net start MongoDB

# Seed the database with users
npm run seed

# Start the backend server
npm run dev
```

### **Step 3: Frontend Setup**
```bash
# Navigate to frontend directory (new terminal)
cd frontend

# Install dependencies
npm install

# Start the frontend development server
npm run dev
```

### **Step 4: Access the Application**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api

## 🔑 **Login Credentials**

### **Admin (Seeded by Default)**
- **Email**: admin@attendance.com
- **Password**: password123
- **Access**: Full system control

### **Principal**
- **Email**: principal@attendance.com
- **Password**: principal123
- **Access**: Institution-wide reports

### **HODs**
- **CS HOD**: hod.cs@attendance.com / hod123
- **EE HOD**: hod.ee@attendance.com / hod123
- **Access**: Department management

### **Faculty**
- **CS Faculty 1**: faculty.cs1@attendance.com / faculty123
- **CS Faculty 2**: faculty.cs2@attendance.com / faculty123
- **EE Faculty**: faculty.ee1@attendance.com / faculty123
- **Access**: Class attendance marking

### **Students**
- **CS Students**: student.cs1@attendance.com / student123
- **EE Students**: student.ee1@attendance.com / student123
- **Access**: Personal attendance records

## 🎯 **Key Features**

### **Admin Dashboard**
- ✅ User management (Create, Read, Update, Delete)
- ✅ System statistics and analytics
- ✅ Department management
- ✅ Password reset functionality
- ✅ User status management (Active/Inactive/Suspended)

### **Principal Dashboard**
- ✅ Institution-wide attendance reports
- ✅ Faculty and student overview
- ✅ Department performance analytics
- ✅ Policy management

### **HOD Dashboard**
- ✅ Department-specific management
- ✅ Faculty oversight
- ✅ Student reports by department
- ✅ Course and class management

### **Faculty Dashboard**
- ✅ Daily attendance marking
- ✅ Class-wise attendance reports
- ✅ Student performance tracking
- ✅ Subject-wise analytics

### **Student Dashboard**
- ✅ Personal attendance history
- ✅ Subject-wise attendance percentage
- ✅ Attendance alerts and notifications
- ✅ Performance graphs and charts

## 🔐 **Security Features**

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Access tokens (15min) + Refresh tokens (7 days)
- **Role-based Authorization**: Middleware for each route
- **Input Validation**: Express-validator for all inputs
- **CORS Protection**: Configured for secure cross-origin requests
- **Error Handling**: Comprehensive error messages without data leakage

## 📊 **Database Schema**

### **User Model**
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: ['admin', 'principal', 'hod', 'faculty', 'student'],
  department: String,
  class: String (for students),
  subjects: [String] (for faculty),
  assignedClasses: [String] (for faculty),
  status: ['active', 'inactive', 'suspended'],
  createdBy: ObjectId (ref: User),
  lastLogin: Date,
  phone: String,
  address: String,
  dateOfBirth: Date,
  emergencyContact: Object
}
```

### **Attendance Model**
```javascript
{
  studentId: ObjectId (ref: User),
  facultyId: ObjectId (ref: User),
  date: Date,
  subject: String,
  class: String,
  status: ['present', 'absent', 'late', 'excused'],
  remarks: String,
  markedBy: ObjectId (ref: User),
  department: String,
  academicYear: String
}
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **MongoDB Connection Error**
   ```bash
   # Check if MongoDB is running
   mongod --version
   # Start MongoDB service
   net start MongoDB
   ```

2. **401 Unauthorized Error**
   - Check if database is seeded: `npm run seed`
   - Verify credentials match exactly
   - Check browser console for detailed error logs

3. **CORS Error**
   - Ensure frontend runs on port 5173
   - Check backend CORS configuration

4. **Token Expired Error**
   - Login again to get new tokens
   - Check token expiration settings

### **Debug Commands**
```bash
# Test database connection
cd backend && node test-connection.js

# Test login system
cd backend && node test-login.js

# Check API health
curl http://localhost:5000/api/health
```

## 🧪 **Testing the System**

### **1. Login Test**
1. Go to http://localhost:5173
2. Select role from role selector
3. Enter credentials from the table above
4. Verify redirect to correct dashboard

### **2. Admin Functions Test**
1. Login as admin
2. Navigate to user management
3. Create a new user
4. Edit user details
5. Test password reset

### **3. Attendance Test**
1. Login as faculty
2. Mark attendance for students
3. View attendance reports
4. Test different attendance statuses

### **4. Role Access Test**
1. Try accessing admin routes as student
2. Verify proper error messages
3. Test department-specific access

## 📱 **API Endpoints**

### **Authentication**
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

### **Admin Management**
- `GET /api/admin/users` - Get all users (paginated)
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/dashboard` - Get dashboard stats

### **Attendance**
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/attendance/student/:id` - Get student attendance
- `GET /api/attendance/class/:class` - Get class attendance
- `GET /api/attendance/department/:dept` - Get department reports

## 🎉 **Success Indicators**

✅ **Backend running** on port 5000
✅ **Frontend running** on port 5173
✅ **Database seeded** with all user roles
✅ **Login working** for all roles
✅ **Role-based redirects** functioning
✅ **Admin can create users**
✅ **Faculty can mark attendance**
✅ **Students can view records**

---

**🎓 Your Attendance Tracker system is now fully functional!**

**Need help?** Check the console logs for detailed debugging information.
