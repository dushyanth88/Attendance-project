import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';
import BulkUploadModal from '../components/BulkUploadModal';
import HolidayModal from '../components/HolidayModal';
import HolidayManagement from '../components/HolidayManagement';

const ClassAttendanceManagement = () => {
  const { classId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mark');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [attendanceStartDate, setAttendanceStartDate] = useState('');
  const [attendanceEndDate, setAttendanceEndDate] = useState('');
  const [updatingDates, setUpdatingDates] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showHolidayManagement, setShowHolidayManagement] = useState(false);
  const [selectedHolidayDate, setSelectedHolidayDate] = useState('');

  useEffect(() => {
    if (classId) {
      fetchClassData();
    }
  }, [classId]);

  useEffect(() => {
    if (classData) {
      // Set attendance date states when classData is loaded
      if (classData.attendanceStartDate) {
        const startDate = new Date(classData.attendanceStartDate);
        setAttendanceStartDate(startDate.toISOString().split('T')[0]);
      }
      if (classData.attendanceEndDate) {
        const endDate = new Date(classData.attendanceEndDate);
        setAttendanceEndDate(endDate.toISOString().split('T')[0]);
      }
    }
  }, [classData]);

  const fetchClassData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching class data for classId:', classId);
      console.log('👤 Current user:', user);
      
      // Try to fetch class assignment details first using the MongoDB ObjectId
      let assignment = null;
      try {
        const classResponse = await apiFetch({
          url: `/api/class-assignment/${classId}`,
          method: 'GET'
        });

        console.log('📋 Class assignment response:', classResponse.data);

        if (classResponse.data.status === 'success') {
          assignment = classResponse.data.data;
          console.log('🔍 Assignment data:', assignment);
          console.log('👨‍🏫 Faculty ID:', assignment.facultyId);
        }
      } catch (assignmentError) {
        console.log('⚠️ No formal class assignment found, using fallback approach');
        console.log('Assignment error:', assignmentError);
      }
      
      // Create class data with or without formal assignment
      const newClassData = {
        batch: assignment?.batch || 'Unknown',
        year: assignment?.year || 'Unknown',
        semester: assignment?.semester || 1,
        section: assignment?.section || 'A',
        department: user.department,
        facultyId: assignment?.facultyId || null, // Include faculty information if available
        assignedBy: assignment?.assignedBy || null,
        attendanceStartDate: assignment?.attendanceStartDate || null,
        attendanceEndDate: assignment?.attendanceEndDate || null
      };
      
      setClassData(newClassData);
      
      console.log('✅ Class data set:', newClassData);
      
      // Fetch students for this class using the faculty students endpoint
      const studentsResponse = await apiFetch({
        url: `/api/faculty/students?batch=${encodeURIComponent(newClassData.batch)}&year=${encodeURIComponent(newClassData.year)}&semester=${newClassData.semester}&section=${encodeURIComponent(newClassData.section)}&department=${encodeURIComponent(user.department)}`,
        method: 'GET'
      });

      console.log('👥 Students response:', studentsResponse.data);

      if (studentsResponse.data.success) {
        setStudents(studentsResponse.data.data.students || []);
        console.log('✅ Students loaded:', studentsResponse.data.data.students?.length || 0);
      }
      
    } catch (error) {
      console.error('Error fetching class data:', error);
      setToast({ show: true, message: 'Error loading class data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const studentsResponse = await apiFetch({
        url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&section=${encodeURIComponent(classData.section)}&department=${encodeURIComponent(user.department)}`,
        method: 'GET'
      });

      if (studentsResponse.data.success) {
        setStudents(studentsResponse.data.data.students || []);
        console.log('✅ Students refreshed:', studentsResponse.data.data.students?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleStudentProfilePictureUpload = async (event, studentId) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Please select a valid image file (JPEG, PNG, GIF, WebP)', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      showToast('Image size must be less than 2MB', 'error');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await apiFetch({
        url: `/api/faculty/student-profile-picture/${studentId}`,
        method: 'POST',
        data: formData
      });

      if (response.data.success) {
        showToast(`Profile picture uploaded successfully for ${response.data.data.studentName}!`, 'success');
        // Refresh students list to show updated profile picture
        fetchStudents();
      } else {
        showToast(response.data.msg || 'Failed to upload profile picture', 'error');
      }
    } catch (error) {
      console.error('Error uploading student profile picture:', error);
      if (error.response?.status === 403) {
        showToast('Access denied. You are not the class advisor for this student.', 'error');
      } else {
        showToast('Failed to upload profile picture', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudentProfilePicture = async (studentId) => {
    if (!window.confirm('Are you sure you want to remove this student\'s profile picture?')) return;

    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/faculty/student-profile-picture/${studentId}`,
        method: 'DELETE'
      });

      if (response.data.success) {
        showToast(`Profile picture removed successfully for ${response.data.data.studentName}!`, 'success');
        // Refresh students list to show updated profile picture
        fetchStudents();
      } else {
        showToast(response.data.msg || 'Failed to remove profile picture', 'error');
      }
    } catch (error) {
      console.error('Error removing student profile picture:', error);
      if (error.response?.status === 403) {
        showToast('Access denied. You are not the class advisor for this student.', 'error');
      } else {
        showToast('Failed to remove profile picture', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/class-management');
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const testAttendanceDatesEndpoint = async () => {
    try {
      console.log('🧪 Testing attendance dates endpoint...');
      
      const response = await apiFetch({
        url: `/api/class-assignment/${classId}/attendance-dates/test`,
        method: 'GET'
      });
      
      console.log('✅ Test endpoint response:', response);
      showToast('Test endpoint working!', 'success');
    } catch (error) {
      console.error('❌ Test endpoint error:', error);
      showToast('Test endpoint failed: ' + error.message, 'error');
    }
  };

  const handleMarkHoliday = (date) => {
    setSelectedHolidayDate(date);
    setShowHolidayModal(true);
  };

  const handleHolidaySuccess = () => {
    setShowHolidayModal(false);
    setSelectedHolidayDate('');
    showToast('Holiday marked successfully!', 'success');
  };

  const updateAttendanceDates = async () => {
    try {
      setUpdatingDates(true);
      
      console.log('🔄 Updating attendance dates:', {
        classId,
        attendanceStartDate,
        attendanceEndDate
      });
      
      // Validate classId
      if (!classId) {
        showToast('Class ID is missing. Please refresh the page and try again.', 'error');
        return;
      }
      
      const response = await apiFetch({
        url: `/api/class-assignment/${classId}/attendance-dates`,
        method: 'PUT',
        data: {
          attendanceStartDate: attendanceStartDate && attendanceStartDate.trim() !== '' ? attendanceStartDate : null,
          attendanceEndDate: attendanceEndDate && attendanceEndDate.trim() !== '' ? attendanceEndDate : null
        }
      });

      console.log('✅ Attendance dates response:', response);

      if (response.data.status === 'success') {
        showToast('Attendance dates updated successfully!', 'success');
        // Refresh class data to get updated dates
        await fetchClassData();
      } else {
        showToast(response.data.message || 'Failed to update attendance dates', 'error');
      }
    } catch (error) {
      console.error('❌ Error updating attendance dates:', error);
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      let errorMessage = 'Error updating attendance dates';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setUpdatingDates(false);
    }
  };

  const tabs = [
    { id: 'mark', label: 'Mark Attendance', icon: '📝' },
    { id: 'history', label: 'Attendance History', icon: '📊' },
    { id: 'report', label: 'Generate Report', icon: '📈' },
    { id: 'students', label: 'Student Management', icon: '👥' },
    { id: 'dates', label: 'Attendance Dates', icon: '📅' },
    { id: 'holidays', label: 'Holiday Management', icon: '🎉' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading class data...</p>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Class Not Found</h2>
          <p className="text-gray-600 mb-4">
            The requested class could not be found or you don't have access to it.
          </p>
          <p className="text-gray-500 mb-6">
            This might happen if:
            <br />• The class assignment was removed
            <br />• You don't have permission to access this class
            <br />• The class ID is invalid
          </p>
          <button
            onClick={handleBackToDashboard}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Class Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-start gap-4">
              <button
                onClick={handleBackToDashboard}
                className="mt-1 p-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                title="Back to Class Management"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 mb-1 break-words">
                  Class Management - {classData.batch} | {classData.year} | Semester {classData.semester} | Section {classData.section}
                </h1>
                <p className="text-sm text-gray-500 mb-1">
                  Manage attendance, students, and generate reports for this class
                </p>
                {classData.facultyId ? (
                  <p className="text-sm text-blue-600 font-medium">
                    Class Teacher: {classData.facultyId.name || classData.facultyId}
                  </p>
                ) : (
                  <p className="text-sm text-blue-600 font-medium">
                    Class Teacher: {user.name} (Current User)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 bg-gradient-to-b from-white to-indigo-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
          </div>
        </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'mark' && (
          <MarkAttendanceTab 
            classData={classData} 
            students={students} 
            onToast={showToast}
            onStudentsUpdate={setStudents}
          />
        )}
        {activeTab === 'history' && (
          <AttendanceHistoryTab 
            classData={classData} 
            students={students} 
            onToast={showToast}
          />
        )}
        {activeTab === 'report' && (
          <AttendanceReportTab 
            classData={classData} 
            students={students} 
            onToast={showToast}
          />
        )}
        {activeTab === 'students' && (
          <StudentManagementTab 
            classData={classData} 
            students={students} 
            onToast={showToast}
            onStudentsUpdate={setStudents}
            user={user}
            onStudentProfilePictureUpload={handleStudentProfilePictureUpload}
            onRemoveStudentProfilePicture={handleRemoveStudentProfilePicture}
            navigate={navigate}
          />
        )}
        {activeTab === 'dates' && (
          <AttendanceDatesTab 
            classData={classData}
            attendanceStartDate={attendanceStartDate}
            attendanceEndDate={attendanceEndDate}
            setAttendanceStartDate={setAttendanceStartDate}
            setAttendanceEndDate={setAttendanceEndDate}
            updateAttendanceDates={updateAttendanceDates}
            testAttendanceDatesEndpoint={testAttendanceDatesEndpoint}
            updatingDates={updatingDates}
            onToast={showToast}
          />
        )}
        {activeTab === 'holidays' && (
          <HolidayManagementTab 
            onMarkHoliday={handleMarkHoliday}
            onShowHolidayManagement={() => setShowHolidayManagement(true)}
          />
        )}
      </div>

      {/* Holiday Modals */}
      <HolidayModal
        isOpen={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        onSuccess={handleHolidaySuccess}
        selectedDate={selectedHolidayDate}
      />
      
      <HolidayManagement
        isOpen={showHolidayManagement}
        onClose={() => setShowHolidayManagement(false)}
      />

      {/* Toast */}
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

// Mark Attendance Tab Component
const MarkAttendanceTab = ({ classData, students, onToast, onStudentsUpdate }) => {
  const [attendanceForm, setAttendanceForm] = useState({
    absentees: '',
    odRollNumbers: ''
  });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentAttendanceStatus, setStudentAttendanceStatus] = useState({});

  // Filter students based on search term
  const filteredStudents = students.filter(student => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      student.rollNumber?.toLowerCase().includes(searchLower) ||
      student.name?.toLowerCase().includes(searchLower) ||
      student.email?.toLowerCase().includes(searchLower)
    );
  });

  // Check if attendance has been marked for today
  const checkAttendanceStatus = async () => {
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const response = await apiFetch({
        url: `/api/attendance/history-by-class?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}&date=${todayISO}`,
        method: 'GET'
      });

      if (response.data.status === 'success' && response.data.data && response.data.data.records && response.data.data.records.length > 0) {
        // Check if any student has attendance marked (not "Not Marked")
        const hasMarkedAttendance = response.data.data.records.some(record => record.status !== 'Not Marked');
        setAttendanceMarked(hasMarkedAttendance);
      } else {
        setAttendanceMarked(false);
      }
    } catch (error) {
      console.error('Error checking attendance status:', error);
      setAttendanceMarked(false);
    }
  };

  // Fetch today's attendance status for all students
  const fetchStudentAttendanceStatus = async () => {
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const response = await apiFetch({
        url: `/api/attendance/history-by-class?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}&date=${todayISO}`,
        method: 'GET'
      });

      if (response.data.status === 'success' && response.data.data && response.data.data.records) {
        const attendanceMap = {};
        response.data.data.records.forEach(record => {
          attendanceMap[record.rollNo] = record.status;
        });
        setStudentAttendanceStatus(attendanceMap);
      } else {
        setStudentAttendanceStatus({});
      }
    } catch (error) {
      console.error('Error fetching student attendance status:', error);
      setStudentAttendanceStatus({});
    }
  };

  // Check attendance status when component loads
  useEffect(() => {
    checkAttendanceStatus();
    fetchStudentAttendanceStatus();
  }, [classData, students]);

  const handleAttendanceChange = (e) => {
    const { name, value } = e.target;
    setAttendanceForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditMode = () => {
    setEditMode(true);
    setAttendanceMarked(false); // Allow editing
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setAttendanceForm({ absentees: '', odRollNumbers: '' });
    checkAttendanceStatus(); // Re-check attendance status
  };

  // Show total class strength (not dynamic calculation)
  const totalClassStrength = students.length;

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    setAttendanceLoading(true);

    try {
      // Use today's date in ISO format for backend
      const todayISO = new Date().toISOString().split('T')[0];
      
      // Parse absent roll numbers
      const absentRollNumbers = (attendanceForm.absentees || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      
      // Parse OD roll numbers
      const odRollNumbers = (attendanceForm.odRollNumbers || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const requestData = {
        batch: classData.batch,
        year: classData.year,
        semester: parseInt(classData.semester), // Ensure semester is a number
        section: classData.section || 'A', // Default to 'A' if section is undefined
        date: todayISO,
        absentRollNumbers,
        odRollNumbers
      };

      // Validate request data
      if (!requestData.batch || !requestData.year || !requestData.semester) {
        throw new Error('Missing required class information');
      }

      if (!/^\d{4}-\d{4}$/.test(requestData.batch)) {
        throw new Error('Invalid batch format. Expected YYYY-YYYY');
      }

      if (!['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(requestData.year)) {
        throw new Error('Invalid year format');
      }

      if (isNaN(requestData.semester) || requestData.semester < 1 || requestData.semester > 8) {
        throw new Error('Invalid semester. Must be a number between 1-8');
      }

      console.log('📤 Sending attendance data:', requestData);
      console.log('📤 Class data:', classData);

      const response = await apiFetch({
        url: '/api/attendance/mark-students',
        method: 'POST',
        data: requestData
      });

      if (response.data.status === 'success') {
        onToast('Attendance marked successfully!', 'success');
        setAttendanceForm({ absentees: '', odRollNumbers: '' });
        setAttendanceMarked(true);
        setEditMode(false);
        // Refresh attendance status after marking
        fetchStudentAttendanceStatus();
      } else {
        onToast(response.data.message || 'Failed to mark attendance', 'error');
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: error.config
      });
      
      let errorMessage = 'Failed to mark attendance';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.msg) {
        errorMessage = error.response.data.msg;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        errorMessage = 'Network error: Unable to connect to server. Please check your connection.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. You are not authorized to mark attendance for this class.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Class or students not found. Please check your class assignment.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      onToast(errorMessage, 'error');
    } finally {
      setAttendanceLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-100">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl mr-3 shadow-lg">
            <span className="text-2xl">📝</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Mark Daily Attendance</h2>
            <p className="text-sm text-gray-600">Mark attendance for today's class</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        {/* Attendance Status Indicator */}
        {attendanceMarked && !editMode && (
          <div className="mb-6 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Attendance Already Marked
                </h3>
                <div className="mt-1 text-sm text-green-700">
                  <p>Attendance has been marked for today. Use the "✏️ Edit Attendance" button to make changes.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleMarkAttendance} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 Date
              </label>
                <input 
                type="text"
                  name="date" 
                value={new Date().toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric' 
                })}
                readOnly
                className="w-full px-4 py-3 border border-blue-300 rounded-xl bg-blue-50 cursor-not-allowed shadow-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Today's date - attendance can only be marked for today</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                👥 Total Class Strength
              </label>
              <input
                type="number"
                name="present"
                value={totalClassStrength}
                readOnly
                className="w-full px-4 py-3 border border-blue-300 rounded-xl bg-blue-50 shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
              ⏭️ Absent Students (Enter roll numbers separated by commas)
              </label>
              <textarea
                name="absentees"
                value={attendanceForm.absentees}
                onChange={handleAttendanceChange}
              placeholder="e.g., STU001, STU003, STU005"
                rows={3}
              className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
              📋 OD (On Duty) Students (Enter roll numbers separated by commas)
              </label>
              <textarea
                name="odRollNumbers"
                value={attendanceForm.odRollNumbers}
                onChange={handleAttendanceChange}
                placeholder="e.g., STU002, STU004"
                rows={3}
                className="w-full px-4 py-3 border border-green-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm bg-green-50"
              />
              <p className="text-xs text-gray-500 mt-1">OD students are considered present for attendance calculation</p>
            </div>

          <div className="flex justify-end space-x-3">
            {attendanceMarked && !editMode ? (
              <>
                <button
                  type="button"
                  onClick={handleEditMode}
                  className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-6 py-3 rounded-xl hover:from-yellow-600 hover:to-orange-700 transition-all duration-200 shadow-lg font-semibold"
                >
                  ✏️ Edit Attendance
                </button>
                <div className="flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg font-semibold">
                  ✅ Attendance Marked
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-gradient-to-r from-gray-400 to-gray-500 text-white px-6 py-3 rounded-xl hover:from-gray-500 hover:to-gray-600 transition-all duration-200 shadow-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attendanceLoading || (attendanceMarked && !editMode)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg font-semibold"
                >
                  {attendanceLoading ? 'Marking...' : editMode ? 'Update Attendance' : 'Mark Attendance'}
                </button>
              </>
            )}
          </div>
          </form>

        {/* Students List */}
        <div className="mt-8 bg-gradient-to-br from-white to-purple-50 rounded-2xl p-6 border border-purple-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800">
                Students in Class
              </h3>
            </div>
            <div className="text-sm text-gray-600 font-semibold bg-white px-4 py-2 rounded-xl shadow-sm">
              {searchTerm ? (
                `Showing ${filteredStudents.length} of ${students.length} students`
              ) : (
                `Total Strength: ${students.length} students`
              )}
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by roll number, name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-purple-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-purple-500 sm:text-sm shadow-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-purple-100 to-pink-100">
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
                      Attendance Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                        {searchTerm ? (
                          <div>
                            <div className="text-gray-400 text-4xl mb-2">🔍</div>
                            <p className="text-lg font-medium">No students found</p>
                            <p className="text-sm">No students match your search for "{searchTerm}"</p>
                            <button
                              onClick={() => setSearchTerm('')}
                              className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
                            >
                              Clear search
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="text-gray-400 text-4xl mb-2">👥</div>
                            <p className="text-lg font-medium">No students in class</p>
                            <p className="text-sm">No students are assigned to this class yet.</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student._id || student.id} className="hover:bg-purple-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.rollNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {(() => {
                            const status = studentAttendanceStatus[student.rollNumber] || 'Not Marked';
                            return (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                status === 'Present' ? 'bg-green-100 text-green-800' :
                                status === 'OD' ? 'bg-blue-100 text-blue-800' :
                                status === 'Absent' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {status === 'Present' ? '✅ Present' :
                                 status === 'OD' ? '📋 OD' :
                                 status === 'Absent' ? '❌ Absent' :
                                 '⏳ Not Marked'}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Attendance History Tab Component
const AttendanceHistoryTab = ({ classData, students, onToast }) => {
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('today'); // 'today' or 'specificDate'
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [specificDate, viewMode]);

  const fetchAttendanceHistory = async () => {
    try {
      setLoading(true);
      const allRecords = [];
      
      if (viewMode === 'today') {
        // Fetch only today's attendance
        const todayString = new Date().toISOString().split('T')[0];
        
        try {
          const response = await apiFetch({
            url: `/api/attendance/history-by-class?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}&date=${todayString}`,
            method: 'GET'
          });

          if (response.data.status === 'success' && response.data.data && response.data.data.records) {
            const records = response.data.data.records;
            if (records.length > 0) {
              // Group records by date and calculate summary
              const dateRecords = records.reduce((acc, record) => {
                const recordDate = todayString; // Use the date we queried for
                if (!acc[recordDate]) {
                  acc[recordDate] = {
                    date: recordDate,
                    presentCount: 0,
                    absentCount: 0,
                    totalStudents: students.length,
                    records: []
                  };
                }
                
                // OD is counted as Present for calculations
                if (record.status === 'Present' || record.status === 'OD') {
                  acc[recordDate].presentCount++;
                } else if (record.status === 'Absent') {
                  acc[recordDate].absentCount++;
                }
                
                acc[recordDate].records.push(record);
                return acc;
              }, {});
              
              // Add summary records to allRecords
              Object.values(dateRecords).forEach(summary => {
                allRecords.push(summary);
              });
            }
          }
        } catch (dateError) {
          console.error(`Error fetching attendance for today:`, dateError);
        }
      } else {
        // Fetch attendance for specific date
        try {
          const response = await apiFetch({
            url: `/api/attendance/history-by-class?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}&date=${specificDate}`,
            method: 'GET'
          });

          if (response.data.status === 'success' && response.data.data && response.data.data.records) {
            const records = response.data.data.records;
            if (records.length > 0) {
              // Group records by date and calculate summary
              const dateRecords = records.reduce((acc, record) => {
                const recordDate = specificDate; // Use the specific date we queried for
                if (!acc[recordDate]) {
                  acc[recordDate] = {
                    date: recordDate,
                    presentCount: 0,
                    absentCount: 0,
                    totalStudents: students.length,
                    records: []
                  };
                }
                
                // OD is counted as Present for calculations
                if (record.status === 'Present' || record.status === 'OD') {
                  acc[recordDate].presentCount++;
                } else if (record.status === 'Absent') {
                  acc[recordDate].absentCount++;
                }
                
                acc[recordDate].records.push(record);
                return acc;
              }, {});
              
              // Add summary records to allRecords
              Object.values(dateRecords).forEach(summary => {
                allRecords.push(summary);
              });
            } else {
              // Add empty record for dates with no attendance
              allRecords.push({
                date: specificDate,
                presentCount: 0,
                absentCount: 0,
                totalStudents: students.length,
                records: []
              });
            }
          } else {
            // Add empty record for dates with no attendance
            allRecords.push({
              date: specificDate,
              presentCount: 0,
              absentCount: 0,
              totalStudents: students.length,
              records: []
            });
          }
        } catch (dateError) {
          console.error(`Error fetching attendance for ${specificDate}:`, dateError);
          // Add empty record for dates with errors
          allRecords.push({
            date: specificDate,
            presentCount: 0,
            absentCount: 0,
            totalStudents: students.length,
            records: []
          });
        }
      }
      
      // Sort records by date (newest first)
      allRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAttendanceHistory(allRecords);
      
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      onToast('Error loading attendance history', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Attendance History</h2>
        <p className="text-sm text-gray-500">View detailed attendance records</p>
      </div>
      <div className="p-6">
        {/* View Mode Toggle */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">View Mode</label>
          <div className="flex space-x-4">
            <button
              onClick={() => setViewMode('today')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Today
            </button>
            <button
              onClick={() => setViewMode('specificDate')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'specificDate'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Specific Date
            </button>
          </div>
        </div>

        {/* Specific Date Input - Only show when specificDate mode is selected */}
        {viewMode === 'specificDate' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-600">
            {viewMode === 'today' 
              ? `Showing today's attendance (${new Date().toLocaleDateString()})`
              : `Showing attendance for ${new Date(specificDate).toLocaleDateString()}`
            }
          </div>
          <button
            onClick={fetchAttendanceHistory}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {attendanceHistory.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Records Found</h3>
            <p className="text-gray-500">No attendance records found for the selected date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceHistory.map((record, index) => (
                  <tr key={record.date || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.presentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.absentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.totalStudents > 0 ? ((record.presentCount / record.totalStudents) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
        )}
      </div>
    </div>
  );
};

// Attendance Report Tab Component
const AttendanceReportTab = ({ classData, students, onToast }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateAbsenteesReport = async () => {
    try {
      setLoading(true);
      const todayISO = new Date().toISOString().split('T')[0];
      
      console.log('🔍 Generating absentees report with params:', {
        batch: classData.batch,
        year: classData.year,
        semester: classData.semester,
        section: classData.section,
        startDate: todayISO,
        endDate: todayISO
      });
      
      const response = await apiFetch({
        url: `/api/report/absentees?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}&startDate=${todayISO}&endDate=${todayISO}`,
        method: 'GET'
      });

      console.log('📊 API Response:', response.data);

      if (response.data.success) {
        setReportData(response.data.data);
        onToast('Today\'s absentees report generated successfully!', 'success');
      } else {
        console.error('❌ API returned error:', response.data);
        onToast(response.data.message || 'Failed to generate absentees report', 'error');
      }
    } catch (error) {
      console.error('❌ Error generating absentees report:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // Check for specific error types
      if (error.response?.status === 401) {
        onToast('Authentication failed. Please log in again.', 'error');
      } else if (error.response?.status === 403) {
        onToast('Access denied. You do not have permission to generate reports.', 'error');
      } else if (error.response?.data?.message) {
        onToast(`Error: ${error.response.data.message}`, 'error');
      } else {
        onToast('Error generating absentees report', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadExcelReport = () => {
    if (!reportData) return;
    
    // Import XLSX dynamically
    import('xlsx').then((XLSX) => {
      const todayISO = new Date().toISOString().split('T')[0];
      const worksheetData = [
        ['S.No', 'Roll Number', 'Name', 'Total Days Absent', 'Reason', 'Action Taken', 'Attendance %'],
        ...reportData.absentees.map(student => [
          student.sNo,
          student.rollNumber,
          student.name,
          student.totalDaysAbsent,
          student.reason,
          student.actionTaken,
          `${student.attendancePercentage.toFixed(1)}%`
        ])
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Absentees Report');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `absentees-report-${classData.batch}-${todayISO}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      onToast('Excel report downloaded successfully!', 'success');
    }).catch(error => {
      console.error('Error downloading Excel report:', error);
      onToast('Error downloading Excel report', 'error');
    });
  };

  const downloadPDFReport = () => {
    if (!reportData) return;
    
    // Create a simple PDF using browser's print functionality
    const printWindow = window.open('', '_blank');
    const todayISO = new Date().toISOString().split('T')[0];
    const reportContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Today's Absentees Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .class-info { margin-bottom: 20px; }
          .summary { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .no-data { text-align: center; color: #666; margin: 40px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Today's Absentees Report</h1>
          <h2>${reportData.classInfo.batch} | ${reportData.classInfo.year} | Semester ${reportData.classInfo.semester} | Section ${reportData.classInfo.section}</h2>
          <p><strong>Date:</strong> ${new Date(todayISO).toLocaleDateString()}</p>
        </div>
        
        <div class="class-info">
          <p><strong>Department:</strong> ${reportData.classInfo.department}</p>
        </div>
        
        <div class="summary">
          <p><strong>Total Students:</strong> ${reportData.reportInfo.totalStudents}</p>
          <p><strong>Total Absentees:</strong> ${reportData.reportInfo.totalAbsentees}</p>
        </div>
        
        ${reportData.absentees.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Roll Number</th>
                <th>Name</th>
                <th>Total Days Absent</th>
                <th>Reason</th>
                <th>Action Taken</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.absentees.map(student => `
                <tr>
                  <td>${student.sNo}</td>
                  <td>${student.rollNumber}</td>
                  <td>${student.name}</td>
                  <td>${student.totalDaysAbsent}</td>
                  <td>${student.reason}</td>
                  <td>${student.actionTaken}</td>
                  <td>${student.attendancePercentage.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="no-data">
            <h3>No Absentees Found</h3>
            <p>All students have perfect attendance for today.</p>
          </div>
        `}
      </body>
      </html>
    `;
    
    printWindow.document.write(reportContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
    
    onToast('PDF report opened for printing!', 'success');
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Generate Today's Absentees Report</h2>
        <p className="text-sm text-gray-500">Create and download today's absentees report with roll number, name, total days absent, reason, and action taken</p>
      </div>
      <div className="p-6">
        {/* Today's Date Display */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Report Date
              </h3>
              <div className="mt-1 text-sm text-blue-700">
                <p>{new Date().toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric' 
                })} - Today's absentees will be included in the report</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <button
            onClick={generateAbsenteesReport}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                📈 Generate Today's Report
              </>
            )}
          </button>
        </div>

        {reportData && (
          <div className="space-y-6">
            {/* Report Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900">Total Students</h3>
                <p className="text-2xl font-bold text-blue-600">{reportData.reportInfo.totalStudents}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-red-900">Today's Absentees</h3>
                <p className="text-2xl font-bold text-red-600">{reportData.reportInfo.totalAbsentees}</p>
              </div>
            </div>

            {/* Absentees Table */}
            {reportData.absentees.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Days Absent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action Taken</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.absentees.map((student) => (
                      <tr key={student.rollNumber} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.sNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.rollNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {student.totalDaysAbsent} days
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          <div className="truncate" title={student.reason}>
                            {student.reason}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          <div className="truncate" title={student.actionTaken}>
                            {student.actionTaken}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 text-6xl mb-4">✅</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Absentees Found</h3>
                <p className="text-gray-500">All students have perfect attendance for today.</p>
              </div>
            )}

            {/* Download Buttons */}
            {reportData.absentees.length > 0 && (
              <div className="flex justify-end space-x-3">
                <button
                  onClick={downloadExcelReport}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Excel
                </button>
                <button
                  onClick={downloadPDFReport}
                  className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Student Management Tab Component
const StudentManagementTab = ({ classData, students, onToast, onStudentsUpdate, user, onStudentProfilePictureUpload, onRemoveStudentProfilePicture, navigate }) => {
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [loading, setLoading] = useState(false);

  // Debug classData
  useEffect(() => {
    console.log('🔍 StudentManagementTab - classData:', classData);
  }, [classData]);

  const handleAddStudent = async (studentData) => {
    try {
      setLoading(true);
      
      // Prepare data with correct format
      const studentPayload = {
        ...studentData,
        batch: classData.batch,
        year: classData.year,
        semester: `Sem ${classData.semester}`, // Convert to 'Sem 1', 'Sem 2', etc.
        section: classData.section,
        department: user.department // Use user.department instead of classData.department
      };

      console.log('🔍 Adding student with data:', studentPayload);
      console.log('🔍 User department:', user.department);
      console.log('🔍 Class data:', classData);
      console.log('🔍 Semester conversion:', `${classData.semester} -> Sem ${classData.semester}`);

//       const response = await apiFetch({
//         url: '/api/faculty/students',
//         method: 'POST',
//         data: studentPayload
//       });

//       // if (response.data.success) {
//       //   onToast('Student added successfully!', 'success');
//       //   setShowAddStudent(false);
//       //   // Refresh students list
//       //   const studentsResponse = await apiFetch({
//       //     url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&department=${encodeURIComponent(classData.department)}`,
//       //     method: 'GET'
//       //   });
//       //   if (studentsResponse.data.success) {
//       //     onStudentsUpdate(studentsResponse.data.data.students || []);
//       //   }
//       // } else {
//       //   onToast(response.data.message || 'Failed to add student', 'error');
//       // }
//       //new
      
// if (response.data.success) {
//   showToast('Student added!', 'success');
//   try {
//     if (classData.batch && classData.year && classData.semester && classData.department) {
//       const studentsResponse = await apiFetch({
//         url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&department=${encodeURIComponent(classData.department)}`,
//         method: 'GET'
//       });
//       if (studentsResponse.data.success) {
//         onStudentsUpdate(studentsResponse.data.data.students || []);
//       }
//     }
//   } catch (err) {
//     // Just log, do not show an error toast
//     console.warn('Failed to reload students after add:', err);
//   }
// } else {
//   showToast('Failed to add student', 'error');
// }

const response = await apiFetch({
  url: '/api/faculty/students',
  method: 'POST',
  data: studentPayload
});

if (response.data.success) {
  onToast('Student added successfully!', 'success');
  setShowAddStudent(false);
  try {
    if (classData.batch && classData.year && classData.semester && classData.section && classData.department) {
      const studentsResponse = await apiFetch({
        url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&section=${encodeURIComponent(classData.section)}&department=${encodeURIComponent(user.department)}`,
        method: 'GET'
      });
      if (studentsResponse.data.success) {
        onStudentsUpdate(studentsResponse.data.data.students || []);
      }
      // Do NOT show toast if reload fails - student was already added successfully
    }
  } catch (err) {
    // Silently fail reload - student was already added successfully
    console.warn('Failed to reload students list after add:', err);
  }
} else {
  onToast(response.data.message || 'Failed to add student', 'error');
}
    } catch (error) {
      console.error('Error adding student:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Error adding student';
      if (error.response?.status === 400) {
        // Handle validation errors
        if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
          const validationErrors = error.response.data.errors.map(err => err.msg).join(', ');
          errorMessage = `Validation failed: ${validationErrors}`;
        } else if (error.response.data.message) {
          errorMessage = `Validation failed: ${error.response.data.message}`;
        } else {
          errorMessage = 'Validation failed: Please check all required fields';
        }
      } else if (error.response?.status === 401) {
        errorMessage = 'Unauthorized: You do not have permission to add students. Please contact your administrator.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Forbidden: You are not authorized to add students to this class.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      onToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudent = async (studentId, studentData) => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/faculty/students/${studentId}`,
        method: 'PUT',
        data: studentData
      });

      if (response.data.success) {
        onToast('Student updated successfully!', 'success');
        setEditingStudent(null);
        // Refresh students list
        const studentsResponse = await apiFetch({
          url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&department=${encodeURIComponent(classData.department)}`,
          method: 'GET'
        });
        if (studentsResponse.data.success) {
          onStudentsUpdate(studentsResponse.data.data.students || []);
        }
      } else {
        onToast(response.data.message || 'Failed to update student', 'error');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      onToast('Error updating student', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;

    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/faculty/delete-student/${studentId}`,
        method: 'DELETE'
      });

      // if (response.data.success) {
      //   onToast('Student deleted successfully!', 'success');
      //   // Refresh students list
      //   const studentsResponse = await apiFetch({
      //     url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&department=${encodeURIComponent(classData.department)}`,
      //     method: 'GET'
      //   });
      //   if (studentsResponse.data.success) {
      //     onStudentsUpdate(studentsResponse.data.data.students || []);
      //   }
      // } else {
      //   onToast(response.data.message || 'Failed to delete student', 'error');
      // }
      if (response.data.success) {
        onToast('Student deleted successfully!', 'success');
        // Reload students, do NOT show toast if the reload fails
        try {
          if (classData.batch && classData.year && classData.semester && classData.department) {
            const studentsResponse = await apiFetch({
              url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&department=${encodeURIComponent(classData.department)}`,
              method: 'GET'
            });
            if (studentsResponse.data.success) {
              onStudentsUpdate(studentsResponse.data.data.students || []);
            }
          }
        } catch (error) {
          // Just log the error, don't show a toast
          console.warn('Error reloading students after deletion:', error);
        }
      } else {
        onToast(response.data.message || 'Failed to delete student', 'error');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      onToast('Error deleting student', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = () => {
    setShowBulkUpload(true);
  };

  const closeBulkUpload = () => {
    setShowBulkUpload(false);
  };

  const handleStudentsAdded = async () => {
    // Refresh the students list after bulk upload
    try {
      const studentsResponse = await apiFetch({
        url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&department=${encodeURIComponent(classData.department)}`,
        method: 'GET'
      });
      if (studentsResponse.data.success) {
        onStudentsUpdate(studentsResponse.data.data.students || []);
        onToast('Students list refreshed successfully!', 'success');
      }
    } catch (error) {
      console.error('Error refreshing students list:', error);
      onToast('Error refreshing students list', 'error');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Student Management</h2>
            <p className="text-sm text-gray-500">Manage students in this class</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleBulkUpload}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Bulk Upload
            </button>
            <button
              onClick={() => setShowAddStudent(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add Student
            </button>
          </div>
        </div>
      </div>
      <div className="p-6">
        {students.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Found</h3>
            <p className="text-gray-500 mb-4">No students are enrolled in this class yet.</p>
            <button
              onClick={() => setShowAddStudent(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add First Student
            </button>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student._id || student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        <div className="relative group">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-300 flex items-center justify-center">
                            {student.userId?.profileImage ? (
                              <img 
                                src={student.userId.profileImage} 
                                alt={student.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-gray-600 font-semibold text-sm">
                                {student.name?.charAt(0) || 'S'}
                              </span>
                            )}
                          </div>
                          
                          {/* Upload/Remove Overlay */}
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                            <div className="flex flex-col items-center space-y-1 pointer-events-auto">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => onStudentProfilePictureUpload(e, student._id || student.id)}
                                className="hidden"
                                id={`student-profile-picture-upload-${student._id || student.id}`}
                              />
                              <label
                                htmlFor={`student-profile-picture-upload-${student._id || student.id}`}
                                className="text-white text-xs cursor-pointer hover:text-blue-200 transition-colors"
                              >
                                📷
                              </label>
                              {student.userId?.profileImage && (
                                <button
                                  onClick={() => onRemoveStudentProfilePicture(student._id || student.id)}
                                  className="text-white text-xs hover:text-red-200 transition-colors"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.rollNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <button
                        onClick={() => navigate(`/student-profile/${student._id || student.id}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors duration-200"
                      >
                        {student.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.mobile || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.parentContact || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student._id || student.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (
        <AddStudentModal
          onClose={() => setShowAddStudent(false)}
          onAdd={handleAddStudent}
          loading={loading}
          classData={classData}
        />
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={handleEditStudent}
          loading={loading}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkUploadModal
          isOpen={showBulkUpload}
          onClose={closeBulkUpload}
          onStudentsAdded={handleStudentsAdded}
          classInfo={{ 
            batch: classData.batch, 
            year: classData.year, 
            semester: classData.semester, 
            section: classData.section || 'A', 
            department: classData.department 
          }}
        />
      )}
    </div>
  );
};

// Add Student Modal Component
const AddStudentModal = ({ onClose, onAdd, loading, classData }) => {
  const [formData, setFormData] = useState({
    rollNumber: '',
    name: '',
    email: '',
    mobile: '',
    parentContact: '',
    password: '',
    // Default values from class context
    batch: classData?.batch || '',
    year: classData?.year || '',
    semester: classData?.semester || '',
    section: classData?.section || '',
    department: classData?.department || ''
  });

  // Update form data when classData changes
  useEffect(() => {
    console.log('🔍 AddStudentModal - classData received:', classData);
    if (classData) {
      setFormData(prev => ({
        ...prev,
        batch: classData.batch || '',
        year: classData.year || '',
        semester: classData.semester || '',
        section: classData.section || '',
        department: classData.department || ''
      }));
      console.log('✅ AddStudentModal - formData updated with class info:', {
        batch: classData.batch,
        year: classData.year,
        semester: classData.semester,
        section: classData.section
      });
    }
  }, [classData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Student</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Class Information (Read-only) */}
            <div className="bg-blue-50 p-3 rounded-md">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Class Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-blue-700">Batch:</span>
                  <span className="ml-1 font-medium">{formData.batch || 'Loading...'}</span>
                </div>
                <div>
                  <span className="text-blue-700">Year:</span>
                  <span className="ml-1 font-medium">{formData.year || 'Loading...'}</span>
                </div>
                <div>
                  <span className="text-blue-700">Semester:</span>
                  <span className="ml-1 font-medium">{formData.semester || 'Loading...'}</span>
                </div>
                <div>
                  <span className="text-blue-700">Section:</span>
                  <span className="ml-1 font-medium">{formData.section || 'Loading...'}</span>
                </div>
              </div>
              {!formData.batch && (
                <p className="text-xs text-blue-600 mt-2">
                  Class information will be loaded automatically from the selected class.
                </p>
              )}
            </div>

            {/* Student Information */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Roll Number *</label>
              <input
                type="text"
                name="rollNumber"
                value={formData.rollNumber}
                onChange={handleChange}
                placeholder="e.g., STU001, CS2024001"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter student's full name"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="student@example.com"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Student Mobile *</label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                pattern="[0-9]{10}"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Parent's Contact *</label>
              <input
                type="tel"
                name="parentContact"
                value={formData.parentContact}
                onChange={handleChange}
                placeholder="Parent's mobile number"
                pattern="[0-9]{10}"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                minLength="6"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Edit Student Modal Component
const EditStudentModal = ({ student, onClose, onSave, loading }) => {
  const [formData, setFormData] = useState({
    rollNumber: student.rollNumber || '',
    name: student.name || '',
    email: student.email || '',
    mobile: student.mobile || '',
    parentContact: student.parentContact || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(student._id || student.id, formData);
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Student</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Roll Number</label>
              <input
                type="text"
                name="rollNumber"
                value={formData.rollNumber}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mobile</label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Parent Contact</label>
              <input
                type="tel"
                name="parentContact"
                value={formData.parentContact}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Attendance Dates Tab Component
const AttendanceDatesTab = ({ 
  classData, 
  attendanceStartDate, 
  attendanceEndDate, 
  setAttendanceStartDate, 
  setAttendanceEndDate, 
  updateAttendanceDates, 
  testAttendanceDatesEndpoint,
  updatingDates, 
  onToast 
}) => {
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate dates
    if (attendanceStartDate && attendanceEndDate) {
      const startDate = new Date(attendanceStartDate);
      const endDate = new Date(attendanceEndDate);
      
      if (startDate >= endDate) {
        onToast('Start date must be before end date', 'error');
        return;
      }
    }
    
    await updateAttendanceDates();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Attendance Date Range</h3>
        <p className="mt-1 text-sm text-gray-500">
          Set the date range for marking attendance. Attendance can only be marked within this period.
        </p>
      </div>
      
      <div className="px-6 py-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start Date */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                Attendance Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={attendanceStartDate}
                onChange={(e) => setAttendanceStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Select start date"
              />
              <p className="mt-1 text-xs text-gray-500">
                Attendance marking will begin from this date
              </p>
            </div>

            {/* End Date */}
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                Attendance End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={attendanceEndDate}
                onChange={(e) => setAttendanceEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Select end date (optional)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Attendance marking will end on this date (optional)
              </p>
            </div>
          </div>

          {/* Current Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Current Status</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                <span>
                  <strong>Start Date:</strong> {attendanceStartDate ? new Date(attendanceStartDate).toLocaleDateString() : 'Not set'}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span>
                  <strong>End Date:</strong> {attendanceEndDate ? new Date(attendanceEndDate).toLocaleDateString() : 'Not set (unlimited)'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={testAttendanceDatesEndpoint}
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors"
            >
              Test Endpoint
            </button>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setAttendanceStartDate('');
                  setAttendanceEndDate('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Clear Dates
              </button>
              <button
                type="submit"
                disabled={updatingDates}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updatingDates ? 'Updating...' : 'Update Dates'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Holiday Management Tab Component
const HolidayManagementTab = ({ onMarkHoliday, onShowHolidayManagement }) => {
  const [selectedDate, setSelectedDate] = useState('');

  const handleMarkHoliday = () => {
    if (!selectedDate) {
      alert('Please select a date first');
      return;
    }
    onMarkHoliday(selectedDate);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Holiday Management</h2>
        <p className="text-sm text-gray-600 mt-1">
          Mark holidays to prevent attendance marking on those dates
        </p>
      </div>
      
      <div className="p-6">
        <div className="space-y-6">
          {/* Quick Holiday Marking */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-amber-800 mb-3">Quick Holiday Marking</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date to Mark as Holiday
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleMarkHoliday}
                disabled={!selectedDate}
                className="w-full bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <span className="mr-2">🎉</span>
                Mark as Holiday
              </button>
            </div>
          </div>

          {/* Holiday Management */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">Manage Existing Holidays</h3>
            <p className="text-sm text-blue-700 mb-4">
              View, edit, or delete existing holidays for your department
            </p>
            <button
              onClick={onShowHolidayManagement}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
            >
              <span className="mr-2">📅</span>
              View All Holidays
            </button>
          </div>

          {/* Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Holiday Information</h3>
            <div className="text-sm text-gray-700 space-y-2">
              <p>• <strong>Sundays:</strong> Automatically treated as holidays (no attendance marking allowed)</p>
              <p>• <strong>Marked Holidays:</strong> Faculty-declared holidays (no attendance marking allowed)</p>
              <p>• <strong>Working Days:</strong> Only weekdays without holidays count towards attendance percentage</p>
              <p>• <strong>Department-wise:</strong> Holidays are specific to your department</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ClassAttendanceManagement;
