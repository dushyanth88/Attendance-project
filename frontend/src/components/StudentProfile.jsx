import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';

const StudentProfile = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [monthlyAttendance, setMonthlyAttendance] = useState({});
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    fetchStudentProfile();
  }, [studentId]);

  // Scroll to top when data loads
  useEffect(() => {
    if (!loading && studentData) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loading, studentData]);

  const fetchStudentProfile = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/students/${studentId}/profile`,
        method: 'GET'
      });

      const responseData = response.data;
      if (responseData.status === 'success') {
        setStudentData(responseData.data.student);
        setAttendanceStats(responseData.data.attendanceStats);
        setMonthlyAttendance(responseData.data.monthlyAttendance);
        setRecentAttendance(responseData.data.recentAttendance);
      } else {
        throw new Error(responseData.message || 'Failed to fetch student profile');
      }
    } catch (error) {
      console.error('Fetch student profile error:', error);
      setToast({
        show: true,
        message: error.response?.data?.message || error.message || 'Failed to fetch student profile',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceColor = (status) => {
    switch (status) {
      case 'Present': return 'text-green-600 bg-green-100';
      case 'Absent': return 'text-red-600 bg-red-100';
      case 'Not Marked': return 'text-yellow-600 bg-yellow-100';
      case 'Holiday': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAttendanceIcon = (status) => {
    switch (status) {
      case 'Present': return '✅';
      case 'Absent': return '❌';
      case 'Not Marked': return '❔';
      case 'Holiday': return '🎉';
      default: return '⚪';
    }
  };

  const renderCalendar = () => {
    if (!monthlyAttendance[selectedMonth]) {
      return (
        <div className="text-center py-8 text-gray-500">
          No attendance data for {selectedMonth}
        </div>
      );
    }

    const monthData = monthlyAttendance[selectedMonth];
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]) - 1;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const attendance = monthData.find(record => record.date === dateStr);
      days.push({ day, date: dateStr, attendance });
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((dayData, index) => (
          <div
            key={index}
            className={`p-2 text-center text-sm border rounded relative group ${
              dayData ? 'bg-white hover:bg-gray-50' : 'bg-gray-100'
            }`}
          >
            {dayData && (
              <>
                <div className="font-medium">{dayData.day}</div>
                {dayData.attendance && (
                  <div className={`text-xs mt-1 ${getAttendanceColor(dayData.attendance.status)} px-1 py-0.5 rounded`}>
                    {getAttendanceIcon(dayData.attendance.status)}
                  </div>
                )}
                {/* Tooltip for holidays */}
                {dayData.attendance && dayData.attendance.status === 'Holiday' && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-yellow-600 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    {dayData.attendance.reason}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading student profile...</p>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">👤</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Student Not Found</h2>
          <p className="text-gray-600 mb-4">The requested student profile could not be found.</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Student Profile</h1>
                <p className="text-gray-600">{studentData.name} - {studentData.rollNumber}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Personal Info & Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Roll Number</label>
                  <p className="text-gray-900">{studentData.rollNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Full Name</label>
                  <p className="text-gray-900">{studentData.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-gray-900">{studentData.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone Number</label>
                  <p className="text-gray-900">{studentData.mobile}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Department</label>
                  <p className="text-gray-900">{studentData.department}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Academic Info</label>
                  <p className="text-gray-900">
                    {studentData.batch} | {studentData.year} | {studentData.semester}
                    {studentData.section && ` | Section ${studentData.section}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Attendance Summary Cards */}
            {attendanceStats && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">✅</span>
                      <span className="font-medium text-green-800">Days Present</span>
                    </div>
                    <span className="text-2xl font-bold text-green-600">{attendanceStats.presentDays}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">❌</span>
                      <span className="font-medium text-red-800">Days Absent</span>
                    </div>
                    <span className="text-2xl font-bold text-red-600">{attendanceStats.absentDays}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">❔</span>
                      <span className="font-medium text-yellow-800">Not Marked</span>
                    </div>
                    <span className="text-2xl font-bold text-yellow-600">{attendanceStats.notMarkedDays || 0}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">📅</span>
                      <span className="font-medium text-blue-800">Total Working Days</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">{attendanceStats.totalDays}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">📊</span>
                      <span className="font-medium text-purple-800">Attendance %</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-600">{attendanceStats.attendancePercentage}%</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Attendance Progress</span>
                    <span>{attendanceStats.attendancePercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        attendanceStats.attendancePercentage >= 75 ? 'bg-green-500' :
                        attendanceStats.attendancePercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${attendanceStats.attendancePercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Calendar & Recent Attendance */}
          <div className="lg:col-span-2 space-y-6">
            {/* Monthly Calendar */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Monthly Calendar View</h3>
                <div className="flex items-center space-x-4">
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center">
                      <span className="w-3 h-3 bg-green-100 rounded mr-2">✅</span>
                      <span>Present</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-3 h-3 bg-red-100 rounded mr-2">❌</span>
                      <span>Absent</span>
                    </div>
                  </div>
                </div>
              </div>
              {renderCalendar()}
            </div>

            {/* Recent Attendance */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Attendance (Last 30 Days)</h3>
              {recentAttendance.length > 0 ? (
                <div className="space-y-2">
                  {recentAttendance.slice(0, 10).map((record, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center">
                        <span className="text-lg mr-3">{getAttendanceIcon(record.status)}</span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(record.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                          {record.reason && (
                            <p className="text-sm text-gray-600">Reason: {record.reason}</p>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getAttendanceColor(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent attendance records found
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

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

export default StudentProfile;