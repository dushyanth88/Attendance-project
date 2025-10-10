import { useState, useEffect } from 'react';
import { useClass } from '../context/ClassContext';
import { apiFetch } from '../utils/apiFetch';
import { refreshStudentsList, formatStudentData } from '../utils/studentSync';
import Toast from '../components/Toast';
import EditStudentModal from '../components/EditStudentModal';
import DeleteStudentModal from '../components/DeleteStudentModal';
import BulkUploadModal from '../components/BulkUploadModal';

const StudentManagement = () => {
  const { activeClass, getClassInfo } = useClass();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bulkUploadModalOpen, setBulkUploadModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const classInfo = getClassInfo();

  useEffect(() => {
    if (classInfo) {
      fetchStudents();
    }
  }, [classInfo]);

  const fetchStudents = async () => {
    if (!classInfo) return;
    
    console.log('🔍 Fetching students with classInfo:', classInfo);
    
    setLoading(true);
    try {
      const url = `/api/students?batch=${encodeURIComponent(classInfo.batch)}&year=${encodeURIComponent(classInfo.year)}&semester=${encodeURIComponent(classInfo.semester)}&section=${encodeURIComponent(classInfo.section)}`;
      console.log('📡 API URL:', url);
      
      const response = await apiFetch({
        url,
        method: 'GET'
      });

      console.log('📊 API Response:', response.data);

      if (response.data.success) {
        const students = response.data.data.students || [];
        console.log(`✅ Found ${students.length} students`);
        
        // Validate student data before display (more flexible for backward compatibility)
        const validatedStudents = students.filter(student => {
          const isValid = student.rollNumber && student.name && student.email;
          if (!isValid) {
            console.warn('Invalid student data found:', student);
          }
          return isValid;
        });
        
        if (validatedStudents.length !== students.length) {
          console.warn(`Filtered out ${students.length - validatedStudents.length} invalid students`);
        }
        
        setStudents(validatedStudents);
        
        // Show appropriate message based on student count
        if (validatedStudents.length === 0) {
          setToast({
            show: true,
            message: 'No students found for this class. Try reloading or check if upload succeeded.',
            type: 'warning'
          });
        }
      } else {
        console.log('❌ API returned success: false');
        setStudents([]);
        setToast({
          show: true,
          message: 'Failed to load students. Please try again.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('❌ Error fetching students:', error);
      setToast({ show: true, message: 'Failed to load students', type: 'error' });
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAttendanceStats = (student) => {
    if (student.attendanceSummary) {
      const { totalClasses, presentCount, absentCount } = student.attendanceSummary;
      const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;
      return { totalClasses, presentCount, absentCount, percentage };
    }
    return { totalClasses: 0, presentCount: 0, absentCount: 0, percentage: 0 };
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleEditStudent = (student) => {
    setSelectedStudent(student);
    setEditModalOpen(true);
  };

  const handleDeleteStudent = (student) => {
    setSelectedStudent(student);
    setDeleteModalOpen(true);
  };

  const handleStudentUpdated = async (updatedStudent) => {
    console.log('🔄 Updating student in UI:', updatedStudent);
    
    // Format the updated student data
    const formattedStudent = formatStudentData(updatedStudent);
    
    // Update the local state immediately for instant UI feedback
    setStudents(prevStudents => 
      prevStudents.map(student => {
        const studentId = student.id || student._id;
        const updatedId = formattedStudent.id || formattedStudent._id;
        return studentId === updatedId ? { ...student, ...formattedStudent } : student;
      })
    );
    
    // Optionally refresh the entire list to ensure data consistency
    try {
      const refreshedStudents = await refreshStudentsList(classInfo);
      if (refreshedStudents.length > 0) {
        setStudents(refreshedStudents.map(formatStudentData));
      }
    } catch (error) {
      console.error('Error refreshing students list:', error);
    }
  };

  const handleStudentDeleted = async (studentId) => {
    console.log('🗑️ Removing student from UI:', studentId);
    
    // Remove from local state immediately for instant UI feedback
    setStudents(prevStudents => 
      prevStudents.filter(student => {
        const studentIdToCheck = student.id || student._id;
        return studentIdToCheck !== studentId;
      })
    );
    
    // Refresh the entire list to ensure data consistency
    try {
      const refreshedStudents = await refreshStudentsList(classInfo);
      setStudents(refreshedStudents.map(formatStudentData));
    } catch (error) {
      console.error('Error refreshing students list after deletion:', error);
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedStudent(null);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setSelectedStudent(null);
  };

  const handleBulkUpload = () => {
    setBulkUploadModalOpen(true);
  };

  const closeBulkUploadModal = () => {
    setBulkUploadModalOpen(false);
  };

  const handleStudentsAdded = async (uploadResults) => {
    // Refresh the students list after bulk upload
    console.log('🔄 Refreshing students list after bulk upload...', uploadResults);
    
    // Show loading state
    setLoading(true);
    setToast({
      show: true,
      message: 'Refreshing student list...',
      type: 'info'
    });
    
    try {
      // Wait a moment for database to be fully updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch fresh data
      await fetchStudents();
      
      // Show success message with upload results
      const { addedCount, skippedCount, errorCount } = uploadResults?.summary || {};
      let message = 'Students list refreshed successfully!';
      
      if (addedCount > 0) {
        message += ` ${addedCount} new students added.`;
      }
      if (skippedCount > 0) {
        message += ` ${skippedCount} students skipped (already exist).`;
      }
      if (errorCount > 0) {
        message += ` ${errorCount} students had errors.`;
      }
      
      setToast({
        show: true,
        message,
        type: addedCount > 0 ? 'success' : 'warning'
      });
      
    } catch (error) {
      console.error('Error refreshing students list:', error);
      setToast({
        show: true,
        message: 'Failed to refresh students list. Please try refreshing manually.',
        type: 'error'
      });
    } finally {
      setLoading(false);
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Student Management</h2>
          <p className="text-gray-600">
            Manage students for {classInfo.year} | Semester {classInfo.semester} | Section {classInfo.section}
          </p>
        </div>

        {/* Search and Stats */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search students by name, roll number, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="ml-4 flex space-x-3">
              <button
                onClick={handleBulkUpload}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
              >
                <span className="mr-2">📤</span>
                Bulk Upload
              </button>
              <button
                onClick={fetchStudents}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <span className="mr-2">🔄</span>
                Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-xl">👥</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-xl">✅</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Good Attendance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {students.filter(s => {
                      const stats = getAttendanceStats(s);
                      return stats.percentage >= 75;
                    }).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <span className="text-xl">⚠️</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Average Attendance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {students.filter(s => {
                      const stats = getAttendanceStats(s);
                      return stats.percentage >= 50 && stats.percentage < 75;
                    }).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <span className="text-xl">❌</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Poor Attendance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {students.filter(s => {
                      const stats = getAttendanceStats(s);
                      return stats.percentage < 50;
                    }).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading students...</span>
          </div>
        )}

        {/* No Students */}
        {!loading && students.length === 0 && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Found</h3>
            <p className="text-gray-600">
              No students are enrolled in {classInfo.year} | Semester {classInfo.semester} | Section {classInfo.section}.
            </p>
          </div>
        )}

        {/* Students List */}
        {!loading && students.length > 0 && (
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
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mobile
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance
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
                  {filteredStudents.map((student) => {
                    const stats = getAttendanceStats(student);
                    return (
                      <tr key={student._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {student.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {student.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {student.department}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.rollNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.mobile || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${getAttendanceColor(stats.percentage)}`}>
                                {stats.percentage}%
                              </span>
                              <span className="text-gray-500 text-xs">
                                ({stats.presentCount}/{stats.totalClasses})
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className={`h-2 rounded-full ${
                                  stats.percentage >= 75 ? 'bg-green-500' :
                                  stats.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(stats.percentage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            stats.percentage >= 75 ? 'bg-green-100 text-green-800' :
                            stats.percentage >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {stats.percentage >= 75 ? 'Good' :
                             stats.percentage >= 50 ? 'Average' : 'Poor'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditStudent(student)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                              title="Edit student"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              title="Delete student"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Search Results Info */}
        {searchTerm && filteredStudents.length !== students.length && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Showing {filteredStudents.length} of {students.length} students
            </p>
          </div>
        )}
      </div>

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        student={selectedStudent}
        onStudentUpdated={handleStudentUpdated}
      />

      {/* Delete Student Modal */}
      <DeleteStudentModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        student={selectedStudent}
        onStudentDeleted={handleStudentDeleted}
      />

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={bulkUploadModalOpen}
        onClose={closeBulkUploadModal}
        onStudentsAdded={handleStudentsAdded}
        classInfo={classInfo}
      />
    </>
  );
};

export default StudentManagement;

