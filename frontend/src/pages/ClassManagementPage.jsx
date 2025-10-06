import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { apiFetch } from '../utils/apiFetch';
import EditStudentModal from '../components/EditStudentModal';

const ClassManagementPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [availableBatches, setAvailableBatches] = useState([]);
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

  // Check if faculty is class advisor and fetch profile
  useEffect(() => {
    fetchFacultyProfile();
    fetchBatchRanges();
  }, []);

  const fetchFacultyProfile = async () => {
    try {
      const response = await apiFetch({
        url: `/api/faculty/profile/${user.id}`,
        method: 'GET'
      });
      
      if (response.data.success) {
        setFacultyProfile(response.data.data);
        if (!response.data.data.is_class_advisor) {
          setToast({
            show: true,
            message: 'You are not assigned as a class advisor.',
            type: 'error'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching faculty profile:', error);
      setToast({
        show: true,
        message: 'Error loading faculty profile.',
        type: 'error'
      });
    }
  };

  const fetchBatchRanges = async () => {
    try {
      const response = await apiFetch({
        url: '/api/faculty/batch-ranges',
        method: 'GET'
      });
      
      if (response.data.success) {
        setAvailableBatches(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching batch ranges:', error);
    }
  };

  const fetchStudents = async () => {
    if (!selectedBatch || !selectedYear) return;
    
    setLoading(true);
    try {
      const response = await apiFetch({
        url: `/api/faculty/students?batch=${selectedBatch}&year=${selectedYear}`,
        method: 'GET'
      });
      
      if (response.data.success) {
        const students = response.data.data.students || [];
        console.log('📋 Class Management fetched students:', students);
        console.log('📋 Student IDs in fetched data:', students.map(s => ({ _id: s._id, id: s.id, rollNumber: s.rollNumber })));
        setStudents(students);
      } else {
        console.log('❌ Class Management failed to fetch students:', response.data.message);
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setToast({
        show: true,
        message: 'Error loading students.',
        type: 'error'
      });
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatch && selectedYear) {
      fetchStudents();
    }
  }, [selectedBatch, selectedYear]);

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

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student?')) {
      return;
    }

    try {
      const response = await apiFetch({
        url: `/api/faculty/students/${studentId}`,
        method: 'DELETE'
      });

      if (response.data.success) {
        // Remove student from local state immediately for instant UI feedback
        setStudents(prevStudents => 
          prevStudents.filter(student => student._id !== studentId && student.id !== studentId)
        );
        console.log('✅ Class Management local state updated - student removed');
        
        setToast({
          show: true,
          message: 'Student deleted successfully.',
          type: 'success'
        });
        
        // Refresh from server to ensure data consistency (in background)
        try {
          await fetchStudents();
          console.log('✅ Class Management server data refreshed after deletion');
        } catch (error) {
          console.error('❌ Error refreshing from server:', error);
          // Don't show error to user since local state is already updated
        }
      } else {
        setToast({
          show: true,
          message: response.data.message || 'Failed to delete student.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      setToast({
        show: true,
        message: 'Error deleting student.',
        type: 'error'
      });
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setShowEditModal(true);
  };

  const handleStudentCreated = async (newStudentData) => {
    console.log('📝 Student created in Class Management:', newStudentData);
    
    // Close modal first
    setShowAddModal(false);
    
    // Add the new student to local state immediately for instant UI feedback
    if (newStudentData) {
      setStudents(prevStudents => [...prevStudents, newStudentData]);
      console.log('✅ Class Management local state updated with new student');
    }
    
    // Show success message
    setToast({
      show: true,
      message: 'Student created successfully.',
      type: 'success'
    });
    
    // Refresh from server to ensure data consistency (in background)
    try {
      await fetchStudents();
      console.log('✅ Class Management server data refreshed after creation');
    } catch (error) {
      console.error('❌ Error refreshing from server:', error);
      // Don't show error to user since local state is already updated
    }
  };

  const handleStudentUpdated = async (updatedStudentData) => {
    console.log('📝 Student updated in Class Management:', updatedStudentData);
    console.log('📝 Current students before update:', students);
    
    // Close modal first
    setShowEditModal(false);
    setEditingStudent(null);
    
    // Update the local state immediately for instant UI feedback
    if (updatedStudentData) {
      setStudents(prevStudents => {
        console.log('📝 Previous students:', prevStudents);
        const updatedStudents = prevStudents.map(student => {
          console.log('📝 Checking student:', student._id, 'vs', updatedStudentData._id);
          const isMatch = student._id === updatedStudentData._id || student.id === updatedStudentData._id;
          console.log('📝 Is match:', isMatch);
          
          if (isMatch) {
            const updatedStudent = {
              ...student,
              rollNumber: updatedStudentData.rollNumber,
              name: updatedStudentData.name,
              email: updatedStudentData.email,
              mobile: updatedStudentData.mobile,
              batch: updatedStudentData.batch,
              year: updatedStudentData.year,
              semester: updatedStudentData.semester,
              section: updatedStudentData.section
            };
            console.log('📝 Updated student:', updatedStudent);
            return updatedStudent;
          }
          return student;
        });
        console.log('📝 Final updated students:', updatedStudents);
        return updatedStudents;
      });
      console.log('✅ Class Management local state updated immediately');
    }
    
    // Show success message
    setToast({
      show: true,
      message: 'Student updated successfully.',
      type: 'success'
    });
    
    // Refresh from server to ensure data consistency (in background)
    try {
      await fetchStudents();
      console.log('✅ Class Management server data refreshed');
    } catch (error) {
      console.error('❌ Error refreshing from server:', error);
      // Don't show error to user since local state is already updated
    }
  };

  // Check if faculty is class advisor
  if (facultyProfile && !facultyProfile.is_class_advisor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">You are not assigned as a class advisor.</p>
          <button
            onClick={() => navigate('/faculty')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/faculty')}
                className="text-blue-600 hover:text-blue-800 mr-4"
              >
                ← Back to Dashboard
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
                <p className="text-gray-600">Manage students for your assigned batches</p>
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
        {/* Batch & Year Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Batch & Year</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Batch
              </label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Batch</option>
                {availableBatches.map(batch => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Year</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Student Management Section */}
        {selectedBatch && selectedYear && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Students - {selectedBatch}, {selectedYear}
              </h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add Student
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
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

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8">
                    {searchTerm ? (
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
                    ) : (
                      <p className="text-gray-500">No students found for this batch and year.</p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Roll Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mobile Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStudents.map((student) => (
                          <tr key={student._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {student.rollNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {student.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {student.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {student.mobile}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleEditStudent(student)}
                                className="text-blue-600 hover:text-blue-900 mr-4"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Add Student Modal */}
      {showAddModal && (
        <AddStudentModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onStudentCreated={handleStudentCreated}
          batch={selectedBatch}
          year={selectedYear}
          department={user?.department}
        />
      )}

      {/* Edit Student Modal */}
      {showEditModal && editingStudent && (
        <EditStudentModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingStudent(null);
          }}
          onStudentUpdated={handleStudentUpdated}
          student={editingStudent}
        />
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

// Add Student Modal Component
const AddStudentModal = ({ isOpen, onClose, onStudentCreated, batch, year, department }) => {
  const [formData, setFormData] = useState({
    rollNumber: '',
    name: '',
    email: '',
    mobile: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.rollNumber.trim()) {
      newErrors.rollNumber = 'Roll number is required';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[0-9]{10}$/.test(formData.mobile)) {
      newErrors.mobile = 'Mobile number must be exactly 10 digits';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch({
        url: '/api/faculty/students',
        method: 'POST',
        data: {
          ...formData,
          batch,
          year,
          department
        }
      });

      if (response.data.success) {
        // Pass the created student data to the callback
        onStudentCreated(response.data.data);
        setFormData({
          rollNumber: '',
          name: '',
          email: '',
          mobile: '',
          password: ''
        });
      }
    } catch (error) {
      console.error('Error creating student:', error);
      if (error.response?.data?.message) {
        setErrors({ general: error.response.data.message });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Add Student</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {errors.general}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Roll Number *
              </label>
              <input
                type="text"
                name="rollNumber"
                value={formData.rollNumber}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.rollNumber ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter roll number"
              />
              {errors.rollNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.rollNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter full name"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number *
              </label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.mobile ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter mobile number (10 digits)"
                maxLength="10"
              />
              {errors.mobile && (
                <p className="text-red-500 text-sm mt-1">{errors.mobile}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter password (min 6 characters)"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600">
                <strong>Batch:</strong> {batch}<br />
                <strong>Year:</strong> {year}<br />
                <strong>Department:</strong> {department}
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Student'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClassManagementPage;