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
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

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
          setProfileImage(profileResponse.data.data.profileImage);
          console.log('✅ Faculty profile loaded:', profileResponse.data.data);
          console.log('🖼️ Profile image loaded:', profileResponse.data.data.profileImage);
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
        console.log('🖼️ Profile image in fallback:', user.profileImage);
        setProfileImage(user.profileImage);
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
        // Don't set Content-Type header - let the browser set it with boundary
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
    console.log('🖼️ Profile picture clicked, profileImage:', profileImage);
    if (profileImage) {
      console.log('🖼️ Opening image modal');
      setShowImageModal(true);
    } else {
      console.log('🖼️ No profile image to enlarge');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading class management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Fixed Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Faculty Details - Left Side */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {/* Profile Picture */}
                <div className="relative group">
                  <div 
                    className="w-12 h-12 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all duration-200"
                    onClick={handleProfilePictureClick}
                  >
                    {profileImage ? (
                      <img 
                        src={profileImage} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-6 h-6 text-white mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span className="text-white text-xs font-medium">Add</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Upload/Remove Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center space-y-1 pointer-events-auto">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureUpload}
                        className="hidden"
                        id="profile-picture-upload"
                        disabled={uploadingImage}
                      />
                      <label
                        htmlFor="profile-picture-upload"
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
                  <h4 className="text-xl font-bold text-white">
                    {facultyProfile?.name || user?.name || 'Faculty'}
                  </h4>
                  <p className="text-sm text-white text-opacity-90">
                    {facultyProfile?.department || user?.department}
                  </p>
                  {facultyProfile?.email && (
                    <small className="text-xs text-white text-opacity-80">
                      {facultyProfile.email}
                    </small>
                  )}
                </div>
              </div>
            </div>

            {/* Logout Button - Right Side */}
            <button
              onClick={handleLogout}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center">
                <div className="bg-white bg-opacity-20 p-3 rounded-xl mr-4">
                  <span className="text-3xl">📚</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Class Management</h1>
                  <p className="mt-2 text-white text-opacity-90">
                    Manage your assigned classes and access attendance features
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Classes Section */}
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-100">
            <div className="px-6 py-6 border-b border-blue-200">
              <div className="flex items-center">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl mr-4 shadow-lg">
                  <span className="text-2xl">🎓</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Your Assigned Classes</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Click "Manage" to access attendance, reports, and student data for each class
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {assignedClasses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignedClasses.map((cls, index) => (
                    <div key={cls.classId || index} className="bg-gradient-to-br from-white to-purple-50 rounded-2xl border border-purple-100 p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-800 mb-2">
                            {cls.batch} | {cls.year} | Semester {cls.semester} | Section {cls.section}
                          </h3>
                          
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Batch:</span>
                              <span className="text-purple-600 font-semibold">{cls.batch}</span>
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

                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
                          Active
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Class Advisor
                        </div>
                        <button
                          onClick={() => handleManageClass(cls.classId)}
                          className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 text-sm font-medium shadow-lg"
                        >
                          Manage Class
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 shadow-lg border border-gray-100">
                    <div className="text-gray-500 mb-4">
                      <div className="bg-gradient-to-br from-gray-400 to-gray-500 p-4 rounded-2xl mx-auto w-16 h-16 flex items-center justify-center">
                        <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">No Assigned Classes</h3>
                    <p className="text-gray-600 mb-4">
                      You don't have any classes assigned yet. Contact your HOD for class assignments.
                    </p>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 max-w-md mx-auto">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Class assignments are managed by your HOD. 
                        Once assigned, you'll be able to manage attendance, view students, 
                        and generate reports for your assigned classes.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Profile Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => {
          console.log('🖼️ Modal background clicked, closing modal');
          setShowImageModal(false);
        }}>
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <button
              onClick={() => {
                console.log('🖼️ Close button clicked');
                setShowImageModal(false);
              }}
              className="absolute top-2 right-2 text-white hover:text-gray-300 transition-colors z-10"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={profileImage}
              alt="Profile Picture"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => {
                console.log('🖼️ Image clicked, preventing close');
                e.stopPropagation();
              }}
            />
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <p className="text-white text-sm bg-black bg-opacity-50 rounded-lg px-4 py-2">
                {facultyProfile?.name || user?.name || 'Faculty'} - Profile Picture
              </p>
            </div>
          </div>
        </div>
      )}

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