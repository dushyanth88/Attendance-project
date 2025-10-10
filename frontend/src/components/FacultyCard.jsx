import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';
import ClassAssignmentModal from './ClassAssignmentModal';

const FacultyCard = ({ faculty, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [assignments, setAssignments] = useState(faculty.assignedClasses || []);
  const [loading, setLoading] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState(null);

  // Fetch detailed assignments when card is expanded
  useEffect(() => {
    if (expanded && faculty._id) {
      fetchAssignments();
    }
  }, [expanded, faculty._id]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const response = await apiFetch({
        url: `/api/faculty/${faculty._id}/assignments`,
        method: 'GET'
      });

      if (response.data.status === 'success') {
        // Use classAssignments if available, otherwise fall back to assignments
        const assignments = response.data.data.classAssignments || response.data.data.assignments || [];
        console.log('📋 Faculty assignments loaded:', {
          facultyId: faculty._id,
          classAssignments: response.data.data.classAssignments?.length || 0,
          assignments: response.data.data.assignments?.length || 0,
          total: assignments.length
        });
        setAssignments(assignments);
      } else {
        setToast({ show: true, message: 'Failed to load assignments', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setToast({ show: true, message: 'Error loading assignments', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignmentClick = (assignment) => {
    setAssignmentToRemove(assignment);
    setShowRemoveConfirm(true);
  };

  const handleRemoveConfirm = async () => {
    if (!assignmentToRemove) return;

    setShowRemoveConfirm(false);
    setLoading(true);

    console.log('🗑️ Removing assignment:', {
      assignmentId: assignmentToRemove._id,
      facultyId: faculty._id,
      assignment: assignmentToRemove
    });

    try {
      const response = await apiFetch({
        url: `/api/class-assignment/${assignmentToRemove._id}`,
        method: 'DELETE'
      });

      if (response.data.status === 'success') {
        setToast({ show: true, message: 'Class assignment removed successfully', type: 'success' });
        fetchAssignments(); // Refresh assignments
        onUpdate(); // Notify parent to refresh faculty list
      } else {
        setToast({ show: true, message: response.data.message || 'Failed to remove assignment', type: 'error' });
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove assignment';
      setToast({ show: true, message: `Error: ${errorMessage}`, type: 'error' });
    } finally {
      setLoading(false);
      setAssignmentToRemove(null);
    }
  };

  const handleRemoveCancel = () => {
    setShowRemoveConfirm(false);
    setAssignmentToRemove(null);
  };

  const handleAssignmentUpdated = () => {
    fetchAssignments();
    onUpdate();
  };

  const getStatusColor = (assignmentCount) => {
    if (assignmentCount === 0) return 'bg-red-100 text-red-800';
    if (assignmentCount === 1) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = (assignmentCount) => {
    if (assignmentCount === 0) return 'Unassigned';
    if (assignmentCount === 1) return 'Active Class Advisor';
    return 'Multiple Assignments';
  };

  const formatClassDisplay = (assignment) => {
    return `${assignment.batch} | ${assignment.year} | Sem ${assignment.semester} | Section ${assignment.section}`;
  };

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}

      <div className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
        {/* Faculty Header */}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{faculty.name}</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignments.length)}`}>
                  {getStatusText(assignments.length)}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                <div className="flex items-center">
                  <span className="font-medium mr-2">Position:</span>
                  <span>{faculty.position}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium mr-2">Email:</span>
                  <span className="text-blue-600">{faculty.email}</span>
                </div>
                {faculty.phone && (
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Phone:</span>
                    <span>{faculty.phone}</span>
                  </div>
                )}
                <div className="flex items-center">
                  <span className="font-medium mr-2">Department:</span>
                  <span>{faculty.department}</span>
                </div>
              </div>

              <div className="flex items-center text-sm text-gray-600">
                <span className="font-medium mr-2">Assigned Classes:</span>
                <span className="font-semibold text-blue-600">{assignments.length}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-2 ml-4">
              <button
                onClick={() => setExpanded(!expanded)}
                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                {expanded ? 'Hide Details' : 'View Assignments'}
              </button>
              <button
                onClick={() => setShowAssignmentModal(true)}
                className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
              >
                Assign Class
              </button>
              <button
                onClick={() => onDelete(faculty._id, faculty.name)}
                disabled={loading}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  loading 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {loading ? 'Deleting...' : 'Delete Faculty'}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Class Assignments */}
        {expanded && (
          <div className="border-t border-gray-200 bg-gray-50">
            <div className="p-6">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Assigned Classes</h4>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading assignments...</span>
                </div>
              ) : assignments.length > 0 ? (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment._id}
                      className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {formatClassDisplay(assignment)}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Assigned on {new Date(assignment.assignedDate).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleRemoveAssignmentClick(assignment)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-2">No class assignments found</div>
                  <button
                    onClick={() => setShowAssignmentModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Assign First Class
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Class Assignment Modal */}
      {showAssignmentModal && (
        <ClassAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          faculty={faculty}
          onAssignmentUpdated={handleAssignmentUpdated}
        />
      )}

      {/* Remove Assignment Confirmation Modal */}
      {showRemoveConfirm && assignmentToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">⚠</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Remove Class Assignment</h3>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-500">
                Are you sure you want to remove the class assignment for{' '}
                <span className="font-semibold text-gray-900">
                  {assignmentToRemove.batch} | {assignmentToRemove.year} | Sem {assignmentToRemove.semester} | Section {assignmentToRemove.section}
                </span>?
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleRemoveCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FacultyCard;
