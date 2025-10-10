import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';
import AddStudentModal from '../components/AddStudentModal';
import EditStudentModal from '../components/EditStudentModal';
import BulkUploadModal from '../components/BulkUploadModal';

const StudentManagementPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get batch info from navigation state
  const batchInfo = location.state || {};
  const { batch, year, semester, department, classTitle } = batchInfo;
  
  const [students, setStudents] = useState([]);
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);

  const fetchFacultyProfile = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/faculty/profile/${user.id}`);
      
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

  const fetchStudents = useCallback(async () => {
    if (!batch || !year || !semester || !department) {
      setStudents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch({
        url: `/api/students?batch=${batch}&year=${year}&semester=${semester}`,
        method: 'GET'
      });
      
      if (response.data.success) {
        const list = response.data.data.students || [];
        console.log('📋 Fetched students from API:', list);
        const normalized = list.map(s => ({
          id: s.id || s._id, // This should now be the Student document ID
          _id: s._id, // Include _id for compatibility
          rollNumber: s.roll_number || s.rollNumber,
          name: s.full_name || s.name,
          email: s.email,
          mobile: s.mobile_number || s.mobile,
          batch: s.batch || batch,
          year: s.year || year,
          semester: s.semester || semester,
          section: s.section || '',
          userId: s.userId || {
            _id: s.userId,
            name: s.full_name || s.name,
            email: s.email,
            mobile: s.mobile_number || s.mobile
          }
        }));
        console.log('📋 Normalized students:', normalized);
        setStudents(normalized);
      } else {
        setToast({ 
          show: true, 
          message: response.data.message || 'Failed to fetch students', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      
      let errorMessage = 'Unable to fetch students. Please try again.';
      
      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
        // Optionally redirect to login or refresh the page
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. You do not have permission to view students.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Students not found for this class.';
      }
      
      setToast({ 
        show: true, 
        message: errorMessage, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  }, [batch, year, semester, department, refreshTrigger]);

  useEffect(() => {
    if (user?.id) {
      fetchFacultyProfile();
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Scroll to top when data loads
  useEffect(() => {
    if (!loading && students.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loading, students.length]);

  // Real-time search filtering - only roll number and name
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student => {
        const searchLower = searchTerm.toLowerCase().trim();
        const searchTermTrimmed = searchTerm.trim();
        
        // Helper function to safely convert to string and lowercase
        const safeToLower = (value) => {
          if (value === null || value === undefined) return '';
          return String(value).toLowerCase();
        };
        
        // Only search by roll number and name
        const rollNumberMatch = student.rollNumber === searchTermTrimmed || 
                               safeToLower(student.rollNumber).includes(searchLower);
        
        const nameMatch = safeToLower(student.name).includes(searchLower);
        
        return rollNumberMatch || nameMatch;
      });
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  const handleStudentCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setShowAddModal(false);
    setToast({ show: true, message: 'Student added successfully!', type: 'success' });
  };

  const handleStudentUpdated = async (updatedStudentData) => {
    console.log('📝 Student updated with data:', updatedStudentData);
    
    // Close modal first
    setShowEditModal(false);
    setEditingStudent(null);
    
    // Show success message
    setToast({ show: true, message: 'Student updated successfully!', type: 'success' });
    
    // Refresh the student list to show updated data
    try {
      await fetchStudents();
      console.log('✅ Student list refreshed after update');
    } catch (error) {
      console.error('❌ Error refreshing student list:', error);
      setToast({ 
        show: true, 
        message: 'Student updated but failed to refresh list. Please refresh the page.', 
        type: 'warning' 
      });
    }
  };

  const handleEditStudent = (student) => {
    console.log('📝 Editing student with data:', student);
    setEditingStudent(student);
    setShowEditModal(true);
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await apiFetch({
        url: `/api/students/${studentId}`,
        method: 'DELETE'
      });
      
      if (response.data.success) {
        setRefreshTrigger(prev => prev + 1);
        setToast({ show: true, message: 'Student deleted successfully!', type: 'success' });
      } else {
        setToast({ 
          show: true, 
          message: response.data.message || 'Failed to delete student', 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      setToast({ 
        show: true, 
        message: 'Unable to delete student. Please try again.', 
        type: 'error' 
      });
    }
  };

  const handleBulkUpload = () => {
    setShowBulkUploadModal(true);
  };

  const closeBulkUploadModal = () => {
    setShowBulkUploadModal(false);
  };

  const handleStudentsAdded = () => {
    // Refresh the students list after bulk upload
    setRefreshTrigger(prev => prev + 1);
    setToast({
      show: true,
      message: 'Students list refreshed successfully!',
      type: 'success'
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

  if (!batch || !year || !semester || !department) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Invalid Access</h2>
          <p className="mt-2 text-sm text-gray-600">Please select a batch from the assigned batches page.</p>
          <button
            onClick={() => navigate('/assigned-batches')}
            className="mt-5 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go to Assigned Batches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Student Management</h1>
              <p className="text-gray-600">
                Managing Students for <span className="font-semibold text-indigo-600">
                  {classTitle || `${batch} | ${year} | Semester ${semester}`}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Department: {department} • Total Students: {students.length}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/faculty/dashboard')}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← Back to Dashboard
              </button>
              <button
                onClick={handleBulkUpload}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Bulk Upload
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New Student
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading students...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-24 w-24 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No students found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding a new student to this batch.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New Student
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Students ({students.length})
                </h3>
              </div>
              
              {/* Search Bar */}
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search students by roll number or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {searchTerm && (
                  <p className="mt-2 text-sm text-gray-600">
                    {filteredStudents.length} result{filteredStudents.length !== 1 ? 's' : ''} found for "{searchTerm}"
                  </p>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Roll Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.length === 0 && searchTerm ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <div>
                          <div className="text-6xl mb-4">🔍</div>
                          <p className="text-gray-500 text-lg">No results found for "{searchTerm}"</p>
                          <p className="text-gray-400 text-sm mt-2">Try searching with different keywords or clear the search</p>
                          <button
                            onClick={() => setSearchTerm('')}
                            className="mt-4 text-blue-600 hover:text-blue-800 underline"
                          >
                            Clear search
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.rollNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => navigate(`/student-profile/${student.id}`)}
                          className="text-indigo-600 hover:text-indigo-900 hover:underline font-medium"
                        >
                          {student.name}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.mobile}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditStudent(student)}
                            className="text-indigo-600 hover:text-indigo-900 flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-red-600 hover:text-red-900 flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddStudentModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onStudentCreated={handleStudentCreated}
          batchInfo={{ batch, year, semester, department }}
        />
      )}

      {showEditModal && editingStudent && (
        <EditStudentModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onStudentUpdated={handleStudentUpdated}
          student={editingStudent}
        />
      )}

      {showBulkUploadModal && (
        <BulkUploadModal
          isOpen={showBulkUploadModal}
          onClose={closeBulkUploadModal}
          onStudentsAdded={handleStudentsAdded}
          classInfo={{ batch, year, semester, section: 'A', department }}
        />
      )}

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

export default StudentManagementPage;
