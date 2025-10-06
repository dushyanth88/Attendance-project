import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AddStudentModal from '../../components/AddStudentModal';
import HolidayModal from '../../components/HolidayModal';
import HolidayManagement from '../../components/HolidayManagement';
import Toast from '../../components/Toast';
import { apiFetch } from '../../utils/apiFetch';

const FacultyDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [assignedClass, setAssignedClass] = useState(null);
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showHolidayManagement, setShowHolidayManagement] = useState(false);
  const [studentRefreshTrigger, setStudentRefreshTrigger] = useState(0);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [attendanceForm, setAttendanceForm] = useState({ 
    date: new Date().toISOString().slice(0,10), 
    absentees: '' 
  });
  const [attendanceToast, setAttendanceToast] = useState({ show: false, message: '', type: 'success' });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState('');
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().slice(0,10));
  const [historyRows, setHistoryRows] = useState([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [checkingAttendanceStatus, setCheckingAttendanceStatus] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);

  // Fetch student count for the assigned class using Student Management endpoint
  const fetchStudentCount = useCallback(async (classId) => {
    if (!classId) return;
    
    try {
      // If facultyProfile exists, prefer batch/year/semester
      if (facultyProfile?.batch && facultyProfile?.year && facultyProfile?.semester) {
      const res = await apiFetch({ 
          url: `/api/students?batch=${encodeURIComponent(facultyProfile.batch)}&year=${encodeURIComponent(facultyProfile.year)}&semester=${encodeURIComponent(facultyProfile.semester)}`
      });
        if (res.data.success && res.data.data && Array.isArray(res.data.data.students)) {
        setTotalStudentsCount(res.data.data.students.length);
          return;
        }
      }
      setTotalStudentsCount(0);
    } catch (error) {
      console.error('Error fetching student count:', error);
      setTotalStudentsCount(0);
    }
  }, [facultyProfile?.batch, facultyProfile?.year, facultyProfile?.semester]);

  const fetchStudentsForAdvisor = useCallback(async () => {
    if (!facultyProfile?.batch || !facultyProfile?.year || !facultyProfile?.semester) return;
    setStudentsLoading(true);
    try {
      const url = `/api/students?batch=${encodeURIComponent(facultyProfile.batch)}&year=${encodeURIComponent(facultyProfile.year)}&semester=${encodeURIComponent(facultyProfile.semester)}${facultyProfile.section ? `&section=${encodeURIComponent(facultyProfile.section)}` : ''}`;
      const res = await apiFetch({ url });
      if (res.data?.success) {
        const list = res.data.data?.students || [];
        // normalize to view model
        setStudents(list.map(s => ({
          id: s.id,
          userId: s.userId, // Include userId for profile navigation
          rollNumber: s.roll_number,
          name: s.full_name,
          email: s.email,
          mobile: s.mobile_number
        })));
        setTotalStudentsCount(list.length);
      } else {
        setStudents([]);
        setToast({ show: true, message: res.data?.message || 'Failed to load students', type: 'error' });
      }
    } catch (e) {
      setStudents([]);
      setToast({ show: true, message: e?.response?.data?.message || 'Failed to load students', type: 'error' });
    } finally {
      setStudentsLoading(false);
    }
  }, [facultyProfile?.batch, facultyProfile?.year, facultyProfile?.semester, facultyProfile?.section]);

  // Fetch faculty profile including advisor details
  const fetchFacultyProfile = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/faculty/profile/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setFacultyProfile(data.data);
          
          // Set assigned class from profile or legacy field
          if (data.data.assignedClass && data.data.assignedClass !== 'None') {
            setAssignedClass(data.data.assignedClass);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching faculty profile:', error);
      // Fallback to legacy assigned class check
      if (user?.assignedClass && user.assignedClass !== 'None') {
        setAssignedClass(user.assignedClass);
      }
    }
  }, [user?.id, user?.assignedClass]);

  // Check if faculty is assigned as class teacher and fetch profile
  useEffect(() => {
    fetchFacultyProfile();
  }, [fetchFacultyProfile]);

  // Scroll to top when data loads
  useEffect(() => {
    if (facultyProfile && assignedClass) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [facultyProfile, assignedClass]);

  // Check attendance status when faculty profile is loaded and date changes
  useEffect(() => {
    if (facultyProfile && attendanceForm.date) {
      checkAttendanceStatus(attendanceForm.date);
    }
  }, [facultyProfile, attendanceForm.date]);

  // Check holiday status on mount and when date changes
  useEffect(() => {
    if (attendanceForm.date) {
      checkHolidayStatus(attendanceForm.date);
    }
  }, [attendanceForm.date]);

  // Fetch student count when assigned class changes
  useEffect(() => {
    if (assignedClass) {
      fetchStudentCount(assignedClass);
    }
    fetchStudentsForAdvisor();
  }, [assignedClass, studentRefreshTrigger, fetchStudentCount, fetchStudentsForAdvisor]);

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

  const handleAttendanceChange = (e) => {
    const { name, value } = e.target;
    setAttendanceForm(prev => ({ ...prev, [name]: value }));
    
    // Check holiday status and attendance status when date changes
    if (name === 'date') {
      checkHolidayStatus(value);
      checkAttendanceStatus(value);
    }
  };

  const checkHolidayStatus = async (date) => {
    try {
      const holidayCheck = await apiFetch({
        url: `/api/holidays/check/${date}`,
        method: 'GET'
      });
      
      if (holidayCheck.data?.data?.isHoliday) {
        setIsHoliday(true);
        setHolidayReason(holidayCheck.data.data.holiday.reason);
      } else {
        setIsHoliday(false);
        setHolidayReason('');
      }
    } catch (error) {
      console.error('Error checking holiday status:', error);
      setIsHoliday(false);
      setHolidayReason('');
    }
  };

  const checkAttendanceStatus = async (date) => {
    if (!facultyProfile?.batch || !facultyProfile?.year || !facultyProfile?.semester) return;
    
    setCheckingAttendanceStatus(true);
    try {
      const url = `/api/attendance/history-by-class?batch=${encodeURIComponent(facultyProfile.batch)}&year=${encodeURIComponent(facultyProfile.year)}&semester=${encodeURIComponent(facultyProfile.semester)}&date=${encodeURIComponent(date)}${facultyProfile.section ? `&section=${encodeURIComponent(facultyProfile.section)}` : ''}`;
      const res = await apiFetch({ url });
      
      if (res.data?.status === 'success' && res.data?.data?.records) {
        // Check if any student has been marked (Present or Absent)
        const hasMarkedStudents = res.data.data.records.some(record => 
          record.status === 'Present' || record.status === 'Absent'
        );
        setAttendanceMarked(hasMarkedStudents);
      } else {
        setAttendanceMarked(false);
      }
    } catch (error) {
      console.error('Error checking attendance status:', error);
      setAttendanceMarked(false);
    } finally {
      setCheckingAttendanceStatus(false);
    }
  };

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    if (!facultyProfile?.batch || !facultyProfile?.year || !facultyProfile?.semester) return;
    
    // Check if attendance has already been marked for this date
    if (attendanceMarked) {
      setAttendanceToast({ 
        show: true, 
        message: '⚠️ Attendance has already been marked for this date. Please use "Edit Today\'s Attendance" button to make changes.', 
        type: 'warning' 
      });
      return;
    }
    
    // Check if the selected date is a holiday
    try {
      const holidayCheck = await apiFetch({
        url: `/api/holidays/check/${attendanceForm.date}`,
        method: 'GET'
      });
      
      if (holidayCheck.data?.data?.isHoliday) {
        setAttendanceToast({
          show: true,
          message: `❌ Cannot mark attendance on ${attendanceForm.date}. This date is marked as a holiday: ${holidayCheck.data.data.holiday.reason}`,
          type: 'error'
        });
        return;
      }
    } catch (error) {
      console.error('Error checking holiday status:', error);
      // Continue with attendance marking if holiday check fails
    }
    
    setAttendanceLoading(true);
    try {
      // Parse absent roll numbers as strings to preserve leading zeros if any
      const absentRollNumbers = (attendanceForm.absentees || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      
      const res = await apiFetch({
        url: '/api/attendance/mark-students', 
        method: 'POST',
        data: { 
          batch: facultyProfile.batch,
          year: facultyProfile.year,
          semester: facultyProfile.semester,
          section: facultyProfile.section,
          date: attendanceForm.date, 
          absentRollNumbers
        }
      });
      const data = res.data;
      if (data.status === 'success') {
        const classInfo = `${facultyProfile.batch} | ${facultyProfile.year} | Semester ${facultyProfile.semester}${facultyProfile.section ? ` | Section ${facultyProfile.section}` : ''}`;
        setAttendanceToast({ 
          show: true, 
          message: `✅ Attendance marked successfully for ${classInfo} on ${attendanceForm.date}. ${data.data?.presentCount || 0} present, ${data.data?.absentCount || 0} absent.`, 
          type: 'success' 
        });
        // Clear the attendance field after successful marking and mark as attended
        setAttendanceForm(prev => ({ ...prev, absentees: '' }));
        setAttendanceMarked(true);
      } else {
        throw new Error(data.message || 'Error saving attendance');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error saving attendance';
      setAttendanceToast({ show: true, message: errorMessage, type: 'error' });
    } finally {
      setAttendanceLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl mr-3">👩‍🏫</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Faculty Dashboard</h1>
                <p className="text-gray-600">Welcome back, {user?.name}</p>
                <p className="text-sm text-blue-600">Department: {user?.department}</p>
                {facultyProfile && facultyProfile.is_class_advisor && (
                  <p className="text-sm text-green-600 font-medium">
                    ✅ Class Advisor for Batch {facultyProfile.batch}, {facultyProfile.year}, Semester {facultyProfile.semester}
                  </p>
                )}
                {facultyProfile && facultyProfile.position && (
                  <p className="text-sm text-gray-500">Position: {facultyProfile.position}</p>
                )}
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
        {/* Class Teacher Banner */}
        {assignedClass && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg">
            <div className="flex items-center">
              <span className="text-2xl mr-3">👨‍🏫</span>
              <div>
                <h3 className="text-lg font-semibold">You are Class Teacher for {assignedClass}</h3>
                <p className="text-sm opacity-90">Manage students in your assigned class</p>
              </div>
            </div>
          </div>
        )}

        {/* Cleaner UI: removed non-functional widgets */}

        {/* Attendance Section */}
        {assignedClass && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Attendance - {assignedClass}</h3>
            <form onSubmit={handleMarkAttendance} className="space-y-4">
              {/* Class and Date Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <input disabled value={assignedClass || ''} className="w-full px-3 py-2 border rounded-lg bg-gray-100" />
              </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input 
                        type="date" 
                        name="date" 
                        value={attendanceForm.date} 
                        disabled 
                        className={`w-full px-3 py-2 border rounded-lg bg-gray-100 ${isHoliday ? 'border-amber-300 bg-amber-50' : ''}`}
                      />
                      {isHoliday && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <span className="text-amber-500 text-sm">🎉</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setShowHolidayModal(true)}
                        className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center text-sm font-medium"
                        title="Mark this date as holiday"
                      >
                        <span className="text-sm mr-1">🎉</span>
                        Holiday
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowHolidayManagement(true)}
                        className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center text-sm font-medium"
                        title="Manage all holidays"
                      >
                        <span className="text-sm mr-1">⚙️</span>
                        Manage
                      </button>
                    </div>
                  </div>
                  {isHoliday && (
                    <p className="mt-1 text-sm text-amber-600 flex items-center">
                      <span className="mr-1">🎉</span>
                      This date is marked as a holiday: {holidayReason}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Attendance Marking Row */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Absent Roll Numbers (comma-separated)</label>
                <input 
                  type="text" 
                  name="absentees" 
                  value={attendanceForm.absentees} 
                  onChange={handleAttendanceChange} 
                  placeholder="e.g., 44, 7, 12" 
                  className="w-full px-3 py-2 border rounded-lg" 
                />
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  <strong>Note:</strong> Students not listed in absentees will be automatically marked as Present. Leave empty if all students are present.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={attendanceLoading || isHoliday || attendanceMarked} className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {attendanceLoading ? 'Saving...' : 
                   isHoliday ? 'Cannot mark attendance on holiday' : 
                   attendanceMarked ? 'Already Marked - Use Edit Button' : 
                   'Mark Attendance'}
            </button>
                <button type="button" onClick={async () => {
                  setAttendanceLoading(true);
                  try {
                    // Parse roll numbers as strings to preserve leading zeros if any
                    const absentRollNumbers = attendanceForm.absentees
                      .split(',')
                      .map(t => t.trim())
                      .filter(t => t.length > 0);
                    
                    const today = new Date().toISOString().slice(0,10);
                    const res = await apiFetch({ 
                      url: '/api/attendance/edit-students', 
                      method: 'PUT', 
                      data: { 
                        batch: facultyProfile.batch,
                        year: facultyProfile.year,
                        semester: facultyProfile.semester,
                        section: facultyProfile.section,
                        date: today,
                        absentRollNumbers
                      } 
                    });
                    const data = res.data;
                    if (data.status === 'success') {
                      const classInfo = `${facultyProfile.batch} | ${facultyProfile.year} | Semester ${facultyProfile.semester}${facultyProfile.section ? ` | Section ${facultyProfile.section}` : ''}`;
                      setAttendanceToast({ 
                        show: true, 
                        message: `✅ Today's attendance updated for ${classInfo}. ${data.data?.presentCount || 0} present, ${data.data?.absentCount || 0} absent.`, 
                        type: 'success' 
                      });
                    } else {
                      throw new Error(data.message || 'Failed to update attendance');
                    }
                  } catch (e) {
                    const errorMessage = e.response?.data?.message || e.message || 'Failed to update attendance';
                    setAttendanceToast({ show: true, message: errorMessage, type: 'error' });
                  } finally {
                    setAttendanceLoading(false);
                  }
                }} disabled={attendanceLoading || isHoliday} className={`w-full px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  attendanceMarked ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-400 text-white cursor-not-allowed'
                }`}>
                  {isHoliday ? 'Cannot edit on holiday' : 
                   attendanceMarked ? '✏️ Edit Today\'s Attendance' : 
                   'Edit Today\'s Attendance (Not Available)'}
                </button>
                </div>
            </form>
              </div>
        )}

        {/* Stats Overview with Class Management */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-3xl mr-3">🎒</span>
                <div>
                  <p className="text-sm text-gray-600">Total Students in {assignedClass}</p>
                  <p className="text-2xl font-bold text-gray-900">{totalStudentsCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Class Management Card - Only show if faculty is class advisor */}
          {facultyProfile && facultyProfile.is_class_advisor && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-3xl mr-3">📚</span>
                  <div>
                    <p className="text-sm text-gray-600">Class Management</p>
                    <p className="text-lg font-semibold text-gray-900">Manage Students by Batch</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Assigned Class: <span className="font-medium text-indigo-600">
                        {facultyProfile.assignedClass || `${facultyProfile.batch}, ${facultyProfile.year}, Sem ${facultyProfile.semester}`}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Redirect directly to student management for assigned class
                    if (facultyProfile.batch && facultyProfile.year && facultyProfile.semester && facultyProfile.department) {
                      navigate('/student-management', {
                        state: {
                          batch: facultyProfile.batch,
                          year: facultyProfile.year,
                          semester: facultyProfile.semester,
                          department: facultyProfile.department,
                          classTitle: `${facultyProfile.batch} | ${facultyProfile.year} | Semester ${facultyProfile.semester}`
                        }
                      });
                    } else {
                      // Fallback to class selection if data is incomplete
                      navigate('/class-selection');
                    }
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Manage Classes
                </button>
              </div>
            </div>
          )}

          {/* Non-advisor message */}
          {facultyProfile && !facultyProfile.is_class_advisor && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <span className="text-3xl mr-3">📚</span>
                <div>
                  <p className="text-sm text-gray-600">Class Management</p>
                  <p className="text-lg font-semibold text-gray-900">Not Assigned as Class Advisor</p>
                  <p className="text-sm text-gray-500 mt-1">
                    You are not assigned as a class advisor. Please contact your HOD or Admin.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Report Generation Card */}
        {assignedClass && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-3xl mr-3">📝</span>
                <div>
                    <p className="text-sm text-gray-600">Report Generation</p>
                    <p className="text-sm text-gray-500">Generate detailed absentees reports with cumulative data</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/report-generation', { 
                    state: { 
                      facultyProfile: facultyProfile 
                    } 
                  })}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Generate Report
                </button>
              </div>
            </div>
          )}

        {/* Attendance History */}
        {assignedClass && (
          <div className="mb-8 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Attendance History</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <input disabled value={assignedClass || ''} className="w-full px-3 py-2 border rounded-lg bg-gray-100" />
              </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
                <div>
                <button type="button" onClick={async () => {
                  try {
                    const url = `/api/attendance/history-by-class?batch=${encodeURIComponent(facultyProfile.batch)}&year=${encodeURIComponent(facultyProfile.year)}&semester=${encodeURIComponent(facultyProfile.semester)}&date=${encodeURIComponent(historyDate)}${facultyProfile.section ? `&section=${encodeURIComponent(facultyProfile.section)}` : ''}`;
                    const res = await apiFetch({ url });
                    const data = res.data;
                    if (data.status === 'success') {
                      setHistoryRows(data.data?.records || []);
                    } else {
                      setHistoryRows([]);
                    }
                  } catch (error) {
                    console.error('Error fetching history:', error);
                    setHistoryRows([]);
                  }
                }} className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors">View Attendance</button>
                </div>
              </div>
            <div className="mt-4 border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyRows.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-6 py-4 text-sm text-gray-500">No records found.</td>
                    </tr>
                  )}
                  {historyRows.map((r, idx) => (
                    <tr key={`${r.rollNumber || r.rollNo}-${idx}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.rollNumber || r.rollNo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.name}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        r.status === 'Present' ? 'text-green-600' : 
                        r.status === 'Absent' ? 'text-red-600' : 
                        r.status === 'Not Marked' ? 'text-yellow-600' : 
                        'text-gray-600'
                      }`}>
                        {r.status === 'Not Marked' ? '❔ Not Marked' : r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {/* Student Management Section - Only show if faculty is class teacher */}
        {assignedClass && (
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
                Student Management
              </h2>
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors min-h-[44px]"
              >
                Add Student
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
            
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {studentsLoading ? (
                      <tr><td colSpan="5" className="px-6 py-4 text-sm text-gray-500">Loading...</td></tr>
                    ) : filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center">
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
                            <p className="text-gray-500">No students found.</p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.rollNumber}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <button
                              onClick={() => navigate(`/student-profile/${s.userId}`)}
                              className="text-indigo-600 hover:text-indigo-900 hover:underline font-medium"
                            >
                              {s.name}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.mobile || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button onClick={async () => {
                              if (!window.confirm('Delete this student?')) return;
                              try {
                                const res = await apiFetch({ url: `/api/students/${s.id}`, method: 'DELETE' });
                                if (res.data?.success) {
                                  setStudents(prev => prev.filter(x => x.id !== s.id));
                                  setTotalStudentsCount(prev => Math.max(0, prev - 1));
                                  setToast({ show: true, message: 'Student deleted successfully', type: 'success' });
                                } else {
                                  setToast({ show: true, message: res.data?.message || 'Failed to delete student', type: 'error' });
                                }
                              } catch (e) {
                                setToast({ show: true, message: e?.response?.data?.message || 'Failed to delete student', type: 'error' });
                              }
                            }} className="text-red-600 hover:text-red-900">Delete</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Student Modal */}
      {showAddStudentModal && facultyProfile && (
        <AddStudentModal
          isOpen={showAddStudentModal}
          onClose={() => setShowAddStudentModal(false)}
          onStudentCreated={() => {
            setShowAddStudentModal(false);
            setStudentRefreshTrigger(prev => prev + 1);
            setToast({ show: true, message: 'Student added successfully', type: 'success' });
            fetchStudentsForAdvisor();
          }}
          batchInfo={{
            batch: facultyProfile.batch,
            year: facultyProfile.year,
            semester: facultyProfile.semester,
            department: facultyProfile.department,
            section: facultyProfile.section
          }}
        />
      )}

      {/* Holiday Modal */}
      <HolidayModal
        isOpen={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        selectedDate={attendanceForm.date}
        onSuccess={(holidayData) => {
          setToast({
            show: true,
            message: `Holiday marked successfully for ${holidayData.date}`,
            type: 'success'
          });
          // Refresh holiday status for current date
          checkHolidayStatus(attendanceForm.date);
        }}
      />

      {/* Holiday Management Modal */}
      <HolidayManagement
        isOpen={showHolidayManagement}
        onClose={() => setShowHolidayManagement(false)}
      />

      {/* Toast Notifications */}
      {(attendanceToast.show || toast.show) && (
        <Toast
          message={attendanceToast.show ? attendanceToast.message : toast.message}
          type={attendanceToast.show ? attendanceToast.type : toast.type}
          onClose={() => {
            if (attendanceToast.show) setAttendanceToast({ show: false, message: '', type: 'success' });
            if (toast.show) setToast({ show: false, message: '', type: 'success' });
          }}
        />
      )}
    </div>
  );
};

export default FacultyDashboard;
