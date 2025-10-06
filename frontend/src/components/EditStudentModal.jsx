import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';

const EditStudentModal = ({ isOpen, onClose, student, onStudentUpdated }) => {
  const [formData, setFormData] = useState({
    rollNumber: '',
    name: '',
    email: '',
    mobile: '',
    batch: '',
    year: '',
    semester: '',
    section: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Populate form when student data is provided
  useEffect(() => {
    if (student) {
      console.log('📋 Pre-filling form with student data:', student);
      
      // Extract data with fallbacks
      const rollNumber = student.rollNumber || '';
      const name = student.userId?.name || student.name || '';
      const email = student.userId?.email || student.email || '';
      const mobile = student.userId?.mobile || student.mobile || '';
      const batch = student.batch || '';
      const year = student.year || '';
      const semester = student.semester || '';
      const section = student.section || '';
      
      console.log('📋 Extracted data:', {
        rollNumber, name, email, mobile, batch, year, semester, section
      });
      
      setFormData({
        rollNumber,
        name,
        email,
        mobile,
        batch,
        year,
        semester,
        section
      });
      setErrors({});
    }
  }, [student]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Helper function to safely get string value
    const getStringValue = (value) => {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    };

    // Required field validation
    const rollNumber = getStringValue(formData.rollNumber);
    if (!rollNumber) {
      newErrors.rollNumber = 'Roll Number is required';
    } else if (!/^\d+$/.test(rollNumber)) {
      newErrors.rollNumber = 'Roll Number must be numeric';
    }

    const name = getStringValue(formData.name);
    if (!name) {
      newErrors.name = 'Name is required';
    }

    const email = getStringValue(formData.email);
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    const mobile = getStringValue(formData.mobile);
    if (!mobile) {
      newErrors.mobile = 'Phone number is required';
    } else if (!/^\d{10}$/.test(mobile)) {
      newErrors.mobile = 'Phone number must be 10 digits';
    }

    const batch = getStringValue(formData.batch);
    if (!batch) {
      newErrors.batch = 'Batch is required';
    }

    const year = getStringValue(formData.year);
    if (!year) {
      newErrors.year = 'Year is required';
    }

    const semester = getStringValue(formData.semester);
    if (!semester) {
      newErrors.semester = 'Semester is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setToast({
        show: true,
        message: 'Please fix the errors before submitting',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // Use the Student document ID (not User ID)
      const studentId = student.id || student._id;
      console.log('🔍 Making API call with student ID:', studentId);
      console.log('🔍 Student object:', student);
      console.log('🔍 Form data being sent:', {
        rollNumber: String(formData.rollNumber).trim(),
        name: String(formData.name).trim(),
        email: String(formData.email).trim(),
        mobile: String(formData.mobile).trim(),
        batch: String(formData.batch).trim(),
        year: String(formData.year).trim(),
        semester: String(formData.semester).trim(),
        section: String(formData.section || '').trim()
      });
      
      const response = await apiFetch({
        url: `/api/students/${studentId}`,
        method: 'PUT',
        data: {
          rollNumber: String(formData.rollNumber).trim(),
          name: String(formData.name).trim(),
          email: String(formData.email).trim(),
          mobile: String(formData.mobile).trim(),
          batch: String(formData.batch).trim(),
          year: String(formData.year).trim(),
          semester: String(formData.semester).trim(),
          section: String(formData.section || '').trim()
        }
      });

      if (response.data.status === 'success') {
        setToast({
          show: true,
          message: 'Student updated successfully',
          type: 'success'
        });
        
        // Call the callback to update the parent component
        if (onStudentUpdated) {
          console.log('📝 Calling onStudentUpdated with data:', response.data.data);
          onStudentUpdated(response.data.data);
        }
        
        // Close modal after a short delay to show success message
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setToast({
          show: true,
          message: response.data.message || 'Failed to update student',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('❌ Update student error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      let errorMessage = 'Failed to update student. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        // Handle validation errors from backend
        const backendErrors = error.response.data.errors;
        const fieldErrors = {};
        
        backendErrors.forEach(err => {
          if (err.path) {
            fieldErrors[err.path] = err.msg;
          }
        });
        
        setErrors(fieldErrors);
        errorMessage = 'Please fix the validation errors';
      } else if (error.response?.status === 404) {
        errorMessage = 'Student not found. Please refresh the page and try again.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid data. Please check your inputs and try again.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      setToast({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        rollNumber: '',
        name: '',
        email: '',
        mobile: '',
        batch: '',
        year: '',
        semester: '',
        section: ''
      });
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ show: false, message: '', type: 'success' })}
          />
        )}
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Edit Student Details</h2>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Roll Number */}
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
                  disabled={loading}
                />
                {errors.rollNumber && (
                  <p className="text-red-500 text-sm mt-1">{errors.rollNumber}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter student name"
                  disabled={loading}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              {/* Email */}
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
                  disabled={loading}
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.mobile ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter phone number"
                  disabled={loading}
                />
                {errors.mobile && (
                  <p className="text-red-500 text-sm mt-1">{errors.mobile}</p>
                )}
              </div>

              {/* Batch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch *
                </label>
                <input
                  type="text"
                  name="batch"
                  value={formData.batch}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.batch ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., 2021-2025"
                  disabled={loading}
                />
                {errors.batch && (
                  <p className="text-red-500 text-sm mt-1">{errors.batch}</p>
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
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.year ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                >
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
                {errors.year && (
                  <p className="text-red-500 text-sm mt-1">{errors.year}</p>
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
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.semester ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                >
                  <option value="">Select Semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
                {errors.semester && (
                  <p className="text-red-500 text-sm mt-1">{errors.semester}</p>
                )}
              </div>

              {/* Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Section
                </label>
                <select
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditStudentModal;