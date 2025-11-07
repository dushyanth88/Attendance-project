import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import ReasonSubmissionModal from '../../components/ReasonSubmissionModal';
import TeamFooter from '../../components/TeamFooter';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const [todayStatus, setTodayStatus] = useState('-');
  const [overall, setOverall] = useState('-');
  const [history, setHistory] = useState([]);
  const [attendanceStartDate, setAttendanceStartDate] = useState(null);
  const [attendanceEndDate, setAttendanceEndDate] = useState(null);
  const [rollNumber, setRollNumber] = useState(null);
  const [presentDays, setPresentDays] = useState(0);
  const [absentDays, setAbsentDays] = useState(0);
  const [odDays, setOdDays] = useState(0);
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
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Calculate working days from attendance start date to today
  // Excludes weekends (Saturday, Sunday) and holidays
  const calculateWorkingDays = (startDate, endDate = null, holidaysList = []) => {
    if (!startDate) return 0;

    try {
      // Parse start date - handle string format YYYY-MM-DD to avoid timezone issues
      let start;
      if (typeof startDate === 'string') {
        const [year, month, day] = startDate.split('T')[0].split('-').map(Number);
        start = new Date(year, month - 1, day, 0, 0, 0, 0);
      } else {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
      }
      
      // Parse end date
      let end;
      if (endDate) {
        if (typeof endDate === 'string') {
          const [year, month, day] = endDate.split('T')[0].split('-').map(Number);
          end = new Date(year, month - 1, day, 23, 59, 59, 999);
        } else {
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
        }
      } else {
        end = new Date();
        end.setHours(23, 59, 59, 999);
      }
      
      // Don't count future dates
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const actualEnd = end > today ? today : end;
      
      if (start > actualEnd) return 0;

      // Create a set of holiday dates for quick lookup
      // Handle both string and Date formats, ensuring consistent YYYY-MM-DD format
      const holidayDates = new Set(
        holidaysList.map(holiday => {
          const holidayDateValue = holiday.date || holiday.holidayDate || holiday;
          
          // If it's already a string in YYYY-MM-DD format, use it directly
          if (typeof holidayDateValue === 'string') {
            // Extract just the date part (YYYY-MM-DD) if it includes time
            return holidayDateValue.split('T')[0];
          }
          
          // If it's a Date object, format it properly to avoid timezone issues
          if (holidayDateValue instanceof Date) {
            // Use local date components to avoid timezone conversion
            const year = holidayDateValue.getFullYear();
            const month = String(holidayDateValue.getMonth() + 1).padStart(2, '0');
            const day = String(holidayDateValue.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          
          // Fallback: try to convert to string and extract date
          return String(holidayDateValue).split('T')[0];
        }).filter(date => date && date.length === 10) // Only valid YYYY-MM-DD dates
      );

      console.log('📅 [StudentDashboard] WorkingDays Calc - Holiday dates set:', Array.from(holidayDates));
      console.log('📅 [StudentDashboard] WorkingDays Calc - Holidays list:', holidaysList);
      console.log('📅 [StudentDashboard] WorkingDays Calc - Start date:', startDate, 'End date:', endDate);

      let workingDays = 0;
      let skippedSundays = 0;
      let skippedSaturdays = 0;
      let skippedHolidays = 0;
      const currentDate = new Date(start);
      
      while (currentDate <= actualEnd) {
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Format date as YYYY-MM-DD using local date components to avoid timezone issues
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        // Skip Sundays (0)
        if (dayOfWeek === 0) {
          skippedSundays++;
          console.log('⏭️ [StudentDashboard] Skipping Sunday:', dateString);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        // Skip Saturdays (6)
        if (dayOfWeek === 6) {
          skippedSaturdays++;
          console.log('⏭️ [StudentDashboard] Skipping Saturday:', dateString);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        // Skip holidays - check if this date is in the holiday set
        if (holidayDates.has(dateString)) {
          skippedHolidays++;
          console.log('🎉 [StudentDashboard] Skipping holiday:', dateString);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        // Count only weekdays (Monday to Friday) that are not holidays
        workingDays++;
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log('📊 [StudentDashboard] WorkingDays Calc Summary:', {
        workingDays,
        skippedSundays,
        skippedSaturdays,
        skippedHolidays,
        totalDaysChecked: workingDays + skippedSundays + skippedSaturdays + skippedHolidays
      });
      
      return workingDays;
    } catch (error) {
      console.error('Error calculating working days:', error);
      return 0;
    }
  };

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
        console.log('📅 Attendance start date from API:', data.attendance_start_date);
        console.log('📅 All response keys:', Object.keys(data));
        
        if (res.ok && data && Array.isArray(data.attendance)) {
          setHistory(data.attendance);
          setOverall(data.overall_percentage || '-');
          
          // Handle attendance start date - check multiple field names
          const startDate = data.attendance_start_date || data.attendanceStartDate || data.classAssignment?.attendanceStartDate || null;
          const endDate = data.attendance_end_date || data.attendanceEndDate || data.classAssignment?.attendanceEndDate || null;
          console.log('📅 Setting attendance start date to:', startDate);
          console.log('📅 Setting attendance end date to:', endDate);
          setAttendanceStartDate(startDate);
          setAttendanceEndDate(endDate);
          setRollNumber(data.roll_number || null);
          
          // Use holidays from API response if available (includes all holidays in the date range)
          if (data.holidays && Array.isArray(data.holidays)) {
            // Ensure holidays are in the correct format with date field
            const formattedHolidays = data.holidays.map(holiday => ({
              date: holiday.date || holiday.holidayDate || holiday,
              reason: holiday.reason || 'Holiday'
            }));
            setHolidays(formattedHolidays);
            console.log('🎉 [StudentDashboard] Holidays from attendance API:', formattedHolidays);
            console.log('🎉 [StudentDashboard] Holidays count:', formattedHolidays.length);
            console.log('🎉 [StudentDashboard] Holiday dates:', formattedHolidays.map(h => h.date));
          }
          
          // Calculate actual attendance statistics
          // OD students are counted as Present for calculations
          const presentCountWithOD = data.attendance.filter(record => record.status === 'Present' || record.status === 'OD').length;
          const odCount = data.attendance.filter(record => record.status === 'OD').length;
          const presentCount = data.attendance.filter(record => record.status === 'Present').length;
          const absentCount = data.attendance.filter(record => record.status === 'Absent').length;
          
          setPresentDays(presentCount);
          setOdDays(odCount);
          setAbsentDays(absentCount);
          
          // Note: totalWorkingDays will be calculated based on start date in useEffect
          
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

  // Fetch holidays as fallback (if not included in attendance API response)
  // The attendance API now includes holidays, but we keep this as a fallback
  useEffect(() => {
    const fetchHolidays = async () => {
      // Only fetch if we don't already have holidays (they should come from attendance API)
      if (holidays.length === 0) {
        try {
          const res = await fetch('/api/holidays/student', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
          });
          
          const data = await res.json();
          
          if (res.ok && data.status === 'success') {
            setHolidays(data.data || []);
            console.log('🎉 Holidays fetched (fallback):', data.data);
          }
        } catch (e) {
          console.error('❌ Error fetching holidays:', e);
        }
      }
    };
    
    if (user?.role === 'student') {
      fetchHolidays();
    }
  }, [user, holidays.length]);

  // Calculate total working days from attendance start date to today
  useEffect(() => {
    if (attendanceStartDate) {
      const workingDays = calculateWorkingDays(attendanceStartDate, attendanceEndDate, holidays);
      setTotalWorkingDays(workingDays);
      console.log('📊 Calculated working days:', {
        startDate: attendanceStartDate,
        endDate: attendanceEndDate,
        holidaysCount: holidays.length,
        workingDays
      });
      
      // Recalculate overall percentage with new working days
      if (workingDays > 0) {
        const presentCountWithOD = history.filter(record => record.status === 'Present' || record.status === 'OD').length;
        const newPercentage = Math.round((presentCountWithOD / workingDays) * 100);
        setOverall(`${newPercentage}%`);
      } else {
        setOverall('-');
      }
    } else {
      // If no start date, use the count of attendance records as fallback
      const totalCount = presentDays + absentDays + odDays;
      setTotalWorkingDays(totalCount);
      // Recalculate percentage with fallback count
      if (totalCount > 0) {
        const presentCountWithOD = presentDays + odDays;
        const newPercentage = Math.round((presentCountWithOD / totalCount) * 100);
        setOverall(`${newPercentage}%`);
      } else {
        setOverall('-');
      }
    }
  }, [attendanceStartDate, attendanceEndDate, holidays, history, presentDays, absentDays, odDays]);

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
          // OD is counted as Present for calculations
          const presentCountWithOD = next.filter(record => record.status === 'Present' || record.status === 'OD').length;
          const odCount = next.filter(record => record.status === 'OD').length;
          const presentCount = next.filter(record => record.status === 'Present').length;
          const absentCount = next.filter(record => record.status === 'Absent').length;
          
          setPresentDays(presentCount);
          setOdDays(odCount);
          setAbsentDays(absentCount);
          
          // Note: totalWorkingDays will be calculated based on start date in useEffect
          // Update overall percentage using the calculated total working days
          const calculatedWorkingDays = calculateWorkingDays(attendanceStartDate, attendanceEndDate, holidays);
          const newPercentage = calculatedWorkingDays > 0 ? Math.round((presentCountWithOD / calculatedWorkingDays) * 100) : 0;
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
              <div className="relative mr-4 cursor-pointer" onClick={() => setShowImagePreview(true)}>
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
            <div className="relative mr-6 cursor-pointer" onClick={() => setShowImagePreview(true)}>
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
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">OD Days</p>
                <p className="text-2xl font-bold text-gray-800">{odDays}</p>
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

        {/* Attendance Period Card - Always visible */}
        <div className={`rounded-lg shadow-lg p-6 mb-8 border-2 ${
          attendanceStartDate 
            ? 'bg-gradient-to-r from-green-50 to-blue-50 border-green-300' 
            : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300'
        }`}>
          <div className="flex items-center">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl mr-4 shadow-lg">
              <span className="text-4xl">📅</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Attendance Period</h3>
              {attendanceStartDate ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                      <p className="text-base text-gray-700">
                        <strong className="text-gray-900">Start Date:</strong>{' '}
                        <span className="text-green-700 font-semibold">
                          {(() => {
                            try {
                              return new Date(attendanceStartDate).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              });
                            } catch (e) {
                              console.error('Error formatting attendance start date:', e, attendanceStartDate);
                              return attendanceStartDate;
                            }
                          })()}
                        </span>
                      </p>
                    </div>
                    {attendanceEndDate ? (
                      <div className="flex items-center">
                        <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                        <p className="text-base text-gray-700">
                          <strong className="text-gray-900">End Date:</strong>{' '}
                          <span className="text-blue-700 font-semibold">
                            {(() => {
                              try {
                                return new Date(attendanceEndDate).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                });
                              } catch (e) {
                                console.error('Error formatting attendance end date:', e, attendanceEndDate);
                                return attendanceEndDate;
                              }
                            })()}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                        <p className="text-base text-gray-600">
                          <strong>End Date:</strong> Not set (unlimited)
                        </p>
                      </div>
                    )}
                    <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-300">
                      ✅ Your attendance tracking period is active. You can view your attendance records from the start date.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-2">
                    Attendance start date has not been configured yet
                  </p>
                  <p className="text-lg font-bold text-yellow-700">
                    ⚠️ Please contact your class advisor to set the attendance period
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

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
              todayStatus === 'OD' ? 'bg-blue-50 border-l-4 border-blue-500' :
              todayStatus === 'Absent' ? 'bg-red-50 border-l-4 border-red-500' : 
              todayStatus === 'Not Marked' ? 'bg-yellow-50 border-l-4 border-yellow-500' : 
              'bg-gray-50 border'
            }`}>
              <p className="font-medium">
                {todayStatus === '-' ? 'No record for today' : 
                 todayStatus === 'Not Marked' ? '❔ Not Marked' : 
                 todayStatus === 'OD' ? '📋 OD (On Duty)' :
                 todayStatus}
              </p>
              {todayStatus === 'Not Marked' && (
                <p className="text-sm text-yellow-700 mt-1">Attendance not yet recorded by faculty</p>
              )}
              {todayStatus === 'OD' && (
                <p className="text-sm text-blue-700 mt-1">Marked as On Duty - counted as Present</p>
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
                      rec.status === 'OD' ? 'text-blue-600' :
                      rec.status === 'Absent' ? 'text-red-600' : 
                      rec.status === 'Not Marked' ? 'text-yellow-600' : 
                      'text-gray-600'
                    } font-semibold`}>
                      {rec.status === 'Not Marked' ? '❔ Not Marked' : 
                       rec.status === 'OD' ? '📋 OD' :
                       rec.status}
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

      {/* Profile Image Preview Modal */}
      {showImagePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setShowImagePreview(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-[90%] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Profile Picture</h3>
              <button className="text-gray-500 hover:text-gray-700 text-2xl leading-none" onClick={() => setShowImagePreview(false)}>×</button>
            </div>
            <div className="flex items-center justify-center">
              {profileImage ? (
                <img src={profileImage} alt={`${user?.name || 'Student'} profile`} className="max-h-[70vh] max-w-full rounded-lg object-contain" />
              ) : (
                <div className="w-40 h-40 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-5xl font-bold">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">📋</span>
                    <div>
                      <p className="text-sm text-gray-600">OD Days</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {filteredHistory.filter(record => record.status === 'OD').length}
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
                            record.status === 'OD' ? 'text-blue-600' :
                            record.status === 'Absent' ? 'text-red-600' : 
                            record.status === 'Not Marked' ? 'text-yellow-600' : 
                            'text-gray-600'
                          } font-semibold`}>
                            {record.status === 'Not Marked' ? '❔ Not Marked' : 
                             record.status === 'OD' ? '📋 OD' :
                             record.status}
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
      <TeamFooter />
    </div>
  );
};

export default StudentDashboard;
