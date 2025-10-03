import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const [todayStatus, setTodayStatus] = useState('-');
  const [overall, setOverall] = useState('-');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        if (!user?.id) return;
        const res = await fetch(`/api/attendance/student/${user.id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        const data = await res.json();
        if (res.ok && data && Array.isArray(data.attendance)) {
          setHistory(data.attendance);
          setOverall(data.overall_percentage || '-');
          const today = new Date().toISOString().slice(0,10);
          const todayRec = data.attendance.find(a => a.date === today);
          setTodayStatus(todayRec ? todayRec.status : '-');
        }
      } catch (e) {
        // noop for now
      }
    };
    fetchAttendance();
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
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], status: payload.status };
            return next;
          }
          return [{ date: payload.date, status: payload.status }, ...prev];
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🎒</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
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
        {/* Attendance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📊</span>
              <div>
                <p className="text-sm text-gray-600">Overall Attendance</p>
                <p className="text-2xl font-bold text-green-600">{overall}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">✅</span>
              <div>
                <p className="text-sm text-gray-600">Present Days</p>
                <p className="text-2xl font-bold text-gray-900">142</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">❌</span>
              <div>
                <p className="text-sm text-gray-600">Absent Days</p>
                <p className="text-2xl font-bold text-red-600">9</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📚</span>
              <div>
                <p className="text-sm text-gray-600">Active Subjects</p>
                <p className="text-2xl font-bold text-gray-900">6</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Schedule */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📅</span>
              <h3 className="text-lg font-semibold">Today's Status</h3>
            </div>
            <div className={`p-4 rounded-lg ${todayStatus === 'Present' ? 'bg-green-50 border-l-4 border-green-500' : todayStatus === 'Absent' ? 'bg-red-50 border-l-4 border-red-500' : 'bg-gray-50 border'}`}>
              <p className="font-medium">{todayStatus === '-' ? 'No record for today' : todayStatus}</p>
            </div>
          </div>

          {/* Subject-wise Attendance */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📚</span>
              <h3 className="text-lg font-semibold">Subject-wise Attendance</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Data Structures</span>
                  <span className="text-sm text-gray-600">96.7%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '96.7%'}}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Algorithms</span>
                  <span className="text-sm text-gray-600">92.3%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '92.3%'}}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Database Systems</span>
                  <span className="text-sm text-gray-600">94.1%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '94.1%'}}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Computer Networks</span>
                  <span className="text-sm text-gray-600">89.5%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-600 h-2 rounded-full" style={{width: '89.5%'}}></div>
                </div>
              </div>
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
                  <div>
                    <p className="font-medium">{rec.date}</p>
                  </div>
                  <span className={`${rec.status === 'Present' ? 'text-green-600' : 'text-red-600'} font-semibold`}>{rec.status}</span>
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
              <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-left">
                📈 Weekly Report
              </button>
              <button className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-left">
                📅 Monthly Report
              </button>
              <button className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-left">
                📊 Subject-wise Report
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
