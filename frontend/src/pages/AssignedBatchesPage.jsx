import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';

const AssignedBatchesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignedBatches, setAssignedBatches] = useState([]);
  const [facultyProfile, setFacultyProfile] = useState(null);
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
        if (data.status === 'success') {
          setFacultyProfile(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching faculty profile:', error);
    }
  };

  const fetchAssignedBatches = async () => {
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
        setAssignedBatches(response.data.data || []);
      } else {
        setToast({ 
          show: true, 
          message: response.data.message || 'Failed to fetch assigned batches', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error fetching assigned batches:', error);
      setToast({ 
        show: true, 
        message: 'Unable to fetch assigned batches. Please try again.', 
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
      fetchAssignedBatches();
    } else if (facultyProfile && !facultyProfile.is_class_advisor) {
      setLoading(false);
    }
  }, [facultyProfile]);

  const handleManageBatch = (batch) => {
    navigate('/student-management', {
      state: {
        batch: batch.batch,
        year: batch.year,
        semester: batch.semester,
        department: batch.department,
        classTitle: `${batch.batch} | ${batch.year} | Semester ${batch.semester}`
      }
    });
  };

  if (facultyProfile && !facultyProfile.is_class_advisor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-sm text-gray-600">You are not assigned as a class advisor. Please contact your HOD or Admin.</p>
          <button
            onClick={() => navigate('/faculty/dashboard')}
            className="mt-5 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Assigned Batches</h1>
              <p className="text-gray-600">Select a batch to manage students</p>
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
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading assigned batches...</span>
          </div>
        ) : assignedBatches.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-24 w-24 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No assigned batches</h3>
            <p className="mt-1 text-sm text-gray-500">You haven't been assigned to any batches yet.</p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/faculty/dashboard')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedBatches.map((batch, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <span className="text-indigo-600 font-semibold text-lg">
                            {batch.department?.charAt(0) || 'C'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-gray-900">{batch.department}</h3>
                        <p className="text-sm text-gray-500">Department</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Academic Year:</span>
                      <span className="text-sm font-medium text-gray-900">{batch.batch}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Year:</span>
                      <span className="text-sm font-medium text-gray-900">{batch.year}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Semester:</span>
                      <span className="text-sm font-medium text-gray-900">Semester {batch.semester}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Students:</span>
                      <span className="text-sm font-medium text-gray-900">{batch.studentCount || 0}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleManageBatch(batch)}
                    className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Manage Students
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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

export default AssignedBatchesPage;
