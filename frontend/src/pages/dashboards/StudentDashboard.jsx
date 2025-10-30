import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import ReasonSubmissionModal from '../../components/ReasonSubmissionModal';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const [todayStatus, setTodayStatus] = useState('-');
  const [overall, setOverall] = useState('-');
  const [history, setHistory] = useState([]);
  const [attendanceStartDate, setAttendanceStartDate] = useState(null);
  const [rollNumber, setRollNumber] = useState(null);
  const [presentDays, setPresentDays] = useState(0);
  const [absentDays, setAbsentDays] = useState(0);
  const [totalWorkingDays, setTotalWorkingDays] = useState(0);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('');
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [reportSelectedDate, setReportSelectedDate] = useState('');
  const [profileImage, setProfileImage] = useState(user?.profileImage);
  const [holidays, setHolidays] = useState([]);

  const handleReasonSubmit = (record) => {
    setSelectedRecord({
      studentId: user.id,
      date: record.date,
      status: record.status
    });
    setShowReasonModal(true);
  };

  const handleReasonSuccess = (updatedData) => {
    // Update the history with the new reason
    setHistory(prev => prev.map(record => 
      record.date === updatedData.date 
        ? { ...record, reason: updatedData.reason }
        : record
    ));
    setShowReasonModal(false);
    setSelectedRecord(null);
  };

  const generateReport = (type) => {
    setReportType(type);
    setShowDateSelector(true);
  };

  const generateReportWithDate = (type, dateInput) => {
    const now = new Date();
    let startDate, endDate;
    
    if (type === 'weekly') {
      // Parse the selected date and find the week it belongs to
      const selectedDate = new Date(dateInput);
      const dayOfWeek = selectedDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      startDate = new Date(selectedDate);
      startDate.setDate(selectedDate.getDate() - daysToMonday);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (type === 'monthly') {
      // Parse the selected date and get the month/year
      const selectedDate = new Date(dateInput);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      
      startDate = new Date(year, month, 1);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(year, month + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }
    
    // Filter attendance history by date range
    const filtered = history.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate <= endDate;
    });
    
    setFilteredHistory(filtered);
    setReportSelectedDate(dateInput);
    setShowDateSelector(false);
    setShowReportModal(true);
    
    console.log(`📊 Generated ${type} report for ${dateInput}:`, {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      recordCount: filtered.length,
      records: filtered
    });
  };

  // Update profile image when user changes
  useEffect(() => {
    setProfileImage(user?.profileImage);
  }, [user?.profileImage]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        if (!user?.id) return;
        
        console.log('🔍 Fetching attendance for student:', {
          userId: user.id,
          userRole: user.role,
          userName: user.name,
          profileImage: user.profileImage
        });
        
        // First, refresh user data to get latest profile image
        try {
          const userRes = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            console.log('👤 Updated user data:', userData.user);
            // Update the profile image state if it changed
            if (userData.user.profileImage !== profileImage) {
              console.log('🔄 Profile image updated:', {
                old: profileImage,
                new: userData.user.profileImage
              });
              setProfileImage(userData.user.profileImage);
            }
          }
        } catch (userError) {
          console.log('⚠️ Could not refresh user data:', userError);
        }
        
        const res = await fetch(`/api/attendance/student/${user.id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        
        console.log('📡 API Response status:', res.status);
        
        const data = await res.json();
        console.log('📊 API Response data:', data);
        
        if (res.ok && data && Array.isArray(data.attendance)) {
          setHistory(data.attendance);
          setOverall(data.overall_percentage || '-');
          setAttendanceStartDate(data.attendance_start_date || null);
          setRollNumber(data.roll_number || null);
          
          // Calculate actual attendance statistics
          const presentCount = data.attendance.filter(record => record.status === 'Present').length;
          const absentCount = data.attendance.filter(record => record.status === 'Absent').length;
          const totalCount = presentCount + absentCount;
          
          setPresentDays(presentCount);
          setAbsentDays(absentCount);
          setTotalWorkingDays(totalCount);
          
          const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const todayRec = data.attendance.find(a => a.date === today);
          setTodayStatus(todayRec ? todayRec.status : '-');
          
          console.log('✅ Attendance data processed:', {
            totalRecords: data.attendance.length,
            presentDays: presentCount,
            absentDays: absentCount,
            totalWorkingDays: totalCount,
            todayStatus: todayRec ? todayRec.status : '-',
            overallPercentage: data.overall_percentage,
            attendanceStartDate: data.attendance_start_date,
            rollNumber: data.roll_number
          });
          
          // Scroll to top when data loads
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          console.log('❌ Invalid response format:', data);
        }
      } catch (e) {
        console.error('❌ Error fetching attendance:', e);
      }
    };
    fetchAttendance();
  }, [user]);

  // Fetch holidays
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await fetch('/api/holidays/student', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        
        const data = await res.json();
        
        if (res.ok && data.status === 'success') {
          setHolidays(data.data || []);
          console.log('🎉 Holidays fetched:', data.data);
        }
      } catch (e) {
        console.error('❌ Error fetching holidays:', e);
      }
    };
    
    if (user?.role === 'student') {
      fetchHolidays();
    }
  }, [user]);

  // Real-time updates via SSE
  useEffect(() => {
    if (!user?.id || !localStorage.getItem('accessToken')) return;
    const token = localStorage.getItem('accessToken');
    const url = `/api/attendance/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const onAttendance = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (!payload?.date || !payload?.status) return;
        setHistory(prev => {
          const idx = prev.findIndex(r => r.date === payload.date);
          let next;
          if (idx >= 0) {
            next = [...prev];
            next[idx] = { ...next[idx], status: payload.status };
          } else {
            next = [{ date: payload.date, status: payload.status }, ...prev];
          }
          
          // Recalculate statistics with updated data
          const presentCount = next.filter(record => record.status === 'Present').length;
          const absentCount = next.filter(record => record.status === 'Absent').length;
          const totalCount = presentCount + absentCount;
          
          setPresentDays(presentCount);
          setAbsentDays(absentCount);
          setTotalWorkingDays(totalCount);
          
          // Update overall percentage
          const newPercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
          setOverall(`${newPercentage}%`);
          
          return next;
        });
        const today = new Date().toISOString().slice(0,10);
        if (payload.date === today) setTodayStatus(payload.status);
      } catch (_) {}
    };

    es.addEventListener('attendance', onAttendance);

    es.onerror = () => {
      try { es.close(); } catch (_) {}
    };

    return () => {
      try { es.removeEventListener('attendance', onAttendance); } catch (_) {}
      try { es.close(); } catch (_) {}
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              {/* Profile Picture */}
              <div className="relative mr-4">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={`${user.name}'s profile`}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white border-opacity-30"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-white font-semibold text-lg border-2 border-white border-opacity-30 ${profileImage ? 'hidden' : 'flex'}`}
                >
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
                </div>
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-white">Student Dashboard</h1>
                <p className="text-white text-opacity-90">Welcome back, {user?.name}</p>
                <p className="text-sm text-white text-opacity-80 bg-white bg-opacity-20 inline-block px-3 py-1 rounded-full mt-1">
                  📍 Department: {user?.department}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Section */}
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-100 p-6 mb-8">
          <div className="flex items-center">
            <div className="relative mr-6">
              {user?.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={`${user.name}'s profile`}
                  className="w-20 h-20 rounded-full object-cover border-4 border-blue-200"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className={`w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-2xl border-4 border-blue-200 shadow-lg ${user?.profileImage ? 'hidden' : 'flex'}`}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{user?.name}</h2>
              <p className="text-gray-600">{user?.email}</p>
              {rollNumber && (
                <p className="text-sm text-purple-600 font-medium">Roll Number: {rollNumber}</p>
              )}
              <p className="text-sm text-blue-600">Department: {user?.department}</p>
              <p className="text-sm text-gray-500">Class: {user?.class || 'Not assigned'}</p>
              {attendanceStartDate && (
                <p className="text-sm text-green-600 font-medium mt-2">
                  📅 Attendance Period Started: {new Date(attendanceStartDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-lg border border-green-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Overall Attendance</p>
                <p className="text-2xl font-bold text-green-600">{overall}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Present Days</p>
                <p className="text-2xl font-bold text-gray-800">{presentDays}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white to-red-50 rounded-2xl shadow-lg border border-red-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-red-500 to-pink-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">❌</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Absent Days</p>
                <p className="text-2xl font-bold text-gray-800">{absentDays}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg border border-purple-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">📚</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Working Days</p>
                <p className="text-2xl font-bold text-gray-800">{totalWorkingDays}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Start Date Card */}
        {attendanceStartDate && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-md p-6 mb-8 border border-green-200">
            <div className="flex items-center">
              <span className="text-4xl mr-4">📅</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Attendance Period</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Your attendance tracking period has started
                </p>
                <p className="text-lg font-bold text-green-700">
                  Started: {new Date(attendanceStartDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Holiday Information */}
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl shadow-lg p-6 border border-amber-200">
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">🎉</span>
              </div>
              <h3 className="text-lg font-bold text-amber-900">Upcoming Holidays</h3>
            </div>
            {holidays.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {holidays.slice(0, 10).map((holiday, index) => (
                  <div key={holiday.id || index} className="bg-gradient-to-r from-white to-amber-50 rounded-xl p-3 border border-amber-200 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {new Date(holiday.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{holiday.reason}</p>
                      </div>
                      <span className="text-2xl ml-2">🎊</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600">No upcoming holidays scheduled</p>
              </div>
            )}
          </div>

          {/* Today's Schedule */}
          <div className="bg-gradient-to-br from-white to-pink-50 rounded-2xl shadow-lg p-6 border border-pink-100">
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">📅</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800">Today's Status</h3>
            </div>
            <div className={`p-4 rounded-lg ${
              todayStatus === 'Present' ? 'bg-green-50 border-l-4 border-green-500' : 
              todayStatus === 'Absent' ? 'bg-red-50 border-l-4 border-red-500' : 
              todayStatus === 'Not Marked' ? 'bg-yellow-50 border-l-4 border-yellow-500' : 
              'bg-gray-50 border'
            }`}>
              <p className="font-medium">
                {todayStatus === '-' ? 'No record for today' : 
                 todayStatus === 'Not Marked' ? '❔ Not Marked' : 
                 todayStatus}
              </p>
              {todayStatus === 'Not Marked' && (
                <p className="text-sm text-yellow-700 mt-1">Attendance not yet recorded by faculty</p>
              )}
            </div>
          </div>


          {/* Attendance History */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">🕒</span>
              <h3 className="text-lg font-semibold">Attendance History</h3>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {history.length === 0 && (
                <div className="p-3 bg-gray-50 rounded-lg text-gray-600 text-sm">No attendance records found.</div>
              )}
              {history.map((rec, idx) => (
                <div key={`${rec.date}-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{rec.date}</p>
                    {rec.reason && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Reason:</span> {rec.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`${
                      rec.status === 'Present' ? 'text-green-600' : 
                      rec.status === 'Absent' ? 'text-red-600' : 
                      rec.status === 'Not Marked' ? 'text-yellow-600' : 
                      'text-gray-600'
                    } font-semibold`}>
                      {rec.status === 'Not Marked' ? '❔ Not Marked' : rec.status}
                    </span>
                    {rec.status === 'Absent' && !rec.reason && (
                      <button
                        onClick={() => handleReasonSubmit(rec)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                      >
                        📝 Add Reason
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attendance Reports */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📊</span>
              <h3 className="text-lg font-semibold">Attendance Reports</h3>
            </div>
            <p className="text-gray-600 mb-4">View detailed attendance reports and analytics</p>
            <div className="space-y-2">
              <button 
                onClick={() => generateReport('weekly')}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-left"
              >
                📈 Weekly Report
              </button>
              <button 
                onClick={() => generateReport('monthly')}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-left"
              >
                📅 Monthly Report
              </button>
              
            </div>
          </div>
        </div>
      </main>

      {/* Reason Submission Modal */}
      <ReasonSubmissionModal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        attendanceRecord={selectedRecord}
        onSuccess={handleReasonSuccess}
      />

      {/* Date Selector Modal */}
      {showDateSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <span className="text-3xl mr-3">📅</span>
                <h3 className="text-xl font-semibold text-gray-900">
                  Select {reportType === 'weekly' ? 'Week' : 'Month'}
                </h3>
              </div>
              <button
                onClick={() => setShowDateSelector(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label htmlFor="dateInput" className="block text-sm font-medium text-gray-700 mb-2">
                  {reportType === 'weekly' 
                    ? 'Select any date from the week you want to view:' 
                    : 'Select any date from the month you want to view:'
                  }
                </label>
                <input
                  type="date"
                  id="dateInput"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  max={new Date().toISOString().split('T')[0]} // Can't select future dates
                />
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
                {selectedDate ? (
                  <div className="text-sm text-gray-600">
                    {reportType === 'weekly' ? (
                      <div>
                        <p><strong>Week:</strong> {(() => {
                          const date = new Date(selectedDate);
                          const dayOfWeek = date.getDay();
                          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                          const monday = new Date(date);
                          monday.setDate(date.getDate() - daysToMonday);
                          const sunday = new Date(monday);
                          sunday.setDate(monday.getDate() + 6);
                          return `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`;
                        })()}</p>
                      </div>
                    ) : (
                      <div>
                        <p><strong>Month:</strong> {(() => {
                          const date = new Date(selectedDate);
                          return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        })()}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Select a date to see the preview</p>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDateSelector(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => generateReportWithDate(reportType, selectedDate)}
                  disabled={!selectedDate}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <span className="text-3xl mr-3">📊</span>
                <h3 className="text-xl font-semibold text-gray-900">
                  {reportType === 'weekly' ? 'Weekly Attendance Report' : 'Monthly Attendance Report'}
                </h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Report Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">📅</span>
                    <div>
                      <p className="text-sm text-gray-600">Total Days</p>
                      <p className="text-2xl font-bold text-blue-600">{filteredHistory.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">✅</span>
                    <div>
                      <p className="text-sm text-gray-600">Present Days</p>
                      <p className="text-2xl font-bold text-green-600">
                        {filteredHistory.filter(record => record.status === 'Present').length}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">❌</span>
                    <div>
                      <p className="text-sm text-gray-600">Absent Days</p>
                      <p className="text-2xl font-bold text-red-600">
                        {filteredHistory.filter(record => record.status === 'Absent').length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Date Range Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Report Period</h4>
                <p className="text-sm text-gray-600">
                  {reportType === 'weekly' 
                    ? (() => {
                        const date = new Date(reportSelectedDate);
                        const dayOfWeek = date.getDay();
                        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                        const monday = new Date(date);
                        monday.setDate(date.getDate() - daysToMonday);
                        const sunday = new Date(monday);
                        sunday.setDate(monday.getDate() + 6);
                        return `Week: ${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`;
                      })()
                    : (() => {
                        const date = new Date(reportSelectedDate);
                        return `Month: ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
                      })()
                  }
                </p>
              </div>

              {/* Attendance History */}
              <div>
                <h4 className="font-medium text-gray-900 mb-4">Attendance History</h4>
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl mb-2 block">📭</span>
                    <p>No attendance records found for this period</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistory.map((record, idx) => (
                      <div key={`${record.date}-${idx}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{record.date}</p>
                          {record.reason && (
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Reason:</span> {record.reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`${
                            record.status === 'Present' ? 'text-green-600' : 
                            record.status === 'Absent' ? 'text-red-600' : 
                            record.status === 'Not Marked' ? 'text-yellow-600' : 
                            'text-gray-600'
                          } font-semibold`}>
                            {record.status === 'Not Marked' ? '❔ Not Marked' : record.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
