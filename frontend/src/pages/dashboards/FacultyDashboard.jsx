import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';

const FacultyDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState(null);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentAttendance, setStudentAttendance] = useState({});
  const [expandedClasses, setExpandedClasses] = useState(new Set());

  useEffect(() => {
    fetchFacultyDashboard();
  }, []);

  const fetchStudentAttendance = async (classData) => {
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      
      // Fetch students for this class
      const studentsResponse = await apiFetch({
        url: `/api/student/list?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}`,
        method: 'GET'
      });

      if (!studentsResponse.data.success) {
        console.error('Failed to fetch students:', studentsResponse.data.message);
        return;
      }

      const students = studentsResponse.data.data || [];
      
      // Fetch today's attendance for this class
      const attendanceResponse = await apiFetch({
        url: `/api/attendance/history?batch=${classData.batch}&year=${classData.year}&semester=${classData.semester}&section=${classData.section}&date=${todayISO}`,
        method: 'GET'
      });

      const attendanceRecords = attendanceResponse.data.success ? attendanceResponse.data.data || [] : [];
      
      // Create a map of student attendance
      const attendanceMap = {};
      attendanceRecords.forEach(record => {
        attendanceMap[record.studentId] = record.status;
      });

      // Combine student data with attendance status
      const studentsWithAttendance = students.map(student => ({
        ...student,
        attendanceStatus: attendanceMap[student.userId] || 'Not Marked'
      }));

      setStudentAttendance(prev => ({
        ...prev,
        [classData.classId]: studentsWithAttendance
      }));

    } catch (error) {
      console.error('Error fetching student attendance:', error);
    }
  };

  const toggleClassExpansion = (classId) => {
    setExpandedClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(classId)) {
        newSet.delete(classId);
      } else {
        newSet.add(classId);
        // Fetch student data when expanding
        const classData = assignedClasses.find(cls => cls.classId === classId);
        if (classData) {
          fetchStudentAttendance(classData);
        }
      }
      return newSet;
    });
  };

  const fetchFacultyDashboard = async () => {
    try {
      setLoading(true);
      
      // Fetch faculty profile
      const facultyResponse = await apiFetch({
        url: `/api/faculty/${user.id}/dashboard`,
        method: 'GET'
      });

      if (facultyResponse.data.success) {
        setFaculty(facultyResponse.data.faculty);
      }

      // Fetch assigned classes
      const classesResponse = await apiFetch({
        url: `/api/faculty/${user.id}/classes`,
        method: 'GET'
      });

      console.log('📋 Classes response:', classesResponse.data);

      if (classesResponse.data.success) {
        const classes = classesResponse.data.data || [];
        console.log('✅ Assigned classes loaded:', classes.length, classes);
        setAssignedClasses(classes);
      } else {
        console.error('❌ Failed to fetch assigned classes:', classesResponse.data.message);
        setAssignedClasses([]);
      }
    } catch (error) {
      console.error('Error fetching faculty dashboard:', error);
      setAssignedClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    logout();
    navigate('/login');
  };

  const handleManageClass = (classId) => {
    navigate(`/faculty/class/${classId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading faculty dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Fixed Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Faculty Details - Left Side */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xl">
                    {faculty?.name?.charAt(0) || 'F'}
                  </span>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">
                    {faculty?.name || 'Faculty'}
                  </h4>
                  <p className="text-sm text-white text-opacity-90">
                    {faculty?.department || user?.department}
                  </p>
                  {faculty?.email && (
                    <small className="text-xs text-white text-opacity-80">
                      {faculty.email}
                    </small>
                  )}
                </div>
              </div>
            </div>

            {/* Logout Button - Right Side */}
            <button
              onClick={handleLogout}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center">
                <div className="bg-white bg-opacity-20 p-3 rounded-xl mr-4">
                  <span className="text-3xl">👨‍🏫</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Faculty Dashboard</h1>
                  <p className="mt-2 text-white text-opacity-90">
                    Manage your assigned classes and student data
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Classes Section */}
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-100">
            <div className="px-6 py-6 border-b border-blue-200">
              <div className="flex items-center">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl mr-4 shadow-lg">
                  <span className="text-2xl">📚</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Assigned Classes</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Click "Manage" to access attendance, reports, and student data for each class
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {assignedClasses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignedClasses.map((cls, index) => (
                    <div key={cls.classId || index} className="bg-gradient-to-br from-white to-purple-50 rounded-2xl border border-purple-100 p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-800 mb-2">
                            {cls.batch} | {cls.year} | Semester {cls.semester} | Section {cls.section}
                          </h3>
                          
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Batch:</span>
                              <span className="text-purple-600 font-semibold">{cls.batch}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Year:</span>
                              <span>{cls.year}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Semester:</span>
                              <span>{cls.semester}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Section:</span>
                              <span>{cls.section}</span>
                            </div>
                            {cls.assignedDate && (
                              <div className="flex items-center">
                                <span className="font-medium mr-2">Assigned:</span>
                                <span className="text-green-600">
                                  {new Date(cls.assignedDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
                          Active
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Class Advisor
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => toggleClassExpansion(cls.classId)}
                            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 text-sm font-medium shadow-lg"
                          >
                            {expandedClasses.has(cls.classId) ? '📋 Hide Students' : '👥 View Students'}
                          </button>
                          <button
                            onClick={() => handleManageClass(cls.classId)}
                            className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 text-sm font-medium shadow-lg"
                          >
                            Manage Class
                          </button>
                        </div>
                      </div>

                      {/* Expandable Student List */}
                      {expandedClasses.has(cls.classId) && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Today's Student Attendance</h4>
                          
                          {/* Attendance Summary */}
                          {studentAttendance[cls.classId] && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              <div className="bg-green-50 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-green-600">
                                  {studentAttendance[cls.classId].filter(s => s.attendanceStatus === 'Present').length}
                                </div>
                                <div className="text-xs text-green-700">Present</div>
                              </div>
                              <div className="bg-red-50 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-red-600">
                                  {studentAttendance[cls.classId].filter(s => s.attendanceStatus === 'Absent').length}
                                </div>
                                <div className="text-xs text-red-700">Absent</div>
                              </div>
                              <div className="bg-yellow-50 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-yellow-600">
                                  {studentAttendance[cls.classId].filter(s => s.attendanceStatus === 'Not Marked').length}
                                </div>
                                <div className="text-xs text-yellow-700">Not Marked</div>
                              </div>
                            </div>
                          )}
                          
                          <div className="max-h-64 overflow-y-auto">
                            {studentAttendance[cls.classId] ? (
                              <div className="space-y-2">
                                {studentAttendance[cls.classId].map((student, index) => (
                                  <div key={student._id || student.id || index} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                        <span className="text-xs font-medium text-white">
                                          {student.name?.charAt(0) || 'S'}
                                        </span>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{student.name}</p>
                                        <p className="text-xs text-gray-500">Roll: {student.rollNumber}</p>
                                      </div>
                                    </div>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium shadow-sm ${
                                      student.attendanceStatus === 'Present' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
                                      student.attendanceStatus === 'Absent' ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white' :
                                      'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                                    }`}>
                                      {student.attendanceStatus === 'Present' ? '✅ Present' :
                                       student.attendanceStatus === 'Absent' ? '❌ Absent' :
                                       '⏳ Not Marked'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-sm text-gray-600">Loading students...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 shadow-lg border border-gray-100">
                    <div className="text-gray-500 mb-4">
                      <div className="bg-gradient-to-br from-gray-400 to-gray-500 p-4 rounded-2xl mx-auto w-16 h-16 flex items-center justify-center">
                        <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">No Assigned Classes</h3>
                    <p className="text-gray-600">
                      You don't have any classes assigned yet. Contact your HOD for class assignments.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FacultyDashboard;