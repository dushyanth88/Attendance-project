import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import PrincipalDashboard from './pages/dashboards/PrincipalDashboard';
import HODDashboard from './pages/dashboards/HODDashboard';
import FacultyDashboard from './pages/dashboards/FacultyDashboard';
import StudentDashboard from './pages/dashboards/StudentDashboard';
import ClassManagementPage from './pages/ClassManagementPage';
import EnhancedStudentProfile from './components/EnhancedStudentProfile';
import ReportGeneration from './components/ReportGeneration';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes */}
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/principal/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['principal']}>
                  <PrincipalDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hod/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['hod']}>
                  <HODDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/faculty/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['faculty']}>
                  <FacultyDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/class-management/:classId" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin']}>
                  <ClassManagementPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/students/:id" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin', 'student']}>
                  <EnhancedStudentProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/report-generation" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin']}>
                  <ReportGeneration />
                </ProtectedRoute>
              } 
            />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
