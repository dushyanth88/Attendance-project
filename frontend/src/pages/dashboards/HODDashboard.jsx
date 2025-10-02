import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import CreateUserModal from '../../components/CreateUserModal';
import CreateFacultyModal from '../../components/CreateFacultyModal';
import FacultyList from '../../components/FacultyList';

const HODDashboard = () => {
  const { user, logout } = useAuth();
  const [showCreateFacultyModal, setShowCreateFacultyModal] = useState(false);
  const [facultyRefreshTrigger, setFacultyRefreshTrigger] = useState(0);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">👥</span>
              <div>
                <p className="text-sm text-gray-600">Department Students</p>
                <p className="text-2xl font-bold text-gray-900">324</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">👨‍🏫</span>
              <div>
                <p className="text-sm text-gray-600">Faculty Members</p>
                <p className="text-2xl font-bold text-gray-900">18</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📚</span>
              <div>
                <p className="text-sm text-gray-600">Active Courses</p>
                <p className="text-2xl font-bold text-gray-900">24</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📊</span>
              <div>
                <p className="text-sm text-gray-600">Dept. Attendance</p>
                <p className="text-2xl font-bold text-green-600">89.2%</p>
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
        <div className="mt-6 sm:mt-8">
          <FacultyList 
            refreshTrigger={facultyRefreshTrigger}
          />
        </div>
      </main>

      {/* Create Faculty Modal */}
      <CreateFacultyModal
        isOpen={showCreateFacultyModal}
        onClose={() => setShowCreateFacultyModal(false)}
        onFacultyCreated={() => setFacultyRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
};

export default HODDashboard;
