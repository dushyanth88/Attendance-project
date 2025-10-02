import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import CreateStudentModal from '../../components/CreateStudentModal';
import StudentList from '../../components/StudentList';

const FacultyDashboard = () => {
  const { user, logout } = useAuth();
  const [assignedClass, setAssignedClass] = useState(null);
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [studentRefreshTrigger, setStudentRefreshTrigger] = useState(0);

  // Check if faculty is assigned as class teacher
  useEffect(() => {
    // This would typically come from the user's profile or a separate API call
    // For now, we'll simulate checking if the user has an assigned class
    const checkAssignedClass = async () => {
      try {
        // In a real implementation, you would fetch this from an API
        // For now, we'll use a mock value or check user properties
        if (user?.assignedClass && user.assignedClass !== 'None') {
          setAssignedClass(user.assignedClass);
        }
      } catch (error) {
        console.error('Error checking assigned class:', error);
      }
    };

    checkAssignedClass();
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl mr-3">👩‍🏫</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Faculty Dashboard</h1>
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
        {/* Class Teacher Banner */}
        {assignedClass && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg">
            <div className="flex items-center">
              <span className="text-2xl mr-3">👨‍🏫</span>
              <div>
                <h3 className="text-lg font-semibold">You are Class Teacher for {assignedClass}</h3>
                <p className="text-sm opacity-90">Manage students in your assigned class</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors text-left">
              <div className="flex items-center">
                <span className="text-2xl mr-3">✅</span>
                <div>
                  <h3 className="font-semibold">Mark Attendance</h3>
                  <p className="text-sm opacity-90">Take attendance for today's class</p>
                </div>
              </div>
            </button>
            <button className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors text-left">
              <div className="flex items-center">
                <span className="text-2xl mr-3">📊</span>
                <div>
                  <h3 className="font-semibold">View Reports</h3>
                  <p className="text-sm opacity-90">Check student attendance reports</p>
                </div>
              </div>
            </button>
            <button className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transition-colors text-left">
              <div className="flex items-center">
                <span className="text-2xl mr-3">📚</span>
                <div>
                  <h3 className="font-semibold">My Classes</h3>
                  <p className="text-sm opacity-90">Manage your classes and schedules</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">🎒</span>
              <div>
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📚</span>
              <div>
                <p className="text-sm text-gray-600">Active Classes</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📅</span>
              <div>
                <p className="text-sm text-gray-600">Classes Today</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📊</span>
              <div>
                <p className="text-sm text-gray-600">Avg. Attendance</p>
                <p className="text-2xl font-bold text-green-600">92.1%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Classes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📅</span>
              <h3 className="text-lg font-semibold">Today's Classes</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Data Structures</p>
                  <p className="text-sm text-gray-600">9:00 AM - 10:30 AM</p>
                </div>
                <button className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                  Mark Attendance
                </button>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Algorithms</p>
                  <p className="text-sm text-gray-600">11:00 AM - 12:30 PM</p>
                </div>
                <button className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                  Mark Attendance
                </button>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Database Systems</p>
                  <p className="text-sm text-gray-600">2:00 PM - 3:30 PM</p>
                </div>
                <button className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                  Mark Attendance
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">🕒</span>
              <h3 className="text-lg font-semibold">Recent Activity</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-green-600 mr-3">✅</span>
                <div>
                  <p className="text-sm">Marked attendance for Data Structures</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-blue-600 mr-3">📊</span>
                <div>
                  <p className="text-sm">Generated weekly report</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-purple-600 mr-3">📚</span>
                <div>
                  <p className="text-sm">Updated class schedule</p>
                  <p className="text-xs text-gray-500">3 days ago</p>
                </div>
              </div>
            </div>
          </div>

          {/* Student Performance */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📈</span>
              <h3 className="text-lg font-semibold">Student Performance</h3>
            </div>
            <p className="text-gray-600 mb-4">View detailed student attendance and performance metrics</p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              View Performance
            </button>
          </div>

          {/* Class Management */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">⚙️</span>
              <h3 className="text-lg font-semibold">Class Management</h3>
            </div>
            <p className="text-gray-600 mb-4">Manage your classes, schedules, and student lists</p>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Manage Classes
            </button>
          </div>
        </div>

        {/* Student Management Section - Only show if faculty is class teacher */}
        {assignedClass && (
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
                Student Management
              </h2>
              <button
                onClick={() => setShowCreateStudentModal(true)}
                className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors min-h-[44px]"
              >
                Add Student
              </button>
            </div>
            
            <StudentList 
              assignedClass={assignedClass}
              refreshTrigger={studentRefreshTrigger}
            />
          </div>
        )}
      </main>

      {/* Create Student Modal */}
      <CreateStudentModal
        isOpen={showCreateStudentModal}
        onClose={() => setShowCreateStudentModal(false)}
        onStudentCreated={() => setStudentRefreshTrigger(prev => prev + 1)}
        assignedClass={assignedClass}
      />
    </div>
  );
};

export default FacultyDashboard;
