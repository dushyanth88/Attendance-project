import { useState, useEffect } from 'react';
import { useClass } from '../context/ClassContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';

const AttendanceHistory = () => {
  const { activeClass, getClassInfo } = useClass();
  const [historyDate, setHistoryDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const classInfo = getClassInfo();

  useEffect(() => {
    if (classInfo && historyDate) {
      fetchAttendanceHistory();
    }
  }, [classInfo, historyDate]);

  const fetchAttendanceHistory = async () => {
    if (!classInfo) return;
    
    setLoading(true);
    try {
      const url = `/api/attendance/history-by-class?batch=${encodeURIComponent(classInfo.batch)}&year=${encodeURIComponent(classInfo.year)}&semester=${encodeURIComponent(classInfo.semester)}&date=${encodeURIComponent(historyDate)}&section=${encodeURIComponent(classInfo.section)}`;
      const response = await apiFetch({ url });
      
      if (response.data?.status === 'success') {
        setAttendanceRecords(response.data.data.records || []);
      } else {
        setAttendanceRecords([]);
      }
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      setToast({ show: true, message: 'Failed to load attendance history', type: 'error' });
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    setHistoryDate(e.target.value);
  };

  const handleEditAttendance = async (studentId, newStatus) => {
    if (!classInfo) return;
    
    try {
      const response = await apiFetch({
        url: '/api/attendance/edit-student',
        method: 'PUT',
        data: {
          batch: classInfo.batch,
          year: classInfo.year,
          semester: classInfo.semester,
          section: classInfo.section,
          date: historyDate,
          studentId,
          status: newStatus
        }
      });

      if (response.data.status === 'success') {
        setToast({ 
          show: true, 
          message: `Attendance updated for student`, 
          type: 'success' 
        });
        // Refresh the history
        fetchAttendanceHistory();
      } else {
        throw new Error(response.data.message || 'Failed to update attendance');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      setToast({ show: true, message: 'Failed to update attendance', type: 'error' });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present':
        return 'bg-green-100 text-green-800';
      case 'Absent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Present':
        return '✅';
      case 'Absent':
        return '❌';
      default:
        return '❓';
    }
  };

  if (!classInfo) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No class selected</p>
      </div>
    );
  }

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Attendance History</h2>
          <p className="text-gray-600">
            View and edit attendance records for {classInfo.year} | Semester {classInfo.semester} | Section {classInfo.section}
          </p>
        </div>

        {/* Date Selector */}
        <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            📅 Select Date
          </label>
          <input
            type="date"
            value={historyDate}
            onChange={handleDateChange}
            className="w-full max-w-xs px-4 py-3 border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm"
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading attendance records...</span>
          </div>
        )}

        {/* No Records */}
        {!loading && attendanceRecords.length === 0 && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Attendance Records</h3>
            <p className="text-gray-600">
              No attendance has been marked for {classInfo.year} | Semester {classInfo.semester} | Section {classInfo.section} on {new Date(historyDate).toLocaleDateString()}.
            </p>
          </div>
        )}

        {/* Attendance Records */}
        {!loading && attendanceRecords.length > 0 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-900">
                    Attendance Records for {new Date(historyDate).toLocaleDateString()}
                  </h3>
                  <p className="text-sm text-blue-700">
                    {attendanceRecords.length} students recorded
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-blue-600">Class</p>
                  <p className="text-xs text-blue-500">
                    {classInfo.year} | Sem {classInfo.semester} | {classInfo.section}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roll Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.map((record) => (
                      <tr key={record._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {record.studentId?.name?.charAt(0) || 'S'}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {record.studentId?.name || 'Unknown Student'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {record.studentId?.email || ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.studentId?.rollNumber || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                            <span className="mr-1">{getStatusIcon(record.status)}</span>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {record.status === 'Present' ? (
                              <button
                                onClick={() => handleEditAttendance(record.studentId._id, 'Absent')}
                                className="text-red-600 hover:text-red-900 text-sm"
                              >
                                Mark Absent
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEditAttendance(record.studentId._id, 'Present')}
                                className="text-green-600 hover:text-green-900 text-sm"
                              >
                                Mark Present
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {attendanceRecords.length}
                  </p>
                  <p className="text-sm text-gray-600">Total Students</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {attendanceRecords.filter(r => r.status === 'Present').length}
                  </p>
                  <p className="text-sm text-gray-600">Present</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {attendanceRecords.filter(r => r.status === 'Absent').length}
                  </p>
                  <p className="text-sm text-gray-600">Absent</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AttendanceHistory;

