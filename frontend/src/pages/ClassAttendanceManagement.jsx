import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';
import BulkUploadModal from '../components/BulkUploadModal';

const ClassAttendanceManagement = () => {
  const { classId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mark');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (classId) {
      fetchClassData();
    }
  }, [classId]);

  const fetchClassData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching class data for classId:', classId);
      
      // Fetch class assignment details using the ClassAssignment model
      const classResponse = await apiFetch({
        url: `/api/class-assignment/${classId}`,
        method: 'GET'
      });

      console.log('📋 Class assignment response:', classResponse.data);

      if (classResponse.data.status === 'success') {
        const assignment = classResponse.data.data;
        const newClassData = {
          batch: assignment.batch,
          year: assignment.year,
          semester: assignment.semester,
          section: assignment.section,
          department: user.department // Use user's department instead of departmentId
        };
        
        setClassData(newClassData);
        
        console.log('✅ Class data set:', newClassData);
        
        // Fetch students for this class using the faculty students endpoint
        const studentsResponse = await apiFetch({
          url: `/api/faculty/students?batch=${encodeURIComponent(assignment.batch)}&year=${encodeURIComponent(assignment.year)}&semester=${assignment.semester}&department=${encodeURIComponent(user.department)}`,
          method: 'GET'
        });

        console.log('👥 Students response:', studentsResponse.data);

        if (studentsResponse.data.success) {
          setStudents(studentsResponse.data.data.students || []);
          console.log('✅ Students loaded:', studentsResponse.data.data.students?.length || 0);
        }
      } else {
        console.error('❌ Failed to fetch class assignment:', classResponse.data.message);
        setToast({ show: true, message: classResponse.data.message || 'Failed to load class data', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching class data:', error);
      setToast({ show: true, message: 'Error loading class data', type: 'error' });
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

  const tabs = [
    { id: 'mark', label: 'Mark Attendance', icon: '📝' },
    { id: 'edit', label: 'Edit Attendance', icon: '✏️' },
    { id: 'history', label: 'Attendance History', icon: '📊' },
    { id: 'report', label: 'Generate Report', icon: '📈' },
    { id: 'students', label: 'Student Management', icon: '👥' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading class data...</p>
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleBackToDashboard}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Back to Class Management"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            <div>
                <h1 className="text-xl font-semibold text-gray-900">
                Class Management - {classData.batch} | {classData.year} | Semester {classData.semester} | Section {classData.section}
              </h1>
                <p className="text-sm text-gray-500">
                  Manage attendance, students, and generate reports for this class
                </p>
              </div>
            </div>
          </div>
        </div>
            </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
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
        {activeTab === 'edit' && (
          <EditAttendanceTab 
            classData={classData} 
            students={students} 
            onToast={showToast}
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
          />
        )}
      </div>
    </div>
  );
};

// Mark Attendance Tab Component
const MarkAttendanceTab = ({ classData, students, onToast, onStudentsUpdate }) => {
  const [attendanceForm, setAttendanceForm] = useState({
    absentees: ''
  });
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const handleAttendanceChange = (e) => {
    const { name, value } = e.target;
    setAttendanceForm(prev => ({ ...prev, [name]: value }));
  };

  // Calculate present count in real-time
  const presentCount = Math.max(0, students.length - (attendanceForm.absentees.split(',').filter(id => id.trim()).length));

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    setAttendanceLoading(true);

    try {
      // Use today's date in ISO format for backend
      const todayISO = new Date().toISOString().split('T')[0];
      
      const response = await apiFetch({
        url: '/api/attendance/mark',
        method: 'POST',
        data: {
          date: todayISO, // Use today's date in ISO format
          absentees: attendanceForm.absentees,
          batch: classData.batch,
          year: classData.year,
          semester: classData.semester,
          section: classData.section,
          department: classData.department
        }
      });

      if (response.data.success) {
        onToast('Attendance marked successfully!', 'success');
        setAttendanceForm(prev => ({ ...prev, absentees: '' }));
      } else {
        onToast(response.data.message || 'Failed to mark attendance', 'error');
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      onToast('Error marking attendance', 'error');
    } finally {
      setAttendanceLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Mark Daily Attendance</h2>
        <p className="text-sm text-gray-500">Mark attendance for today's class</p>
              </div>
      <div className="p-6">
        <form onSubmit={handleMarkAttendance} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Today's date - attendance can only be marked for today</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Students Present
              </label>
              <input
                type="number"
                name="present"
                value={presentCount}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
              Absent Students (Enter roll numbers separated by commas)
              </label>
              <textarea
                name="absentees"
                value={attendanceForm.absentees}
                onChange={handleAttendanceChange}
              placeholder="e.g., STU001, STU003, STU005"
                rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

          <div className="flex justify-end">
              <button
                type="submit"
              disabled={attendanceLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
              {attendanceLoading ? 'Marking...' : 'Mark Attendance'}
              </button>
            </div>
          </form>

        {/* Students List */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Students in Class</h3>
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                  <tr key={student._id || student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.rollNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.email}
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Attendance Tab Component
const EditAttendanceTab = ({ classData, students, onToast }) => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    fetchAttendanceRecords();
  }, []);

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/attendance/history?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}`,
        method: 'GET'
      });

      if (response.data.success) {
        setAttendanceRecords(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      onToast('Error loading attendance records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditAttendance = async (recordId, updatedData) => {
    try {
      const response = await apiFetch({
        url: `/api/attendance/${recordId}`,
        method: 'PUT',
        data: updatedData
      });

      if (response.data.success) {
        onToast('Attendance updated successfully!', 'success');
        fetchAttendanceRecords();
      } else {
        onToast(response.data.message || 'Failed to update attendance', 'error');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      onToast('Error updating attendance', 'error');
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
        <h2 className="text-lg font-medium text-gray-900">Edit Attendance Records</h2>
        <p className="text-sm text-gray-500">Modify attendance entries for past days</p>
      </div>
      <div className="p-6">
        {attendanceRecords.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Attendance Records</h3>
            <p className="text-gray-500">No attendance has been marked for this class yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {attendanceRecords.map((record) => (
              <div key={record._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">
                    {new Date(record.date).toLocaleDateString()}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {record.presentCount}/{record.totalStudents} students present
                        </span>
                </div>
                <p className="text-sm text-gray-600">
                  Absent: {record.absentees?.join(', ') || 'None'}
                </p>
                <button
                  onClick={() => handleEditAttendance(record._id, { presentCount: record.presentCount + 1 })}
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  Edit Record
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Attendance History Tab Component
const AttendanceHistoryTab = ({ classData, students, onToast }) => {
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAttendanceHistory();
  }, [dateRange]);

  const fetchAttendanceHistory = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/attendance/history?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        method: 'GET'
      });

      if (response.data.success) {
        setAttendanceHistory(response.data.data || []);
      }
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
                {attendanceHistory.map((record) => (
                  <tr key={record._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.presentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.totalStudents - record.presentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {((record.presentCount / record.totalStudents) * 100).toFixed(1)}%
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
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const generateReport = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/attendance/report?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        method: 'GET'
      });

      if (response.data.success) {
        setReportData(response.data.data);
      } else {
        onToast(response.data.message || 'Failed to generate report', 'error');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      onToast('Error generating report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!reportData) return;
    
    const csvContent = [
      ['Date', 'Present', 'Absent', 'Percentage'],
      ...reportData.records.map(record => [
        new Date(record.date).toLocaleDateString(),
        record.presentCount,
        record.totalStudents - record.presentCount,
        ((record.presentCount / record.totalStudents) * 100).toFixed(1) + '%'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${classData.batch}-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Generate Attendance Report</h2>
        <p className="text-sm text-gray-500">Create and download attendance summary reports</p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        {reportData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900">Total Days</h3>
                <p className="text-2xl font-bold text-blue-600">{reportData.totalDays}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-green-900">Average Attendance</h3>
                <p className="text-2xl font-bold text-green-600">{reportData.averageAttendance.toFixed(1)}%</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-900">Total Students</h3>
                <p className="text-2xl font-bold text-yellow-600">{reportData.totalStudents}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={downloadReport}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
              >
                Download CSV Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Student Management Tab Component
const StudentManagementTab = ({ classData, students, onToast, onStudentsUpdate, user }) => {
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

      const response = await apiFetch({
        url: '/api/faculty/students',
        method: 'POST',
        data: studentPayload
      });

      if (response.data.success) {
        onToast('Student added successfully!', 'success');
        setShowAddStudent(false);
        // Refresh students list
        const studentsResponse = await apiFetch({
          url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&department=${encodeURIComponent(classData.department)}`,
          method: 'GET'
        });
        if (studentsResponse.data.success) {
          onStudentsUpdate(studentsResponse.data.data.students || []);
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

      if (response.data.success) {
        onToast('Student deleted successfully!', 'success');
        // Refresh students list
        const studentsResponse = await apiFetch({
          url: `/api/faculty/students?batch=${encodeURIComponent(classData.batch)}&year=${encodeURIComponent(classData.year)}&semester=${classData.semester}&department=${encodeURIComponent(classData.department)}`,
          method: 'GET'
        });
        if (studentsResponse.data.success) {
          onStudentsUpdate(studentsResponse.data.data.students || []);
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
                      {student.rollNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.name}
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

export default ClassAttendanceManagement;