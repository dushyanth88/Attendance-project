import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CreateStudentModal from '../../components/CreateStudentModal';
import StudentList from '../../components/StudentList';
import Toast from '../../components/Toast';
import { apiFetch } from '../../utils/apiFetch';

const FacultyDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [assignedClass, setAssignedClass] = useState(null);
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [studentRefreshTrigger, setStudentRefreshTrigger] = useState(0);
  const [attendanceForm, setAttendanceForm] = useState({ date: new Date().toISOString().slice(0,10), absentees: '' });
  const [attendanceToast, setAttendanceToast] = useState({ show: false, message: '', type: 'success' });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().slice(0,10));
  const [historyRows, setHistoryRows] = useState([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);

  // Fetch student count for the assigned class using Student Management endpoint
  const fetchStudentCount = useCallback(async (classId) => {
    if (!classId) return;
    
    try {
      const res = await apiFetch({ 
        url: `/api/student/list/${classId}?limit=1000` // Use same endpoint as Student Management
      });
      
      if (res.data.status === 'success' && res.data.data && Array.isArray(res.data.data.students)) {
        setTotalStudentsCount(res.data.data.students.length);
      } else {
        setTotalStudentsCount(0);
      }
    } catch (error) {
      console.error('Error fetching student count:', error);
      setTotalStudentsCount(0);
    }
  }, []);

  // Check if faculty is assigned as class teacher
  useEffect(() => {
    // This would typically come from the user's profile or a separate API call
    // For now, we'll simulate checking if the user has an assigned class
    const checkAssignedClass = async () => {
      try {
        // In a real implementation, you would fetch this from an API
        // For now, we'll use a mock value or check user properties
        if (user?.assignedClass && user.assignedClass !== 'None') {
          setAssignedClass(user.assignedClass);
        }
      } catch (error) {
        console.error('Error checking assigned class:', error);
      }
    };

    checkAssignedClass();
  }, [user]);

  // Fetch student count when assigned class changes
  useEffect(() => {
    if (assignedClass) {
      fetchStudentCount(assignedClass);
    }
  }, [assignedClass, studentRefreshTrigger, fetchStudentCount]);

  const handleAttendanceChange = (e) => {
    const { name, value } = e.target;
    setAttendanceForm(prev => ({ ...prev, [name]: value }));
  };

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    if (!assignedClass) return;
    setAttendanceLoading(true);
    try {
      // Parse roll numbers as integers
      const absentRollNumbers = attendanceForm.absentees
        .split(',')
        .map(num => parseInt(num.trim()))
        .filter(num => !isNaN(num));
      
      const res = await apiFetch({
        url: '/api/attendance/mark',
        method: 'POST',
        data: { 
          classId: assignedClass, 
          date: attendanceForm.date, 
          absentRollNumbers: absentRollNumbers 
        }
      });
      const data = res.data;
      if (data.status === 'success') {
        setAttendanceToast({ show: true, message: data.message || `Attendance marked successfully for ${assignedClass} on ${attendanceForm.date}.`, type: 'success' });
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl mr-3">👩‍🏫</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Faculty Dashboard</h1>
                <p className="text-gray-600">Welcome back, {user?.name}</p>
                <p className="text-sm text-blue-600">Department: {user?.department}</p>
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
            <form onSubmit={handleMarkAttendance} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <input disabled value={assignedClass || ''} className="w-full px-3 py-2 border rounded-lg bg-gray-100" />
              </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input type="date" name="date" value={attendanceForm.date} disabled className="w-full px-3 py-2 border rounded-lg bg-gray-100" />
                </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Absent Roll Numbers (comma-separated)</label>
                <input type="text" name="absentees" value={attendanceForm.absentees} onChange={handleAttendanceChange} placeholder="e.g., 44, 7" className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={attendanceLoading} className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                  {attendanceLoading ? 'Saving...' : 'Mark Attendance'}
            </button>
                <button type="button" onClick={async () => {
                  setAttendanceLoading(true);
                  try {
                    // Parse roll numbers as integers
                    const absentRollNumbers = attendanceForm.absentees
                      .split(',')
                      .map(num => parseInt(num.trim()))
                      .filter(num => !isNaN(num));
                    
                    const today = new Date().toISOString().slice(0,10);
                    const res = await apiFetch({ 
                      url: '/api/attendance/edit', 
                      method: 'PUT', 
                      data: { 
                        classId: assignedClass, 
                        date: today,
                        absentRollNumbers: absentRollNumbers 
                      } 
                    });
                    const data = res.data;
                    if (data.status === 'success') {
                      setAttendanceToast({ show: true, message: data.message || `Today's attendance updated for ${assignedClass}.`, type: 'success' });
                    } else {
                      throw new Error(data.message || 'Failed to update attendance');
                    }
                  } catch (e) {
                    const errorMessage = e.response?.data?.message || e.message || 'Failed to update attendance';
                    setAttendanceToast({ show: true, message: errorMessage, type: 'error' });
                  } finally {
                    setAttendanceLoading(false);
                  }
                }} disabled={attendanceLoading} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">Edit Today's Attendance</button>
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

          {assignedClass && (
          <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-3xl mr-3">👥</span>
                <div>
                    <p className="text-sm text-gray-600">Class Management</p>
                    <p className="text-sm text-gray-500">View & manage students</p>
                </div>
              </div>
                <button
                  onClick={() => navigate(`/class-management/${assignedClass}`)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Manage Class
                </button>
              </div>
            </div>
          )}
          </div>
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
                    const res = await apiFetch({ 
                      url: `/api/attendance/history?classId=${encodeURIComponent(assignedClass)}&date=${encodeURIComponent(historyDate)}` 
                    });
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
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${r.status === 'Present' ? 'text-green-600' : 'text-red-600'}`}>{r.status}</td>
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
                onClick={() => setShowCreateStudentModal(true)}
                className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors min-h-[44px]"
              >
                Add Student
              </button>
            </div>
            
            <StudentList 
              assignedClass={assignedClass}
              refreshTrigger={studentRefreshTrigger}
            />
          </div>
        )}
      </main>

      {/* Create Student Modal */}
      <CreateStudentModal
        isOpen={showCreateStudentModal}
        onClose={() => setShowCreateStudentModal(false)}
        onStudentCreated={() => setStudentRefreshTrigger(prev => prev + 1)}
        assignedClass={assignedClass}
      />

      {/* Toast Notifications */}
      {attendanceToast.show && (
        <Toast
          message={attendanceToast.message}
          type={attendanceToast.type}
          onClose={() => setAttendanceToast({ show: false, message: '', type: 'success' })}
        />
      )}
    </div>
  );
};

export default FacultyDashboard;
