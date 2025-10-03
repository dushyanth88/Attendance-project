import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';

const ClassSelectionPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const fetchFacultyProfile = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/faculty/profile/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFacultyProfile(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching faculty profile:', error);
    }
  };

  const fetchAssignedClasses = async () => {
    setLoading(true);
    try {
      const response = await apiFetch({
        url: '/api/faculty/assigned-classes',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.data.success) {
        setAssignedClasses(response.data.data || []);
      } else {
        setToast({ 
          show: true, 
          message: response.data.message || 'Failed to fetch assigned classes', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error fetching assigned classes:', error);
      setToast({ 
        show: true, 
        message: 'Unable to fetch assigned classes. Please try again.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchFacultyProfile();
    }
  }, [user?.id]);

  useEffect(() => {
    if (facultyProfile?.is_class_advisor) {
      fetchAssignedClasses();
    } else if (facultyProfile && !facultyProfile.is_class_advisor) {
      setLoading(false);
    }
  }, [facultyProfile]);

  const handleClassSelect = (classInfo) => {
    navigate('/student-management', {
      state: {
        batch: classInfo.batch,
        year: classInfo.year,
        semester: classInfo.semester,
        department: classInfo.department,
        classTitle: `${classInfo.batch} | ${classInfo.year} | Semester ${classInfo.semester}`
      }
    });
  };

  // Show loading while fetching data
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your assigned classes...</p>
        </div>
      </div>
    );
  }

  // Access denied for non-advisors
  if (facultyProfile && !facultyProfile.is_class_advisor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-24 w-24 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-sm text-gray-600">
            You are not assigned as a Class Advisor. Please contact your HOD or Admin to get assigned to a class.
          </p>
          <button
            onClick={() => navigate('/faculty/dashboard')}
            className="mt-5 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // No assigned classes
  if (assignedClasses.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-24 w-24 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">No Classes Assigned</h2>
          <p className="mt-2 text-sm text-gray-600">
            You haven't been assigned to any classes yet. Please contact your HOD or Admin to get assigned to a class.
          </p>
          <button
            onClick={() => navigate('/faculty/dashboard')}
            className="mt-5 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Auto-redirect if only one class assigned
  if (assignedClasses.length === 1) {
    const singleClass = assignedClasses[0];
    handleClassSelect(singleClass);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to your assigned class...</p>
        </div>
      </div>
    );
  }

  // Multiple classes - show selection
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Select Class to Manage</h1>
              <p className="text-gray-600">Choose which class you want to manage students for</p>
            </div>
            <button
              onClick={() => navigate('/faculty/dashboard')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Your Assigned Classes</h2>
          <p className="text-sm text-gray-600">
            You are assigned as a class advisor for {assignedClasses.length} class{assignedClasses.length > 1 ? 'es' : ''}. 
            Select a class below to manage its students.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignedClasses.map((classInfo, index) => (
            <div 
              key={index} 
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-indigo-200"
              onClick={() => handleClassSelect(classInfo)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <span className="text-indigo-600 font-bold text-lg">
                          {classInfo.department?.charAt(0) || 'C'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">{classInfo.department}</h3>
                      <p className="text-sm text-gray-500">Department</p>
                    </div>
                  </div>
                  <div className="text-indigo-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Academic Year:</span>
                    <span className="text-sm font-semibold text-gray-900">{classInfo.batch}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Year:</span>
                    <span className="text-sm font-semibold text-gray-900">{classInfo.year}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Semester:</span>
                    <span className="text-sm font-semibold text-gray-900">Semester {classInfo.semester}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Students:</span>
                    <span className="text-sm font-semibold text-gray-900">{classInfo.studentCount || 0}</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-center text-indigo-600 font-medium">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Manage Students
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Toast Notification */}
      {toast.show && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ show: false, message: '', type: 'success' })} 
        />
      )}
    </div>
  );
};

export default ClassSelectionPage;
