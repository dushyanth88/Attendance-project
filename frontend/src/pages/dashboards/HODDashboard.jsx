import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import CreateUserModal from '../../components/CreateUserModal';
import FacultyList from '../../components/FacultyList';
import { apiFetch } from '../../utils/apiFetch';

const HODDashboard = () => {
  const { user, logout } = useAuth();
  const [showCreateFacultyModal, setShowCreateFacultyModal] = useState(false);
  const [facultyRefreshTrigger, setFacultyRefreshTrigger] = useState(0);
  const [departmentStats, setDepartmentStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    loading: true
  });
  const [dailyAttendanceStats, setDailyAttendanceStats] = useState({
    attendancePercentage: 0,
    totalStudents: 0,
    presentStudents: 0,
    absentStudents: 0,
    notMarkedStudents: 0,
    date: '',
    loading: true
  });

  const handleFacultyCreated = () => {
    setFacultyRefreshTrigger(prev => prev + 1);
    setShowCreateFacultyModal(false);
    // Refresh department stats when new faculty is created
    fetchDepartmentStats();
    fetchDailyAttendanceStats();
  };

  const fetchDepartmentStats = async () => {
    try {
      setDepartmentStats(prev => ({ ...prev, loading: true }));
      
      const response = await apiFetch({
        url: '/api/admin/department-stats',
        method: 'GET'
      });

      if (response.data.success) {
        const data = response.data.data;
        console.log('📊 Department stats response:', data);
        
        // Use the final counts from backend (which already handles fallbacks)
        setDepartmentStats({
          totalStudents: data.totalStudents,
          totalFaculty: data.totalFaculty,
          loading: false
        });
        
        console.log('📊 Department stats loaded:', {
          students: data.totalStudents,
          faculty: data.totalFaculty,
          debug: data.debug
        });
      } else {
        throw new Error(response.data.msg || 'Failed to fetch department statistics');
      }
    } catch (error) {
      console.error('Error fetching department statistics:', error);
      setDepartmentStats(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchDailyAttendanceStats = async () => {
    try {
      setDailyAttendanceStats(prev => ({ ...prev, loading: true }));
      
      const response = await apiFetch({
        url: '/api/admin/daily-attendance',
        method: 'GET'
      });

      if (response.data.success) {
        const data = response.data.data;
        console.log('📊 Daily attendance stats response:', data);
        
        setDailyAttendanceStats({
          attendancePercentage: data.attendancePercentage,
          totalStudents: data.totalStudents,
          presentStudents: data.presentStudents,
          absentStudents: data.absentStudents,
          notMarkedStudents: data.notMarkedStudents,
          date: data.date,
          loading: false
        });
        
        console.log('📊 Daily attendance stats loaded:', {
          percentage: data.attendancePercentage,
          students: data.totalStudents,
          presentStudents: data.presentStudents,
          absentStudents: data.absentStudents,
          notMarkedStudents: data.notMarkedStudents,
          date: data.date
        });
      } else {
        throw new Error(response.data.msg || 'Failed to fetch daily attendance statistics');
      }
    } catch (error) {
      console.error('Error fetching daily attendance statistics:', error);
      setDailyAttendanceStats(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (user?.department) {
      fetchDepartmentStats();
      fetchDailyAttendanceStats();
    }
  }, [user?.department]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🧑‍🏫</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">HOD Dashboard</h1>
                <p className="text-gray-600">Welcome back, {user?.name}</p>
                <p className="text-sm text-blue-600">Department: {user?.department}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">👥</span>
              <div>
                <p className="text-sm text-gray-600">Department Students</p>
                <p className="text-2xl font-bold text-gray-900">
                  {departmentStats.loading ? (
                    <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                  ) : (
                    departmentStats.totalStudents.toLocaleString()
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">👨‍🏫</span>
              <div>
                <p className="text-sm text-gray-600">Faculty Members</p>
                <p className="text-2xl font-bold text-gray-900">
                  {departmentStats.loading ? (
                    <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                  ) : (
                    departmentStats.totalFaculty.toLocaleString()
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📊</span>
              <div>
                <p className="text-sm text-gray-600">Today's Attendance</p>
                <p className="text-2xl font-bold text-blue-600">
                  {dailyAttendanceStats.loading ? (
                    <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                  ) : (
                    `${dailyAttendanceStats.attendancePercentage}%`
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {dailyAttendanceStats.loading ? '' : 
                    `${dailyAttendanceStats.presentStudents}/${dailyAttendanceStats.totalStudents} present`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Faculty Management */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">👩‍🏫</span>
              <h3 className="text-lg font-semibold">Faculty Management</h3>
            </div>
            <p className="text-gray-600 mb-4">Manage faculty members in your department</p>
            <button 
              onClick={() => setShowCreateFacultyModal(true)}
              className="w-full sm:w-auto bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base min-h-[44px]"
            >
              Create Faculty
            </button>
          </div>

          {/* Student Reports */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">🎒</span>
              <h3 className="text-lg font-semibold">Student Reports</h3>
            </div>
            <p className="text-gray-600 mb-4">View and manage student attendance reports</p>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              View Reports
            </button>
          </div>

          {/* Department Analytics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📈</span>
              <h3 className="text-lg font-semibold">Department Analytics</h3>
            </div>
            <p className="text-gray-600 mb-4">Detailed analytics for your department</p>
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              View Analytics
            </button>
          </div>

          {/* Course Management */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📚</span>
              <h3 className="text-lg font-semibold">Course Management</h3>
            </div>
            <p className="text-gray-600 mb-4">Manage courses and schedules</p>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Manage Courses
            </button>
          </div>

          {/* Attendance Policies */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📋</span>
              <h3 className="text-lg font-semibold">Attendance Policies</h3>
            </div>
            <p className="text-gray-600 mb-4">Set department-specific attendance rules</p>
            <button className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors">
              Manage Policies
            </button>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">🔔</span>
              <h3 className="text-lg font-semibold">Notifications</h3>
            </div>
            <p className="text-gray-600 mb-4">Manage department notifications and alerts</p>
            <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
              View Notifications
            </button>
          </div>
        </div>

        {/* Faculty Management Section */}
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
              Department Faculty
            </h2>
            <button
              onClick={() => setShowCreateFacultyModal(true)}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              Add New Faculty
            </button>
          </div>
          
          <FacultyList 
            refreshTrigger={facultyRefreshTrigger}
            userRole="hod"
            department={user?.department}
          />
        </div>
      </main>

      {/* Create Faculty Modal */}
      <CreateUserModal
        isOpen={showCreateFacultyModal}
        onClose={() => setShowCreateFacultyModal(false)}
        onUserCreated={handleFacultyCreated}
        userRole="hod"
      />
    </div>
  );
};

export default HODDashboard;
