import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import TeamFooter from '../../components/TeamFooter';

const DepartmentAttendance = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [departmentStats, setDepartmentStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchDepartmentAttendance();
  }, []);

  const fetchDepartmentAttendance = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch({
        url: '/api/admin/attendance-by-department',
        method: 'GET'
      });

      if (response.data.success) {
        setDepartmentStats(response.data.data.departments || []);
        setLastUpdated(response.data.data.lastUpdated);
      } else {
        setError('Failed to load attendance data');
      }
    } catch (e) {
      console.error('Error fetching department attendance:', e);
      setError('Failed to load attendance data');
      setDepartmentStats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPercentageColor = (percentage) => {
    if (percentage >= 75) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPercentageBgColor = (percentage) => {
    if (percentage >= 75) return 'bg-green-100';
    if (percentage >= 50) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getProgressBarColor = (percentage) => {
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  const overallStats = departmentStats.reduce((acc, dept) => {
    acc.total += dept.totalStudents;
    acc.present += dept.presentStudents;
    acc.absent += dept.absentStudents;
    acc.notMarked += dept.notMarkedStudents;
    return acc;
  }, { total: 0, present: 0, absent: 0, notMarked: 0 });

  const overallPercentage = overallStats.total > 0 
    ? Math.round((overallStats.present / overallStats.total) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/principal/dashboard')}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white">Department-wise Attendance</h1>
                <p className="text-white text-opacity-90">Today's attendance percentage by department</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Summary Card */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Overall Attendance Today</h2>
              <p className="text-white text-opacity-90">
                {lastUpdated && new Date(lastUpdated).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">{overallPercentage}%</div>
              <p className="text-white text-opacity-90 text-sm">Attendance</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-sm text-white text-opacity-90">Total Students</div>
              <div className="text-2xl font-bold">{overallStats.total}</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-sm text-white text-opacity-90">Present</div>
              <div className="text-2xl font-bold text-green-200">{overallStats.present}</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-sm text-white text-opacity-90">Absent</div>
              <div className="text-2xl font-bold text-red-200">{overallStats.absent}</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-sm text-white text-opacity-90">Not Marked</div>
              <div className="text-2xl font-bold text-yellow-200">{overallStats.notMarked}</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white bg-opacity-20 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor(overallPercentage)}`}
                style={{ width: `${overallPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Department Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departmentStats.map((dept) => (
            <div
              key={dept.department}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">{dept.department}</h3>
                <div className={`px-3 py-1 rounded-full font-bold ${getPercentageBgColor(dept.attendancePercentage)} ${getPercentageColor(dept.attendancePercentage)}`}>
                  {dept.attendancePercentage}%
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Students</span>
                  <span className="font-semibold text-gray-800">{dept.totalStudents}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Present</span>
                  <span className="font-semibold text-green-600">{dept.presentStudents}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Absent</span>
                  <span className="font-semibold text-red-600">{dept.absentStudents}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Not Marked</span>
                  <span className="font-semibold text-yellow-600">{dept.notMarkedStudents}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Attendance Progress</span>
                    <span>{dept.attendancePercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(dept.attendancePercentage)}`}
                      style={{ width: `${dept.attendancePercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {departmentStats.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No department attendance data available</p>
          </div>
        )}
      </main>

      <TeamFooter />
    </div>
  );
};

export default DepartmentAttendance;

