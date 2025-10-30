import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Toast from './Toast';
import { apiFetch } from '../utils/apiFetch';

const CreateStudentModal = ({ isOpen, onClose, onStudentCreated, assignedClass }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    rollNumber: '',
    name: '',
    email: '',
    mobile: '',
    password: '',
    year: '1st',
    semester: 'Sem 1',
    department: user?.department || ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const departments = ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'];
  
  // Dynamic semester mapping based on year
  const semesterOptions = {
    "1st": ["Sem 1", "Sem 2"],
    "2nd": ["Sem 3", "Sem 4"],
    "3rd": ["Sem 5", "Sem 6"],
    "4th": ["Sem 7", "Sem 8"]
  };
  
  // State for dynamic semester filtering
  const [availableSemesters, setAvailableSemesters] = useState(semesterOptions["1st"]);

  // Update available semesters when year changes
  useEffect(() => {
    if (formData.year && semesterOptions[formData.year]) {
      setAvailableSemesters(semesterOptions[formData.year]);
      // Reset semester if current selection is not valid for new year
      if (formData.semester && !semesterOptions[formData.year].includes(formData.semester)) {
        setFormData(prev => ({ ...prev, semester: semesterOptions[formData.year][0] }));
      }
    } else {
      setAvailableSemesters([]);
    }
  }, [formData.year]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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

    if (!formData.department) {
      newErrors.department = 'Department is required';
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
      console.log('Creating student with data:', { ...formData, classAssigned: assignedClass });
      
      const res = await apiFetch({
        url: '/api/student/create',
        method: 'POST',
        data: { ...formData, classAssigned: assignedClass }
      });
      const data = res.data;
      console.log('Response data:', data);

      if (data.status === 'success') {
        const departmentMessage = formData.department ? ` to ${formData.department} department` : '';
        setToast({ show: true, message: `Student added successfully${departmentMessage}!`, type: 'success' });
        onClose();
        onStudentCreated && onStudentCreated();
        // Reset form
        setFormData({
          rollNumber: '',
          name: '',
          email: '',
          mobile: '',
          password: '',
          year: '1st',
          semester: 'Sem 1',
          department: user?.department || ''
        });
      } else {
        setToast({ show: true, message: data.message || 'Failed to add student', type: 'error' });
      }
    } catch (error) {
      console.error('Error creating student:', error);
      let errorMessage = 'An error occurred while adding the student';
      
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.';
      } else if (error.message.includes('HTTP error')) {
        errorMessage = `Server error: ${error.message}`;
      } else if (error.message.includes('Expected JSON response')) {
        errorMessage = 'Server returned invalid response. Please check the backend logs.';
      }
      
      setToast({ show: true, message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      rollNumber: '',
      name: '',
      email: '',
      mobile: '',
      password: '',
      year: '1st',
      semester: 'Sem 1',
      department: user?.department || ''
    });
    setErrors({});
    setAvailableSemesters(semesterOptions["1st"]);
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
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-2xl max-w-md w-full max-h-[95vh] overflow-y-auto border border-blue-100">
          <div className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div className="flex items-center">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl mr-3 shadow-lg">
                  <span className="text-2xl">👨‍🎓</span>
                </div>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 pr-2">
                  Add Student to {assignedClass}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl p-1 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              {/* Roll Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Roll Number
                </label>
                <input
                  type="text"
                  name="rollNumber"
                  value={formData.rollNumber}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                    errors.rollNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter roll number"
                />
                {errors.rollNumber && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.rollNumber}</p>
                )}
              </div>

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

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  pattern="[0-9]{10}"
                  className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                    errors.mobile ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter mobile number (10 digits)"
                  maxLength="10"
                />
                {errors.mobile && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.mobile}</p>
                )}
              </div>

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

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department *
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  disabled={user?.role === 'faculty' || user?.role === 'hod'}
                  className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                    errors.department ? 'border-red-500' : 'border-gray-300'
                  } ${(user?.role === 'faculty' || user?.role === 'hod') ? 'bg-gray-100' : ''}`}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.department && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.department}</p>
                )}
                {(user?.role === 'faculty' || user?.role === 'hod') && (
                  <p className="text-xs text-gray-500 mt-1">Department is auto-assigned based on your role</p>
                )}
              </div>

            {/* Year & Semester */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select
                  name="year"
                  value={formData.year}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                    errors.year ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {['1st','2nd','3rd','4th'].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {errors.year && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.year}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                <select
                  name="semester"
                  value={formData.semester}
                  onChange={handleInputChange}
                  disabled={!availableSemesters.length}
                  className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base min-h-[44px] ${
                    errors.semester ? 'border-red-500' : 'border-gray-300'
                  } ${!availableSemesters.length ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">
                    {!availableSemesters.length ? 'Select Year First' : 'Select Semester'}
                  </option>
                  {availableSemesters.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.semester && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.semester}</p>
                )}
                {!availableSemesters.length && formData.year && (
                  <p className="text-blue-600 text-xs mt-1">
                    Please select a year to see available semesters
                  </p>
                )}
              </div>
            </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full sm:w-auto px-6 py-3 text-gray-700 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl hover:from-gray-300 hover:to-gray-400 transition-all duration-200 text-sm sm:text-base min-h-[44px] shadow-lg font-semibold"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base min-h-[44px] shadow-lg font-semibold"
                >
                  {loading ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateStudentModal;
