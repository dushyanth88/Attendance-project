import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';

const ClassSelectionDropdown = ({ onClassSelect, selectedClass, facultyId }) => {
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (facultyId) {
      fetchAssignedClasses();
    }
  }, [facultyId]);

  const fetchAssignedClasses = async () => {
    setLoading(true);
    try {
      const response = await apiFetch({
        url: `/api/class-assignment/faculty/${facultyId}`,
        method: 'GET'
      });

      if (response.data.status === 'success') {
        setAssignedClasses(response.data.data.assignments);
        
        // Auto-select first class if none selected
        if (response.data.data.assignments.length > 0 && !selectedClass) {
          onClassSelect(response.data.data.assignments[0]);
        }
      } else {
        setToast({ show: true, message: 'Failed to load assigned classes', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching assigned classes:', error);
      setToast({ show: true, message: 'Error loading assigned classes', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (e) => {
    const classId = e.target.value;
    if (classId) {
      const selectedClassData = assignedClasses.find(cls => cls._id === classId);
      if (selectedClassData) {
        onClassSelect(selectedClassData);
      }
    } else {
      onClassSelect(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (assignedClasses.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <div className="flex items-center">
          <span className="text-2xl mr-3">⚠️</span>
          <div>
            <h3 className="text-lg font-semibold text-yellow-800">No Class Assignments</h3>
            <p className="text-yellow-700">You are not currently assigned as a class advisor for any section.</p>
            <p className="text-sm text-yellow-600 mt-1">Contact your HOD to get assigned to a class.</p>
          </div>
        </div>
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
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">🎓</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Select Class to Manage</h3>
              <p className="text-sm text-gray-600">Choose a class to manage students and attendance</p>
            </div>
          </div>
          <button
            onClick={fetchAssignedClasses}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choose Class
            </label>
            <select
              value={selectedClass ? selectedClass._id : ''}
              onChange={handleClassChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a class...</option>
              {assignedClasses.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.classDisplay} ({cls.batch})
                </option>
              ))}
            </select>
          </div>
          
          {selectedClass && (
            <div className="flex items-center">
              <div className="bg-blue-50 p-4 rounded-lg w-full">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Selected:</span> {selectedClass.classDisplay}
                </p>
                <p className="text-xs text-blue-600">Batch: {selectedClass.batch}</p>
                <p className="text-xs text-blue-600">Assigned: {new Date(selectedClass.assignedDate).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Assigned Classes Overview */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Your Assigned Classes ({assignedClasses.length})</h4>
          <div className="flex flex-wrap gap-2">
            {assignedClasses.map((cls) => (
              <span
                key={cls._id}
                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                  selectedClass && selectedClass._id === cls._id
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {cls.classDisplay}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ClassSelectionDropdown;

