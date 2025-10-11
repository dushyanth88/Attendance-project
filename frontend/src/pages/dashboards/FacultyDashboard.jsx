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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Faculty Details - Left Side */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {faculty?.name?.charAt(0) || 'F'}
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {faculty?.name || 'Faculty'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {faculty?.department || user?.department}
                  </p>
                  {faculty?.email && (
                    <small className="text-xs text-gray-500">
                      {faculty.email}
                    </small>
                  )}
                </div>
              </div>
            </div>

            {/* Logout Button - Right Side */}
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Faculty Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Manage your assigned classes and student data
            </p>
          </div>

          {/* Assigned Classes Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Assigned Classes</h2>
              <p className="text-sm text-gray-500 mt-1">
                Click "Manage" to access attendance, reports, and student data for each class
              </p>
            </div>

            <div className="p-6">
              {assignedClasses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignedClasses.map((cls, index) => (
                    <div key={cls.classId || index} className="bg-gray-50 rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {cls.batch} | {cls.year} | Semester {cls.semester} | Section {cls.section}
                          </h3>
                          
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Batch:</span>
                              <span className="text-blue-600 font-semibold">{cls.batch}</span>
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

                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
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
                            className="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                          >
                            {expandedClasses.has(cls.classId) ? '📋 Hide Students' : '👥 View Students'}
                          </button>
                          <button
                            onClick={() => handleManageClass(cls.classId)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
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
                                  <div key={student._id || student.id || index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                        <span className="text-xs font-medium text-gray-600">
                                          {student.name?.charAt(0) || 'S'}
                                        </span>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{student.name}</p>
                                        <p className="text-xs text-gray-500">Roll: {student.rollNumber}</p>
                                      </div>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      student.attendanceStatus === 'Present' ? 'bg-green-100 text-green-800' :
                                      student.attendanceStatus === 'Absent' ? 'bg-red-100 text-red-800' :
                                      'bg-yellow-100 text-yellow-800'
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
                  <div className="text-gray-500 mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Assigned Classes</h3>
                  <p className="text-gray-500">
                    You don't have any classes assigned yet. Contact your HOD for class assignments.
                  </p>
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