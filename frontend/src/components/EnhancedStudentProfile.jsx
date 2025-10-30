import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from './Toast';
import { apiFetch } from '../utils/apiFetch';

const EnhancedStudentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingReason, setEditingReason] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    fetchStudentProfile();
    fetchAttendanceData(1);
  }, [id]);

  const fetchStudentProfile = async () => {
    try {
      setLoading(true);
      const res = await apiFetch({ 
        url: `/api/students/${id}` 
      });
      
      if (res.data) {
        setStudent(res.data);
      } else {
        setToast({ show: true, message: 'Student not found', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching student profile:', error);
      const errorMessage = error.response?.data?.message || 'Error loading student profile';
      setToast({ show: true, message: errorMessage, type: 'error' });
      
      if (error.response?.status === 404) {
        setTimeout(() => navigate(-1), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceData = async (page = 1) => {
    try {
      setAttendanceLoading(true);
      const res = await apiFetch({ 
        url: `/api/students/${id}/attendance?page=${page}&limit=10` 
      });
      
      if (res.data) {
        setAttendance(res.data);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      const errorMessage = error.response?.data?.message || 'Error loading attendance data';
      setToast({ show: true, message: errorMessage, type: 'error' });
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleEditReason = (record) => {
    setEditingReason(record.id);
    setReasonText(record.reason);
  };

  const handleSaveReason = async (recordId) => {
    try {
      const res = await apiFetch({
        url: `/api/attendance/${recordId}/reason`,
        method: 'PUT',
        data: { reason: reasonText }
      });

      if (res.data.status === 'success') {
        setToast({ show: true, message: 'Absence reason updated successfully', type: 'success' });
        setEditingReason(null);
        // Refresh attendance data
        fetchAttendanceData(currentPage);
      } else {
        throw new Error(res.data.message || 'Failed to update reason');
      }
    } catch (error) {
      console.error('Error updating reason:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update reason. Try again.';
      setToast({ show: true, message: errorMessage, type: 'error' });
    }
  };

  const handleCancelEdit = () => {
    setEditingReason(null);
    setReasonText('');
  };

  const handlePageChange = (page) => {
    fetchAttendanceData(page);
  };

  const AttendanceChart = ({ presentDays, absentDays, totalWorkingDays }) => {
    const presentPercentage = totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0;
    const absentPercentage = totalWorkingDays > 0 ? (absentDays / totalWorkingDays) * 100 : 0;

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
        <h4 className="text-lg font-semibold mb-6 text-center text-gray-800">Attendance Visualization</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="space-y-4">
            <h5 className="font-medium text-gray-700 text-center mb-4">Progress Bars</h5>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-green-600 font-medium flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Present Days
                </span>
                <span className="text-green-600 font-bold">{presentDays} ({presentPercentage.toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-green-400 to-green-600 h-4 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${presentPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-red-600 font-medium flex items-center">
                  <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                  Absent Days
                </span>
                <span className="text-red-600 font-bold">{absentDays} ({absentPercentage.toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-red-400 to-red-600 h-4 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${absentPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Enhanced Pie Chart */}
          <div className="flex flex-col items-center">
            <h5 className="font-medium text-gray-700 text-center mb-4">Overall Attendance</h5>
            <div className="relative w-40 h-40">
              <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="transparent"
                  stroke="#f3f4f6"
                  strokeWidth="4"
                />
                {/* Present percentage arc */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="transparent"
                  stroke="url(#greenGradient)"
                  strokeWidth="4"
                  strokeDasharray={`${presentPercentage} ${100 - presentPercentage}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
                {/* Gradient definitions */}
                <defs>
                  <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {attendance?.attendancePercentage || 0}%
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Attendance</div>
                </div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex justify-center space-x-4 mt-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-xs text-gray-600">Present</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-300 rounded-full mr-2"></div>
                <span className="text-xs text-gray-600">Absent</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Student Not Found</h2>
          <button
            onClick={() => navigate(-1)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
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
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {student.name} - Roll No: {student.rollNo}
                </h1>
                <p className="text-gray-600">Student Profile & Attendance History</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Card 1: Personal Details */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center mb-6">
                {student?.profileImage ? (
                  <img
                    src={student.profileImage}
                    alt={student?.name || 'Profile'}
                    className="w-20 h-20 rounded-full object-cover mx-auto mb-4 border border-gray-200"
                  />
                ) : (
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-blue-600">
                      {student?.name?.charAt(0)?.toUpperCase() || 'S'}
                    </span>
                  </div>
                )}
                <h2 className="text-xl font-bold text-gray-900">{student?.name || 'Unknown'}</h2>
                <p className="text-gray-600">Roll No: {student?.rollNo || 'N/A'}</p>
              </div>

              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Details</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Roll No:</span>
                      <span className="font-medium">{student?.rollNo || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Full Name:</span>
                      <span className="font-medium">{student?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Department:</span>
                      <span className="font-medium">{student?.dept || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Year:</span>
                      <span className="font-medium">{student?.year || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Semester:</span>
                      <span className="font-medium">{student?.semester || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mobile Number:</span>
                      <span className="font-medium">{student?.mobile || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium text-sm">{student?.email || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Class:</span>
                      <span className="font-medium">{student.classAssigned}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 & 3: Attendance Summary and History */}
          <div className="lg:col-span-2">
            {/* Card 2: Attendance Summary */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Attendance Summary</h3>
              
              {attendanceLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : attendance ? (
                <div className="space-y-6">
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        ✅ {attendance.presentDays}
                      </div>
                      <div className="text-sm text-green-700">Days Present</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        ❌ {attendance.absentDays}
                      </div>
                      <div className="text-sm text-red-700">Days Absent</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        📅 {attendance.totalWorkingDays}
                      </div>
                      <div className="text-sm text-blue-700">Total Working Days</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        📊 {attendance.attendancePercentage}%
                      </div>
                      <div className="text-sm text-purple-700">Attendance %</div>
                    </div>
                  </div>

                  {/* Attendance Chart */}
                  <AttendanceChart 
                    presentDays={attendance.presentDays} 
                    absentDays={attendance.absentDays} 
                    totalWorkingDays={attendance.totalWorkingDays}
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-6xl mb-4">📊</div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Attendance Records Found</h4>
                  <p className="text-gray-600">This student doesn't have any attendance records yet.</p>
                </div>
              )}
            </div>

            {/* Card 3: Attendance History Table */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Attendance History</h3>
              
              {attendanceLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : attendance && attendance.attendanceHistory.length > 0 ? (
                <div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reason
                          </th>
                          {user.role !== 'student' && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {attendance.attendanceHistory.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(record.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                record.status === 'Present' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {record.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {editingReason === record.id ? (
                                <div className="flex items-center space-x-2">
                                  <textarea
                                    value={reasonText}
                                    onChange={(e) => setReasonText(e.target.value)}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm resize-none"
                                    rows="2"
                                    placeholder="Enter absence reason..."
                                    maxLength="500"
                                  />
                                  <div className="flex flex-col space-y-1">
                                    <button
                                      onClick={() => handleSaveReason(record.id)}
                                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className={record.reason ? 'text-gray-900' : 'text-gray-400 italic'}>
                                  {record.reason || 'No reason provided'}
                                </span>
                              )}
                            </td>
                            {user.role !== 'student' && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {record.canEdit && editingReason !== record.id && (
                                  <button
                                    onClick={() => handleEditReason(record)}
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    Edit Reason
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {attendance.pagination && attendance.pagination.pages > 1 && (
                    <div className="mt-6 flex justify-center">
                      <nav className="flex space-x-2">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        
                        {Array.from({ length: attendance.pagination.pages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              page === currentPage
                                ? 'text-blue-600 bg-blue-50 border border-blue-300'
                                : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === attendance.pagination.pages}
                          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-6xl mb-4">📅</div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Attendance History</h4>
                  <p className="text-gray-600">No attendance records found for this student.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EnhancedStudentProfile;
