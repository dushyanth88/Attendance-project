import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import TeamFooter from '../../components/TeamFooter';

const HODStudents = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [department, setDepartment] = useState('');
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('all'); // 'all', 'absent', 'od', 'absent-or-od'
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch({
        url: '/api/admin/department-students',
        method: 'GET'
      });

      if (response.data.success) {
        setStudents(response.data.data.students || []);
        setDepartment(response.data.data.department || '');
        setTotalStudents(response.data.data.total || 0);
      } else {
        setError('Failed to load students data');
      }
    } catch (e) {
      console.error('Error fetching students:', e);
      setError('Failed to load students data');
      setStudents([]);
      setTotalStudents(0);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filterStudents = (studentList) => {
    let filtered = studentList;

    // Apply attendance filter first
    if (attendanceFilter === 'absent') {
      filtered = filtered.filter(s => {
        const status = s.todayAttendanceStatus || 'Not Marked';
        return status === 'Absent';
      });
    } else if (attendanceFilter === 'od') {
      filtered = filtered.filter(s => {
        const status = s.todayAttendanceStatus || 'Not Marked';
        return status === 'OD';
      });
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

  // Group students by batch -> semester -> section
  const groupedStudents = useMemo(() => {
    const filtered = filterStudents(students);
    const groups = {};

    filtered.forEach(student => {
      const batch = student.batch || 'Unknown Batch';
      const semester = student.semester || 'Unknown Semester';
      const section = student.section || 'Unknown Section';

      if (!groups[batch]) {
        groups[batch] = {};
      }
      if (!groups[batch][semester]) {
        groups[batch][semester] = {};
      }
      if (!groups[batch][semester][section]) {
        groups[batch][semester][section] = [];
      }

      groups[batch][semester][section].push(student);
    });

    return groups;
  }, [students, searchTerm, attendanceFilter]);

  const toggleGroup = (batch, semester, section) => {
    const key = `${batch}_${semester}_${section}`;
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const expandAll = () => {
    const allKeys = {};
    Object.keys(groupedStudents).forEach(batch => {
      Object.keys(groupedStudents[batch]).forEach(semester => {
        Object.keys(groupedStudents[batch][semester]).forEach(section => {
          allKeys[`${batch}_${semester}_${section}`] = true;
        });
      });
    });
    setExpandedGroups(allKeys);
  };

  const collapseAll = () => {
    setExpandedGroups({});
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

  const getGroupedCount = () => {
    let count = 0;
    Object.values(groupedStudents).forEach(batchGroups => {
      Object.values(batchGroups).forEach(semesterGroups => {
        Object.values(semesterGroups).forEach(sectionStudents => {
          count += sectionStudents.length;
        });
      });
    });
    return count;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/hod/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{department} Students</h1>
                <p className="text-sm text-gray-500 mt-0.5">Department student directory</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats and Search Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Total Students Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{totalStudents}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Active Groups Card
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Groups</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Object.values(groupedStudents).reduce((acc, batch) => 
                    acc + Object.values(batch).reduce((semAcc, sem) => 
                      semAcc + Object.keys(sem).length, 0), 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div> */}

          {/* Search Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Search Input */}
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 min-w-0 border-0 focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-400 text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {(searchTerm || attendanceFilter !== 'all') && (
              <p className="text-xs text-gray-500 mt-2 ml-8">
                {getGroupedCount()} of {totalStudents} students
              </p>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Controls
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Students by Batch, Semester & Section</h2>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Collapse All
            </button>
          </div>
        </div> */}

        {/* Students List - Modern Card Design */}
        {Object.keys(groupedStudents).length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-gray-500 text-lg font-medium">
              {searchTerm ? 'No students found matching your search.' : 'No students found in this department.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedStudents).sort().map(batch => (
              <div key={batch} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Batch Header */}
                <div className="bg-gray-900 px-6 py-4 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-bold text-white">Batch {batch}</h3>
                  </div>
                </div>

                {/* Semesters and Sections */}
                <div className="p-6">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {Object.keys(groupedStudents[batch]).sort().map(semester => (
                      <div key={semester} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Semester Header */}
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <h4 className="text-sm font-semibold text-gray-900">Semester {semester}</h4>
                          </div>
                        </div>

                        {/* Sections */}
                        <div className="divide-y divide-gray-100">
                          {Object.keys(groupedStudents[batch][semester]).sort().map(section => {
                            const sectionStudents = groupedStudents[batch][semester][section];
                            const groupKey = `${batch}_${semester}_${section}`;
                            const isExpanded = expandedGroups[groupKey] ?? true;

                            return (
                              <div key={section} className="bg-white">
                                {/* Section Toggle */}
                                <button
                                  onClick={() => toggleGroup(batch, semester, section)}
                                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    <svg
                                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-900">Section {section}</span>
                                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                                      {sectionStudents.length}
                                    </span>
                                  </div>
                                </button>

                                {/* Students List */}
                                {isExpanded && (
                                  <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full">
                                        <thead>
                                          <tr className="border-b border-gray-200">
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Roll No</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Year</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Today's Status</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Teacher</th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                          {sectionStudents.map((student, idx) => (
                                            <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                              <td className="px-3 py-2 text-sm font-medium text-gray-900">
                                                {student.rollNumber || 'N/A'}
                                              </td>
                                              <td className="px-3 py-2 text-sm">
                                                <button
                                                  onClick={() => navigate(`/student-profile/${student.id}`)}
                                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                                >
                                                  {student.name}
                                                </button>
                                              </td>
                                              <td className="px-3 py-2 text-sm text-gray-600">
                                                {student.year || 'N/A'}
                                              </td>
                                              <td className="px-3 py-2 text-sm text-gray-600 truncate max-w-[150px]">
                                                {student.email || 'N/A'}
                                              </td>
                                              <td className="px-3 py-2 text-sm">
                                                {(() => {
                                                  const status = student.todayAttendanceStatus || 'Not Marked';
                                                  return (
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                      status === 'Present' ? 'bg-green-100 text-green-800' :
                                                      status === 'OD' ? 'bg-blue-100 text-blue-800' :
                                                      status === 'Absent' ? 'bg-red-100 text-red-800' :
                                                      'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                      {status === 'OD' ? '📋 OD' : status === 'Present' ? '✅ Present' : status === 'Absent' ? '❌ Absent' : '❔ Not Marked'}
                                                    </span>
                                                  );
                                                })()}
                                              </td>
                                              <td className="px-3 py-2 text-sm text-gray-600">
                                                {student.classTeacher ? (
                                                  <div className="text-xs">
                                                    <div className="font-medium text-gray-900">{student.classTeacher.name}</div>
                                                    {student.classTeacher.position && (
                                                      <div className="text-gray-500">{student.classTeacher.position}</div>
                                                    )}
                                                  </div>
                                                ) : 'N/A'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <TeamFooter />
    </div>
  );
};

export default HODStudents;

