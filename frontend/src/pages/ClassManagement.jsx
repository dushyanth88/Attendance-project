import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClass } from '../context/ClassContext';
import ClassCard from '../components/ClassCard';
import Toast from '../components/Toast';

const ClassManagement = () => {
  const { user } = useAuth();
  const { 
    assignedClasses, 
    activeClass, 
    loading, 
    error, 
    fetchAssignedClasses, 
    switchClass,
    hasAssignedClasses,
    refreshClasses
  } = useClass();
  const navigate = useNavigate();
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (user?.id) {
      fetchAssignedClasses(user.id);
    }
  }, [user?.id, fetchAssignedClasses]);

  const handleClassSelect = (classData) => {
    switchClass(classData);
    navigate('/faculty/class-dashboard');
  };

  const handleRefresh = async () => {
    if (user?.id) {
      const classes = await refreshClasses(user.id);
      if (classes.length > 0) {
        setToast({ show: true, message: 'Classes refreshed successfully', type: 'success' });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your assigned classes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Classes</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!hasAssignedClasses()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Classes Assigned</h2>
          <p className="text-gray-600 mb-6">
            You are not currently assigned as a class advisor for any section.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Next Steps:</strong> Contact your HOD to get assigned to a class.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <span className="text-3xl mr-3">🎓</span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
                  <p className="text-gray-600">Select a class to manage students, attendance, and reports</p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <span className="mr-2">🔄</span>
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-2xl">📚</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Classes</p>
                    <p className="text-2xl font-bold text-gray-900">{assignedClasses.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Classes</p>
                    <p className="text-2xl font-bold text-gray-900">{assignedClasses.filter(c => c.active).length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <span className="text-2xl">👨‍🏫</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Your Role</p>
                    <p className="text-lg font-bold text-gray-900">Class Advisor</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Classes Grid */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Assigned Classes</h2>
            
            {assignedClasses.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Found</h3>
                <p className="text-gray-600">You don't have any assigned classes yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignedClasses.map((classData, index) => (
                  <ClassCard
                    key={classData._id || index}
                    classData={classData}
                    isActive={activeClass && activeClass._id === classData._id}
                    onClick={handleClassSelect}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Use Class Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <h4 className="font-medium mb-2">📊 Attendance Management</h4>
                <p>Mark daily attendance for your assigned classes and track student presence.</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">👥 Student Management</h4>
                <p>View and manage student information for each assigned class.</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">📈 Reports & Analytics</h4>
                <p>Generate attendance reports and analyze class performance.</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">🔄 Class Switching</h4>
                <p>Switch between different assigned classes seamlessly.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default ClassManagement;