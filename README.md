# 🎓 Attendance Tracker System

A comprehensive web-based attendance management system built with **React.js** and **Node.js** that provides role-based access control for educational institutions.

## 🌟 Features

### 👨‍💼 **Admin Dashboard**
- Complete user management (Create Principal, HOD, Faculty, Students)
- System-wide settings and configuration
- Global attendance reports and analytics
- Department management
- Security monitoring

### 🎓 **Principal Dashboard**
- Institution-wide oversight
- Department performance monitoring
- Strategic reporting and analytics

### 👨‍🏫 **HOD Dashboard**
- **Faculty Management**: Create and manage faculty members in their department
- **Department Analytics**: View department-specific attendance reports
- **Faculty Assignment**: Assign classes to faculty members
- **Responsive Design**: Fully optimized for mobile and desktop

### 👩‍🏫 **Faculty Dashboard**
- **Class Teacher Functionality**: Manage students if assigned as class teacher
- **Student Management**: Add, edit, and delete students in assigned class
- **Attendance Tracking**: Mark and monitor student attendance
- **Performance Analytics**: View student performance metrics
- **Responsive Design**: Mobile-friendly interface

### 🎒 **Student Dashboard**
- View personal attendance records
- Access class schedules and announcements
- Performance tracking

## 🛠️ Technology Stack

### **Frontend**
- **React.js** - Modern UI library
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and development server
- **React Router** - Client-side routing
- **Context API** - State management

### **Backend**
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication and authorization
- **bcrypt** - Password hashing

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Mobile**: 320px - 767px (Vertical stacking, touch-friendly)
- **Tablet**: 768px - 1023px (2-column layouts)
- **Desktop**: 1024px+ (Multi-column dashboard layouts)

### Key Responsive Features:
- Mobile-first design approach
- Touch-friendly buttons (44px minimum)
- Collapsible navigation
- Responsive tables that convert to cards on mobile
- Optimized forms for all screen sizes

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Karthik0484/Attendance_project.git
   cd Attendance_project
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Environment Setup**
   Create a `.env` file in the backend directory:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/attendance_tracker
   JWT_SECRET=your_jwt_secret_key_here
   ```

5. **Start the Application**
   
   **Backend Server:**
   ```bash
   cd backend
   npm start
   ```

   **Frontend Development Server:**
   ```bash
   cd frontend
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

## 👥 User Roles & Permissions

### **Admin**
- Create and manage all user types
- Access to all system features
- Global system configuration

### **Principal**
- Institution-wide access
- Department oversight
- Strategic reporting

### **HOD (Head of Department)**
- Create and manage faculty in their department
- Department-specific analytics
- Faculty class assignments

### **Faculty**
- Mark attendance for assigned classes
- Manage students (if class teacher)
- View class-specific reports

### **Student**
- View personal attendance
- Access class information

## 🔐 Authentication & Security

- **JWT-based authentication** with access and refresh tokens
- **Role-based access control** (RBAC)
- **Password hashing** using bcrypt
- **Input validation** and sanitization
- **CORS protection**
- **Rate limiting** (planned)

## 📊 Database Schema

### **Users Collection**
- Admin, Principal, HOD, Faculty, Student profiles
- Role-based permissions
- Department associations

### **Faculty Collection**
- Faculty-specific information
- Position hierarchy (Assistant/Associate/Professor)
- Class assignments

### **Students Collection**
- Student profiles with roll numbers
- Class assignments
- Faculty associations

### **Attendance Collection** (Planned)
- Daily attendance records
- Subject-wise tracking
- Timestamp logging

## 🎨 UI/UX Features

- **Modern Design**: Clean, professional interface
- **Responsive Layout**: Works on all devices
- **Toast Notifications**: Real-time feedback
- **Loading States**: Smooth user experience
- **Error Handling**: Comprehensive error management
- **Accessibility**: WCAG compliant design

## 📈 Recent Updates

### **HOD Dashboard Enhancements**
- ✅ Faculty creation and management
- ✅ Department-specific faculty listing
- ✅ Search and pagination functionality
- ✅ Mobile-responsive design

### **Faculty Dashboard Enhancements**
- ✅ Class teacher identification banner
- ✅ Student management for assigned classes
- ✅ Student creation and deletion
- ✅ Responsive student list with search

### **Responsive Design Implementation**
- ✅ Mobile-first approach
- ✅ Touch-friendly interface
- ✅ Responsive forms and tables
- ✅ Optimized navigation

## 🔄 API Endpoints

### **Authentication**
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token

### **Faculty Management**
- `POST /api/faculty/create` - Create faculty (HOD only)
- `GET /api/faculty/list` - List department faculty
- `DELETE /api/faculty/:id` - Delete faculty

### **Student Management**
- `POST /api/student/create` - Add student (Faculty only)
- `GET /api/student/list/:class` - List class students
- `DELETE /api/student/delete/:id` - Remove student

## 🚧 Planned Features

- [ ] Attendance marking system
- [ ] Advanced reporting and analytics
- [ ] Email notifications
- [ ] Mobile app (React Native)
- [ ] Bulk student import
- [ ] Timetable management
- [ ] Parent portal

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Dushyanth** - [GitHub Profile](https://github.com/dushyanth88)

## 🙏 Acknowledgments

- React.js community for excellent documentation
- Tailwind CSS for the utility-first approach
- MongoDB for flexible data modeling
- Express.js for robust backend framework

---

⭐ **Star this repository if you find it helpful!**
