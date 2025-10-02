import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import { apiFetch } from '../utils/apiFetch';

const ClassManagementPage = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    fetchStudents();
  }, [classId]);

  useEffect(() => {
    // Filter students based on search term
    if (searchTerm.trim() === '') {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.rollNo.toString().includes(searchTerm) ||
        student.mobile.includes(searchTerm)
      );
      setFilteredStudents(filtered);
    }
  }, [students, searchTerm]);

  const fetchStudents = async () => {
    if (!classId) {
      console.log('No classId provided');
      return;
    }
    
    console.log(`Fetching students for class: ${classId} from Student Management list`);
    
    try {
      setLoading(true);
      // Use the existing Student Management endpoint to get all students (no pagination limit)
      const res = await apiFetch({ 
        url: `/api/student/list/${classId}?limit=1000` // Get all students for class management view
      });
      
      console.log('API Response:', res.data);
      
      if (res.data.status === 'success' && res.data.data && Array.isArray(res.data.data.students)) {
        const studentsData = res.data.data.students;
        
        // Transform the data to match the expected format for Class Management
        const formattedStudents = studentsData.map(student => ({
          id: student._id,
          rollNo: student.rollNumber,
          name: student.name,
          dept: student.department,
          mobile: student.mobile || 'N/A',
          semester: student.semester,
          year: student.year,
          email: student.email,
          facultyId: student.facultyId,
          createdBy: student.createdBy
        }));
        
        setStudents(formattedStudents);
        console.log(`Successfully loaded ${formattedStudents.length} students from Student Management`);
      } else {
        console.error('Invalid response format:', res.data);
        setToast({ show: true, message: 'Invalid response format from server', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      let errorMessage = 'Error loading students';
      if (error.response?.status === 404) {
        errorMessage = 'Class not found or no students in this class';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to view this class';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setToast({ show: true, message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentClick = (studentId) => {
    navigate(`/students/${studentId}`);
  };

  const handleBackToDashboard = () => {
    navigate('/faculty/dashboard');
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
                onClick={handleBackToDashboard}
                className="mr-4 text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Dashboard
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Class Management - {classId}</h1>
                <p className="text-gray-600">Manage students in your assigned class</p>
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
        {/* Class Overview */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Students in Class {classId}
              </h2>
              <p className="text-gray-600">
                Total Students: <span className="font-semibold">{students.length}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Showing students created and managed by you • Click on any student to view their profile and attendance history
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, roll no, or mobile..."
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] w-full sm:w-80"
              />
            </div>
          </div>

          {/* Mobile View - Cards */}
          <div className="block lg:hidden space-y-4">
            {filteredStudents.map((student) => (
              <div 
                key={student.id} 
                className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-all duration-200 shadow-sm"
                onClick={() => handleStudentClick(student.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-lg">
                      {student.name}
                    </h4>
                    <p className="text-blue-600 font-medium">Roll No: {student.rollNo}</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {student.semester}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Dept:</span>
                    <span className="ml-1 font-medium">{student.dept}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Year:</span>
                    <span className="ml-1 font-medium">{student.year}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Mobile:</span>
                    <span className="ml-1 font-medium">{student.mobile}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View - Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roll No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mobile Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Semester
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <tr 
                      key={student.id} 
                      className="hover:bg-blue-50 cursor-pointer transition-colors duration-200"
                      onClick={() => handleStudentClick(student.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                        {student.rollNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.dept}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.mobile}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {student.semester}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.year}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      {loading ? 'Loading students...' : 'No students found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredStudents.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">👥</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm ? 'No students found' : 'No students in this class'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms.' 
                  : `No students have been added to class ${classId} yet.`
                }
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear search
                </button>
              )}
              {!searchTerm && students.length === 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-blue-800 text-sm">
                    <strong>No students found in your Student Management list for class {classId}</strong>
                  </p>
                  <p className="text-blue-700 text-sm mt-2">
                    To add students to this class, go to the <strong>Student Management</strong> section below and click <strong>"Add Student"</strong>.
                  </p>
                  <ul className="text-blue-700 text-sm mt-2 space-y-1">
                    <li>• Students must be created through Student Management first</li>
                    <li>• Only students you've created will appear here</li>
                    <li>• Students must be assigned to class {classId}</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleBackToDashboard}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/faculty/dashboard')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Mark Attendance
            </button>
            <button
              onClick={() => navigate('/faculty/dashboard#student-management')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add New Student
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            <strong>Note:</strong> This page shows students from your Student Management list. Students must be created there first before appearing here.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ClassManagementPage;

