import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CreateUserModal from '../../components/CreateUserModal';
import FacultyList from '../../components/FacultyList';
import HolidayModal from '../../components/HolidayModal';
import HolidayManagement from '../../components/HolidayManagement';
import { apiFetch } from '../../utils/apiFetch';
import Toast from '../../components/Toast';
import TeamFooter from '../../components/TeamFooter';
import PasswordResetModal from '../../components/PasswordResetModal';

const HODDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreateFacultyModal, setShowCreateFacultyModal] = useState(false);
  const [facultyRefreshTrigger, setFacultyRefreshTrigger] = useState(0);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showHolidayManagement, setShowHolidayManagement] = useState(false);
  const [profileImage, setProfileImage] = useState(user?.profileImage);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [departmentStats, setDepartmentStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    loading: true
  });
  const [dailyAttendanceStats, setDailyAttendanceStats] = useState({
    attendancePercentage: 0,
    totalStudents: 0,
    presentStudents: 0,
    odStudents: 0,
    absentStudents: 0,
    notMarkedStudents: 0,
    date: '',
    loading: true
  });
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);

  const handleFacultyCreated = () => {
    setFacultyRefreshTrigger(prev => prev + 1);
    setShowCreateFacultyModal(false);
    // Refresh department stats when new faculty is created
    fetchDepartmentStats();
    fetchDailyAttendanceStats();
  };

  // Update profile image when user changes
  useEffect(() => {
    setProfileImage(user?.profileImage);
  }, [user?.profileImage]);

  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setToast({ show: true, message: 'Please select a valid image file (JPEG, PNG, GIF, WebP)', type: 'error' });
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setToast({ show: true, message: 'Image size must be less than 2MB', type: 'error' });
      return;
    }

    try {
      setUploadingImage(true);
      
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await apiFetch({
        url: '/api/faculty/profile-picture',
        method: 'POST',
        data: formData
      });

      if (response.data.success) {
        setProfileImage(response.data.data.profileImage);
        setToast({ show: true, message: 'Profile picture uploaded successfully!', type: 'success' });
      } else {
        setToast({ show: true, message: response.data.msg || 'Failed to upload profile picture', type: 'error' });
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setToast({ show: true, message: 'Failed to upload profile picture', type: 'error' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      setUploadingImage(true);
      
      const response = await apiFetch({
        url: '/api/faculty/profile-picture',
        method: 'DELETE'
      });

      if (response.data.success) {
        setProfileImage(null);
        setToast({ show: true, message: 'Profile picture removed successfully!', type: 'success' });
      } else {
        setToast({ show: true, message: response.data.msg || 'Failed to remove profile picture', type: 'error' });
      }
    } catch (error) {
      console.error('Error removing profile picture:', error);
      setToast({ show: true, message: 'Failed to remove profile picture', type: 'error' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleProfilePictureClick = (e) => {
    e.stopPropagation();
    if (profileImage) {
      setShowImageModal(true);
    }
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
          odStudents: data.odStudents || 0,
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="relative group">
                <div 
                  className="bg-white bg-opacity-20 p-3 rounded-full mr-4 cursor-pointer hover:bg-opacity-30 transition-all duration-200"
                  onClick={handleProfilePictureClick}
                >
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={`${user?.name}'s profile`}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-white font-semibold text-xl ${profileImage ? 'hidden' : 'flex'}`}
                  >
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'H'}
                  </div>
                </div>
                
                {/* Upload/Remove Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none mr-4">
                  <div className="flex flex-col items-center space-y-1 pointer-events-auto">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      className="hidden"
                      id="hod-profile-picture-upload"
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor="hod-profile-picture-upload"
                      className="text-white text-xs cursor-pointer hover:text-blue-200 transition-colors"
                    >
                      {uploadingImage ? '⏳' : (profileImage ? '📷' : '➕')}
                    </label>
                    {profileImage && (
                      <button
                        onClick={handleRemoveProfilePicture}
                        className="text-white text-xs hover:text-red-200 transition-colors"
                        disabled={uploadingImage}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">HOD Dashboard</h1>
                <p className="text-white text-opacity-90">Welcome back, {user?.name}</p>
                <p className="text-sm text-white text-opacity-80 bg-white bg-opacity-20 inline-block px-3 py-1 rounded-full mt-1">
                  📍 Department: {user?.department}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/hod/students')}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
              >
                View Students
              </button>
              <button
                onClick={() => setShowPasswordResetModal(true)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
              >
                Change Password
              </button>
              <button
                onClick={logout}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-white bg-opacity-20 p-4 rounded-2xl mr-4">
                <span className="text-4xl">👥</span>
              </div>
              <div>
                <p className="text-sm text-blue-100 font-medium mb-1">Department Students</p>
                <p className="text-3xl font-bold">
                  {departmentStats.loading ? (
                    <div className="animate-pulse bg-white bg-opacity-30 h-8 w-16 rounded"></div>
                  ) : (
                    departmentStats.totalStudents.toLocaleString()
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-white bg-opacity-20 p-4 rounded-2xl mr-4">
                <span className="text-4xl">👨‍🏫</span>
              </div>
              <div>
                <p className="text-sm text-purple-100 font-medium mb-1">Faculty Members</p>
                <p className="text-3xl font-bold">
                  {departmentStats.loading ? (
                    <div className="animate-pulse bg-white bg-opacity-30 h-8 w-12 rounded"></div>
                  ) : (
                    departmentStats.totalFaculty.toLocaleString()
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-white bg-opacity-20 p-4 rounded-2xl mr-4">
                <span className="text-4xl">📊</span>
              </div>
              <div>
                <p className="text-sm text-green-100 font-medium mb-1">Today's Attendance</p>
                <p className="text-3xl font-bold">
                  {dailyAttendanceStats.loading ? (
                    <div className="animate-pulse bg-white bg-opacity-30 h-8 w-16 rounded"></div>
                  ) : (
                    `${dailyAttendanceStats.attendancePercentage}%`
                  )}
                </p>
                <div className="flex flex-col gap-1 mt-1">
                  <p className="text-xs text-green-100 bg-white bg-opacity-20 inline-block px-2 py-0.5 rounded-full">
                    {dailyAttendanceStats.loading ? '' : 
                      `${dailyAttendanceStats.presentStudents}/${dailyAttendanceStats.totalStudents} present`
                    }
                  </p>
                  {!dailyAttendanceStats.loading && dailyAttendanceStats.odStudents > 0 && (
                    <p className="text-xs text-blue-100 bg-white bg-opacity-20 inline-block px-2 py-0.5 rounded-full">
                      📋 {dailyAttendanceStats.odStudents} OD
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Faculty Management */}
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg p-6 border border-blue-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl mr-4 shadow-lg">
                <span className="text-3xl">👩‍🏫</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Faculty Management</h3>
            </div>
            <p className="text-gray-600 mb-6 ml-16">Manage faculty members in your department</p>
            <button 
              onClick={() => setShowCreateFacultyModal(true)}
              className="ml-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg font-semibold transform hover:scale-105"
            >
              ➕ Create Faculty
            </button>
          </div>

          {/* Student Reports
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">🎒</span>
              <h3 className="text-lg font-semibold">Student Reports</h3>
            </div>
            <p className="text-gray-600 mb-4">View and manage student attendance reports</p>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              View Reports
            </button>
          </div> */}

          {/* Department Analytics
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📈</span>
              <h3 className="text-lg font-semibold">Department Analytics</h3>
            </div>
            <p className="text-gray-600 mb-4">Detailed analytics for your department</p>
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              View Analytics
            </button>
          </div> */}

          {/* Course Management
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📚</span>
              <h3 className="text-lg font-semibold">Course Management</h3>
            </div>
            <p className="text-gray-600 mb-4">Manage courses and schedules</p>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Manage Courses
            </button>
          </div> */}

          {/* Attendance Policies */}
          {/* <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📋</span>
              <h3 className="text-lg font-semibold">Attendance Policies</h3>
            </div>
            <p className="text-gray-600 mb-4">Set department-specific attendance rules</p>
            <button className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors">
              Manage Policies
            </button>
          </div> */}

          {/* Holiday Management (Department-wide) */}
          <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl shadow-lg p-6 border border-amber-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-3 rounded-xl mr-4 shadow-lg">
                <span className="text-3xl">🎉</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Holiday Management</h3>
            </div>
            <p className="text-gray-600 mb-6 ml-16">Declare department-wide holidays visible to all faculty</p>
            <div className="flex flex-col sm:flex-row gap-3 ml-16">
              <button
                onClick={() => setShowHolidayModal(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-3 rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all duration-200 shadow-lg font-semibold transform hover:scale-105"
              >
                📅 Declare Holiday
              </button>
              <button
                onClick={() => setShowHolidayManagement(true)}
                className="bg-gradient-to-r from-gray-700 to-gray-800 text-white px-6 py-3 rounded-xl hover:from-gray-800 hover:to-gray-900 transition-all duration-200 shadow-lg font-semibold transform hover:scale-105"
              >
                📋 Manage Holidays
              </button>
            </div>
          </div>

          {/* {/* Notifications
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">🔔</span>
              <h3 className="text-lg font-semibold">Notifications</h3>
            </div>
            <p className="text-gray-600 mb-4">Manage department notifications and alerts</p>
            <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
              View Notifications
            </button>
          </div> */}
        </div>

        {/* Faculty Management Section */}
        <div className="mt-10">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 mb-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center mb-4 sm:mb-0">
                <div className="bg-white bg-opacity-20 p-3 rounded-xl mr-4">
                  <span className="text-3xl">👨‍🏫</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Department Faculty
                  </h2>
                  <p className="text-white text-opacity-80 text-sm">Manage all faculty members</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateFacultyModal(true)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm transform hover:scale-105"
              >
                ➕ Add New Faculty
              </button>
            </div>
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

      {/* Declare Holiday Modal */}
      <HolidayModal
        isOpen={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        onHolidayCreated={() => setShowHolidayModal(false)}
      />

      {/* Holiday Management Modal */}
      <HolidayManagement
        isOpen={showHolidayManagement}
        onClose={() => setShowHolidayManagement(false)}
        onHolidayUpdated={() => { /* no-op */ }}
      />

      {/* Image Modal */}
      {showImageModal && profileImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setShowImageModal(false)}>
          <div className="max-w-4xl max-h-4xl p-4">
            <img
              src={profileImage}
              alt="Profile"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}

      {/* Password Reset Modal */}
      <PasswordResetModal 
        isOpen={showPasswordResetModal} 
        onClose={() => setShowPasswordResetModal(false)} 
      />

      <TeamFooter />
    </div>
  );
};

export default HODDashboard;
