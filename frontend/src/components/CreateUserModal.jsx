import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Toast from './Toast';
import { apiFetch } from '../utils/apiFetch';

const CreateUserModal = ({ isOpen, onClose, onUserCreated, userRole = 'admin' }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: userRole === 'hod' ? 'faculty' : 'principal',
    department: userRole === 'hod' ? user?.department : '',
    // Faculty-specific fields
    position: 'Assistant Professor',
    phone: '',
    is_class_advisor: false,
    batch: '',
    year: '',
    semester: '',
    section: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [availableBatches, setAvailableBatches] = useState([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [advisorAvailability, setAdvisorAvailability] = useState(null);

  const departments = ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'];
  const positions = ['Assistant Professor', 'Associate Professor', 'Professor'];
  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];
  const sections = ['A', 'B', 'C'];

  // Fetch available batches when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchBatchRanges();
      
      // Test HOD auth for debugging
      if (userRole === 'hod') {
        testHODAuth();
      }
    }
  }, [isOpen]);

  const testHODAuth = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      console.log('Testing HOD auth...');
      const response = await apiFetch({
        url: '/api/faculty/test-auth',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      console.log('HOD auth test result:', response.data);
    } catch (error) {
      console.error('HOD auth test failed:', error);
    }
  };

  // Check advisor availability when relevant fields change
  useEffect(() => {
    if (formData.is_class_advisor && 
        formData.batch && 
        formData.year && 
        formData.semester && 
        formData.department) {
      checkAdvisorAvailability();
    } else {
      setAdvisorAvailability(null);
    }
  }, [
    formData.is_class_advisor,
    formData.batch,
    formData.year,
    formData.semester,
    formData.department
  ]);

  const checkAdvisorAvailability = async () => {
    setCheckingAvailability(true);
    try {
      const accessToken = localStorage.getItem('accessToken');
      const endpoint = userRole === 'hod' ? '/api/faculty/check-advisor-availability' : '/api/admin/check-advisor-availability';
      const response = await apiFetch({
        url: endpoint,
        method: 'POST',
        data: {
          batch: formData.batch,
          year: formData.year,
          semester: formData.semester,
          department: formData.department
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const data = response.data;
      if (data.success) {
        setAdvisorAvailability(data.data);
      }
    } catch (error) {
      console.error('Error checking advisor availability:', error);
      setAdvisorAvailability({ available: false, error: true });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const fetchBatchRanges = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const endpoint = userRole === 'hod' ? '/api/faculty/batch-ranges' : '/api/admin/batch-ranges';
      const response = await apiFetch({
        url: endpoint,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const data = response.data;
      if (data.success) {
        setAvailableBatches(data.data);
      }
    } catch (error) {
      console.error('Error fetching batch ranges:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (formData.role !== 'principal' && !formData.department) {
      newErrors.department = 'Department is required for this role';
    }

    // Faculty-specific validations
    if (formData.role === 'faculty') {
      if (!formData.position) {
        newErrors.position = 'Position is required for faculty';
      }

      // Class advisor validations
      if (formData.is_class_advisor) {
        if (!formData.batch) {
          newErrors.batch = 'Batch is required for class advisors';
        }
        if (!formData.year) {
          newErrors.year = 'Year is required for class advisors';
        }
        if (!formData.semester) {
          newErrors.semester = 'Semester is required for class advisors';
        }
        if (!formData.section) {
          newErrors.section = 'Section is required for class advisors';
        }

        // Check if advisor position is available
        if (advisorAvailability && !advisorAvailability.available) {
          newErrors.advisor = 'Selected class advisor position is already taken';
        }
      }
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
      console.log('Creating user with data:', {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department: formData.role === 'principal' ? undefined : formData.department
      });
      
      // Choose appropriate endpoint based on user role
      const endpoint = userRole === 'hod' 
        ? '/api/faculty/create' 
        : '/api/admin/users';

      let userData;

      if (userRole === 'hod') {
        // HOD faculty creation endpoint expects different format
        userData = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          position: formData.position,
          assignedClass: 'None', // Default for HOD created faculty
          is_class_advisor: formData.is_class_advisor
        };
        
        if (formData.is_class_advisor) {
          userData.batch = formData.batch;
          userData.year = formData.year;
          userData.semester = parseInt(formData.semester);
          userData.section = formData.section;
        }
      } else {
        // Admin endpoint format
        userData = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          department: formData.role === 'principal' ? undefined : formData.department
        };

        // Add faculty-specific fields
        if (formData.role === 'faculty') {
          userData.position = formData.position;
          userData.phone = formData.phone;
          userData.is_class_advisor = formData.is_class_advisor;
          
          if (formData.is_class_advisor) {
            userData.batch = formData.batch;
            userData.year = formData.year;
            userData.semester = parseInt(formData.semester);
            userData.section = formData.section;
          }
        }
      }

      console.log('Creating user with endpoint:', endpoint);
      console.log('User data:', userData);
      const accessToken = localStorage.getItem('accessToken');
      console.log('Access token exists:', !!accessToken);
      console.log('Access token (first 20 chars):', accessToken?.substring(0, 20));
      console.log('User role attempting creation:', userRole);
      console.log('Current user from context:', user);

      const response = await apiFetch({
        url: endpoint,
        method: 'POST',
        data: userData,
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('Response:', response);
      const data = response.data;

      // Handle different response formats
      const isSuccess = data.success || data.status === 'success';
      const message = data.msg || data.message;

      if (isSuccess) {
        const departmentMessage = formData.role === 'faculty' && formData.department 
          ? ` and assigned to ${formData.department} department` 
          : '';
        const successMessage = message || `${formData.role.charAt(0).toUpperCase() + formData.role.slice(1)} created successfully${departmentMessage}!`;
        setToast({ show: true, message: successMessage, type: 'success' });
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: userRole === 'hod' ? 'faculty' : 'principal',
          department: userRole === 'hod' ? user?.department : '',
          position: 'Assistant Professor',
          phone: '',
          is_class_advisor: false,
          batch: '',
          year: '',
          semester: '',
          section: ''
        });
        
        // Call the callback to trigger refresh
        if (onUserCreated) {
          onUserCreated();
        }
        
        // Close modal
        onClose();
      } else {
        setToast({ show: true, message: message || 'Failed to create user', type: 'error' });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      let errorMessage = 'An error occurred while creating the user';
      
      if (error.response?.data?.msg) {
        errorMessage = error.response.data.msg;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. You do not have permission to perform this action.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid data provided. Please check your input.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setToast({ show: true, message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: userRole === 'hod' ? 'faculty' : 'principal',
      department: userRole === 'hod' ? user?.department : '',
      position: 'Assistant Professor',
      phone: '',
      is_class_advisor: false,
      batch: '',
      year: '',
      semester: '',
      section: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] overflow-y-auto">
          <div className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 pr-2">
                {userRole === 'hod' ? 'Create Faculty Member' : 'Create User'}
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ×
              </button>
            </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* User Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Type
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                disabled={userRole === 'hod'}
                className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                  errors.role ? 'border-red-500' : 'border-gray-300'
                } ${userRole === 'hod' ? 'bg-gray-100' : ''}`}
              >
                {userRole === 'admin' && (
                  <>
                    <option value="principal">Principal</option>
                    <option value="hod">HOD</option>
                    <option value="faculty">Faculty</option>
                  </>
                )}
                {userRole === 'hod' && (
                  <option value="faculty">Faculty</option>
                )}
              </select>
              {errors.role && (
                <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.role}</p>
              )}
            </div>

            {/* Department */}
            {formData.role !== 'principal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  disabled={userRole === 'hod'}
                  className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                    errors.department ? 'border-red-500' : 'border-gray-300'
                  } ${userRole === 'hod' ? 'bg-gray-100' : ''}`}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.department && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.department}</p>
                )}
              </div>
            )}

            {/* Position - Only for Faculty */}
            {formData.role === 'faculty' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Position *
                </label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                    errors.position ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {positions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
                {errors.position && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.position}</p>
                )}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter full name"
              />
              {errors.name && (
                <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.email}</p>
              )}
            </div>

            {/* Phone - Only for Faculty */}
            {formData.role === 'faculty' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter 10-digit phone number"
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.phone}</p>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter password (min 6 characters)"
              />
              {errors.password && (
                <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                  errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Confirm password"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Class Advisor Section - Only for Faculty */}
            {formData.role === 'faculty' && (
              <div className="border-t pt-4">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="is_class_advisor"
                    name="is_class_advisor"
                    checked={formData.is_class_advisor}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_class_advisor" className="ml-2 text-sm font-medium text-gray-700">
                    Assign as Class Advisor
                  </label>
                </div>

                {formData.is_class_advisor && (
                  <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                    <h4 className="font-medium text-blue-900 mb-3">Class Advisor Details</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Batch */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Batch *
                        </label>
                        <select
                          name="batch"
                          value={formData.batch}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                            errors.batch ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select Batch</option>
                          {availableBatches.map(batch => (
                            <option key={batch} value={batch}>{batch}</option>
                          ))}
                        </select>
                        {errors.batch && (
                          <p className="text-red-500 text-xs mt-1">{errors.batch}</p>
                        )}
                      </div>

                      {/* Year */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Year *
                        </label>
                        <select
                          name="year"
                          value={formData.year}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                            errors.year ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select Year</option>
                          {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                        {errors.year && (
                          <p className="text-red-500 text-xs mt-1">{errors.year}</p>
                        )}
                      </div>

                      {/* Semester */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Semester *
                        </label>
                        <select
                          name="semester"
                          value={formData.semester}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                            errors.semester ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select Semester</option>
                          {semesters.map(semester => (
                            <option key={semester} value={semester}>Semester {semester}</option>
                          ))}
                        </select>
                        {errors.semester && (
                          <p className="text-red-500 text-xs mt-1">{errors.semester}</p>
                        )}
                      </div>
                    </div>

                    {/* Section - Full width */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Section *
                      </label>
                      <select
                        name="section"
                        value={formData.section}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                          errors.section ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select Section</option>
                        {sections.map(section => (
                          <option key={section} value={section}>Section {section}</option>
                        ))}
                      </select>
                      {errors.section && (
                        <p className="text-red-500 text-xs mt-1">{errors.section}</p>
                      )}
                    </div>

                    {/* Advisor Availability Check */}
                    {checkingAvailability && (
                      <div className="flex items-center text-blue-600 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Checking availability...
                      </div>
                    )}

                    {advisorAvailability && !checkingAvailability && (
                      <div className={`p-3 rounded-lg text-sm ${
                        advisorAvailability.available 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {advisorAvailability.available ? (
                          <div className="flex items-center">
                            <span className="text-green-600 mr-2">✓</span>
                            Available! This class advisor position is open.
                          </div>
                        ) : advisorAvailability.error ? (
                          <div className="flex items-center">
                            <span className="text-red-600 mr-2">⚠</span>
                            Error checking availability. Please try again.
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center mb-1">
                              <span className="text-red-600 mr-2">✗</span>
                              This class advisor position is already taken.
                            </div>
                            {advisorAvailability.existingAdvisor && (
                              <div className="text-xs bg-red-200 bg-opacity-50 p-2 rounded mt-1">
                                <strong>Current advisor:</strong> {advisorAvailability.existingAdvisor.name}<br />
                                <span className="opacity-75">{advisorAvailability.existingAdvisor.email}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {errors.advisor && (
                      <p className="text-red-500 text-sm">{errors.advisor}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors text-sm sm:text-base min-h-[44px]"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base min-h-[44px]"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateUserModal;
