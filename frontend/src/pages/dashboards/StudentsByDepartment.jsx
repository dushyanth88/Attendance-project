import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import TeamFooter from '../../components/TeamFooter';

const StudentsByDepartment = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [studentsByDepartment, setStudentsByDepartment] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDepartments, setExpandedDepartments] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('all'); // 'all', 'absent', 'od', 'absent-or-od'

  useEffect(() => {
    fetchStudentsByDepartment();
  }, []);

  const fetchStudentsByDepartment = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch({
        url: '/api/admin/students-by-department',
        method: 'GET'
      });

      if (response.data.success) {
        const departments = response.data.data.departments || [];
        console.log('📊 Students by department loaded:', departments.length, 'departments');
        
        // Debug: Check if students have todayAttendanceStatus
        departments.forEach(dept => {
          const odCount = dept.students?.filter(s => (s.todayAttendanceStatus || 'Not Marked') === 'OD').length || 0;
          const absentCount = dept.students?.filter(s => (s.todayAttendanceStatus || 'Not Marked') === 'Absent').length || 0;
          if (odCount > 0 || absentCount > 0) {
            console.log(`📋 ${dept.department}: ${odCount} OD, ${absentCount} Absent`);
            // Log sample student with attendance status
            const sample = dept.students?.find(s => s.todayAttendanceStatus);
            if (sample) {
              console.log(`📋 Sample student: ${sample.name} - Status: ${sample.todayAttendanceStatus}`);
            }
          }
        });
        
        setStudentsByDepartment(departments);
        setTotalStudents(response.data.data.total || 0);
      } else {
        setError('Failed to load students data');
      }
    } catch (e) {
      console.error('Error fetching students by department:', e);
      setError('Failed to load students data');
      setStudentsByDepartment([]);
      setTotalStudents(0);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleDepartment = (department) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(department)) {
      newExpanded.delete(department);
    } else {
      newExpanded.add(department);
    }
    setExpandedDepartments(newExpanded);
  };

  const filterStudents = (students) => {
    let filtered = students;

    // Apply attendance filter first
    if (attendanceFilter === 'absent') {
      filtered = filtered.filter(s => {
        const status = s.todayAttendanceStatus || 'Not Marked';
        const isAbsent = status === 'Absent';
        if (attendanceFilter === 'absent' && !isAbsent) {
          console.log(`🔍 Filtering out: ${s.name} - Status: ${status}`);
        }
        return isAbsent;
      });
      console.log(`📊 After absent filter: ${filtered.length} students`);
    } else if (attendanceFilter === 'od') {
      filtered = filtered.filter(s => {
        const status = s.todayAttendanceStatus || 'Not Marked';
        const isOD = status === 'OD';
        if (!isOD && s.todayAttendanceStatus) {
          console.log(`🔍 Filtering out: ${s.name} - Status: ${status}`);
        }
        return isOD;
      });
      console.log(`📊 After OD filter: ${filtered.length} students`);
    } else if (attendanceFilter === 'absent-or-od') {
      filtered = filtered.filter(s => {
        const status = s.todayAttendanceStatus || 'Not Marked';
        return status === 'Absent' || status === 'OD';
      });
    }

    // Apply search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(term) ||
        student.rollNumber?.toLowerCase().includes(term) ||
        student.email?.toLowerCase().includes(term) ||
        student.batch?.toLowerCase().includes(term) ||
        student.mobile?.includes(term)
      );
    }

    return filtered;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading students data...</p>
        </div>
      </div>
    );
  }

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
                <h1 className="text-3xl font-bold text-white">Students by Department</h1>
                <p className="text-white text-opacity-90">All students organized by department</p>
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
        {/* Summary Card */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Total Students</h2>
              <p className="text-white text-opacity-90">Across all departments</p>
            </div>
            <div className="text-4xl font-bold">{totalStudents}</div>
          </div>
        </div>

        {/* Search Bar and Filters */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Search Input */}
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, roll number, email, batch, or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-0 border-0 focus:ring-0 focus:outline-none text-gray-700 placeholder-gray-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Attendance Filter */}
            <div className="flex items-center space-x-2 md:border-l md:border-gray-200 md:pl-4 pt-2 md:pt-0 border-t border-gray-200 md:border-t-0 flex-shrink-0">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter:</span>
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 bg-white min-w-[160px] flex-shrink-0"
              >
                <option value="all">All Students</option>
                <option value="absent">❌ Absentees Only</option>
                <option value="od">📋 OD Only</option>
                <option value="absent-or-od">❌ Absent + 📋 OD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Students by Department */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Students by Department</h3>
          
          <div className="space-y-4">
            {studentsByDepartment.map((dept) => {
              const filteredStudents = filterStudents(dept.students);
              return (
                <div key={dept.department} className="border rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleDepartment(dept.department)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="font-semibold text-gray-800 text-lg">{dept.department}</span>
                      <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
                        {filteredStudents.length} {filteredStudents.length === 1 ? 'Student' : 'Students'}
                        {searchTerm && filteredStudents.length !== dept.count && (
                          <span className="ml-1 text-gray-500">(of {dept.count})</span>
                        )}
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        expandedDepartments.has(dept.department) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {expandedDepartments.has(dept.department) && (
                    <div className="border-t bg-gray-50 p-4">
                      {filteredStudents.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          {searchTerm ? 'No students found matching your search.' : 'No students found in this department.'}
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Roll No</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Batch</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Year</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Semester</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Section</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Mobile</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Class Teacher</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {student.rollNumber || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    <button
                                      onClick={() => navigate(`/student-profile/${student.id}`)}
                                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                                    >
                                      {student.name}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {student.batch || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {student.year || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {student.semester || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {student.section || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {student.email || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {student.mobile || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {student.classTeacher ? (
                                      <div>
                                        <div className="font-medium">{student.classTeacher.name}</div>
                                        {student.classTeacher.position && (
                                          <div className="text-xs text-gray-500">{student.classTeacher.position}</div>
                                        )}
                                      </div>
                                    ) : 'N/A'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {(!studentsByDepartment || studentsByDepartment.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No student data available.</p>
            )}
          </div>
        </div>
      </main>

      <TeamFooter />
    </div>
  );
};

export default StudentsByDepartment;

