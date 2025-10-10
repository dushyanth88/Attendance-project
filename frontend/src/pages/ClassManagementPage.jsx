import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { apiFetch } from '../utils/apiFetch';

const ClassManagementPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [facultyProfile, setFacultyProfile] = useState(null);

  // Fetch faculty profile and assigned classes
  useEffect(() => {
    fetchFacultyData();
  }, []);

  const fetchFacultyData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching faculty data for user:', user);
      console.log('🔍 User ID:', user.id, 'User ID type:', typeof user.id);
      
      // Fetch faculty profile using the correct user ID (optional)
      try {
        const profileResponse = await apiFetch({
          url: `/api/faculty/profile/${user.id}`,
          method: 'GET'
        });
        
        if (profileResponse.data.success) {
          setFacultyProfile(profileResponse.data.data);
          console.log('✅ Faculty profile loaded:', profileResponse.data.data);
        }
      } catch (profileError) {
        console.warn('⚠️ Could not fetch faculty profile, using user data:', profileError);
        // Use user data as fallback
        setFacultyProfile({
          name: user.name,
          email: user.email,
          department: user.department,
          is_class_advisor: true // Assume true for class management access
        });
      }

      // Fetch assigned classes using the correct user ID
      const classesResponse = await apiFetch({
        url: `/api/faculty/${user.id}/classes`,
        method: 'GET'
      });

      console.log('📋 Classes response:', classesResponse.data);

      if (classesResponse.data.success) {
        const classes = classesResponse.data.data || [];
        console.log('✅ Assigned classes loaded:', classes.length, classes);
        setAssignedClasses(classes);
      } else {
        console.error('❌ Failed to fetch assigned classes:', classesResponse.data.message);
        setAssignedClasses([]);
      }
    } catch (error) {
      console.error('Error fetching faculty data:', error);
      
      let errorMessage = 'Error loading faculty data.';
      if (error.response?.status === 403) {
        errorMessage = 'Access denied. Please check your permissions.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Faculty profile not found.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setToast({
        show: true,
        message: errorMessage,
        type: 'error'
      });
      setAssignedClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleManageClass = (classId) => {
    navigate(`/faculty/class/${classId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Faculty Details - Left Side */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {facultyProfile?.name?.charAt(0) || user?.name?.charAt(0) || 'F'}
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {facultyProfile?.name || user?.name || 'Faculty'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {facultyProfile?.department || user?.department}
                  </p>
                  {facultyProfile?.email && (
                    <small className="text-xs text-gray-500">
                      {facultyProfile.email}
                    </small>
                  )}
                </div>
              </div>
            </div>

            {/* Logout Button - Right Side */}
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Class Management</h1>
            <p className="mt-2 text-gray-600">
              Manage your assigned classes and access attendance features
            </p>
          </div>

          {/* Assigned Classes Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Your Assigned Classes</h2>
              <p className="text-sm text-gray-500 mt-1">
                Click "Manage" to access attendance, reports, and student data for each class
              </p>
            </div>

            <div className="p-6">
              {assignedClasses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignedClasses.map((cls, index) => (
                    <div key={cls.classId || index} className="bg-gray-50 rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {cls.batch} | {cls.year} | Semester {cls.semester} | Section {cls.section}
                          </h3>
                          
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Batch:</span>
                              <span className="text-blue-600 font-semibold">{cls.batch}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Year:</span>
                              <span>{cls.year}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Semester:</span>
                              <span>{cls.semester}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Section:</span>
                              <span>{cls.section}</span>
                            </div>
                            {cls.assignedDate && (
                              <div className="flex items-center">
                                <span className="font-medium mr-2">Assigned:</span>
                                <span className="text-green-600">
                                  {new Date(cls.assignedDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Class Advisor
                        </div>
                        <button
                          onClick={() => handleManageClass(cls.classId)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Manage Class
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Assigned Classes</h3>
                  <p className="text-gray-500 mb-4">
                    You don't have any classes assigned yet. Contact your HOD for class assignments.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Class assignments are managed by your HOD. 
                      Once assigned, you'll be able to manage attendance, view students, 
                      and generate reports for your assigned classes.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Toast Notifications */}
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

export default ClassManagementPage;