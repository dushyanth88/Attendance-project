import { useState, useEffect } from 'react';
import Toast from './Toast';
import FacultyCard from './FacultyCard';
import FacultyFilters from './FacultyFilters';

const FacultyList = ({ refreshTrigger, userRole, department }) => {
  const [faculties, setFaculties] = useState([]);
  const [filteredFaculties, setFilteredFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [filters, setFilters] = useState({
    batch: '',
    year: '',
    section: ''
  });
  const [sortBy, setSortBy] = useState('name');
  const [deletingFaculty, setDeletingFaculty] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [facultyToDelete, setFacultyToDelete] = useState(null);

  const fetchFaculties = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem('accessToken');
      console.log('Fetching faculties with token:', !!accessToken);
      const response = await fetch(`/api/faculty/list?page=${page}&limit=20&search=${search}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setFaculties(data.data.faculties);
        setFilteredFaculties(data.data.faculties);
        setTotalPages(data.data.pagination.pages);
        setCurrentPage(data.data.pagination.current);
      } else {
        setToast({ show: true, message: data.message || 'Failed to fetch faculties', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching faculties:', error);
      setToast({ show: true, message: 'Error loading faculties', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculties(currentPage, searchTerm);
  }, [refreshTrigger]);

  const handleSearch = (search) => {
    setSearchTerm(search);
    setCurrentPage(1);
    fetchFaculties(1, search);
  };

  const handleFilter = (newFilters) => {
    setFilters(newFilters);
    applyFiltersAndSort(faculties, newFilters, sortBy);
  };

  const handleSort = (newSortBy) => {
    setSortBy(newSortBy);
    applyFiltersAndSort(faculties, filters, newSortBy);
  };

  const handleClear = () => {
    setSearchTerm('');
    setFilters({ batch: '', year: '', section: '' });
    setSortBy('name');
    setFilteredFaculties(faculties);
  };

  const applyFiltersAndSort = (facultyList, currentFilters, currentSort) => {
    let filtered = [...facultyList];

    // Apply filters
    if (currentFilters.batch) {
      filtered = filtered.filter(faculty => 
        (faculty.assignedClasses || []).some(cls => cls.batch === currentFilters.batch) ||
        faculty.batch === currentFilters.batch
      );
    }

    if (currentFilters.year) {
      filtered = filtered.filter(faculty => 
        (faculty.assignedClasses || []).some(cls => cls.year === currentFilters.year) ||
        faculty.year === currentFilters.year
      );
    }

    if (currentFilters.section) {
      filtered = filtered.filter(faculty => 
        (faculty.assignedClasses || []).some(cls => cls.section === currentFilters.section) ||
        faculty.section === currentFilters.section
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (currentSort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'assignments':
          return ((b.assignedClasses || []).length) - ((a.assignedClasses || []).length);
        case 'assignments-desc':
          return ((a.assignedClasses || []).length) - ((b.assignedClasses || []).length);
        case 'position':
          return a.position.localeCompare(b.position);
        case 'created':
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return 0;
      }
    });

    setFilteredFaculties(filtered);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchFaculties(page, searchTerm);
  };

  const handleDeleteClick = (facultyId, facultyName) => {
    setFacultyToDelete({ id: facultyId, name: facultyName });
    setShowDeleteConfirm(true);
    setToast({ 
      show: true, 
      message: `Are you sure you want to delete ${facultyName}?`, 
      type: 'warning',
      duration: 0 // Don't auto-hide
    });
  };

  const handleDeleteConfirm = async () => {
    if (!facultyToDelete) return;

    setShowDeleteConfirm(false);
    setDeletingFaculty(facultyToDelete.id);

    // Show loading toast
    setToast({ 
      show: true, 
      message: 'Deleting faculty member...', 
      type: 'info' 
    });

    try {
      const response = await fetch(`/api/faculty/${facultyToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setToast({ 
          show: true, 
          message: '✅ Faculty deleted successfully', 
          type: 'success' 
        });
        fetchFaculties(currentPage, searchTerm);
      } else {
        setToast({ 
          show: true, 
          message: `❌ ${data.message || 'Failed to delete faculty'}`, 
          type: 'error' 
        });
      }
    } catch (error) {
      console.error('Error deleting faculty:', error);
      setToast({ 
        show: true, 
        message: '❌ Error deleting faculty. Please try again.', 
        type: 'error' 
      });
    } finally {
      setDeletingFaculty(null);
      setFacultyToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setFacultyToDelete(null);
    setToast({ 
      show: true, 
      message: 'Faculty deletion cancelled', 
      type: 'info' 
    });
  };

  const handleAssignmentUpdated = () => {
    fetchFaculties(currentPage, searchTerm);
  };

  if (loading && faculties.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}

      {/* Custom Delete Confirmation Toast */}
      {showDeleteConfirm && facultyToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">⚠</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Delete Faculty</h3>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{facultyToDelete.name}</span>? 
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <FacultyFilters
        onSearch={handleSearch}
        onFilter={handleFilter}
        onSort={handleSort}
        onClear={handleClear}
      />

      {/* Faculty Cards */}
      <div className="space-y-4">
        {filteredFaculties.length > 0 ? (
          filteredFaculties.map((faculty) => (
            <FacultyCard
              key={faculty._id}
              faculty={faculty}
              onUpdate={handleAssignmentUpdated}
              onDelete={handleDeleteClick}
            />
          ))
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-500 mb-4">
              {faculties.length === 0 ? 'No faculty members found' : 'No faculty members match your filters'}
        </div>
            {faculties.length === 0 && (
                <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                Refresh
                </button>
            )}
                      </div>
                    )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
          <span className="px-3 py-2 text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
          </div>
        )}
      </div>
  );
};

export default FacultyList;