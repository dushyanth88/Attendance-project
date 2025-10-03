import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import EditHolidayModal from './EditHolidayModal';
import Toast from './Toast';

const HolidayManagement = ({ isOpen, onClose }) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Fetch holidays when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchHolidays();
    }
  }, [isOpen]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const response = await apiFetch({
        url: '/api/holidays',
        method: 'GET'
      });

      const responseData = response.data;
      if (responseData.status === 'success') {
        setHolidays(responseData.data);
      } else {
        throw new Error(responseData.message || 'Failed to fetch holidays');
      }
    } catch (error) {
      console.error('Fetch holidays error:', error);
      setToast({
        show: true,
        message: error.response?.data?.message || error.message || 'Failed to fetch holidays',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditHoliday = (holiday) => {
    setEditingHoliday(holiday);
    setShowEditModal(true);
  };

  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      const response = await apiFetch({
        url: `/api/holidays/${holidayId}`,
        method: 'DELETE'
      });

      const responseData = response.data;
      if (responseData.status === 'success') {
        setToast({
          show: true,
          message: 'Holiday deleted successfully',
          type: 'success'
        });
        // Refresh the holidays list
        fetchHolidays();
      } else {
        throw new Error(responseData.message || 'Failed to delete holiday');
      }
    } catch (error) {
      console.error('Delete holiday error:', error);
      setToast({
        show: true,
        message: error.response?.data?.message || error.message || 'Failed to delete holiday',
        type: 'error'
      });
    }
  };

  const handleEditSuccess = (updatedHoliday) => {
    setToast({
      show: true,
      message: 'Holiday updated successfully',
      type: 'success'
    });
    // Refresh the holidays list
    fetchHolidays();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🎉</span>
              <h3 className="text-lg font-semibold text-gray-900">Holiday Management</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                <span className="ml-2 text-gray-600">Loading holidays...</span>
              </div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 text-lg mb-2">📅</div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">No Holidays Found</h4>
                <p className="text-gray-600">No holidays have been declared yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Holidays List */}
                <div className="space-y-3">
                  {holidays.map((holiday) => (
                    <div
                      key={holiday.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className="text-amber-500 text-lg mr-2">🎉</span>
                            <h4 className="font-semibold text-gray-900">
                              {formatDate(holiday.date)}
                            </h4>
                          </div>
                          <p className="text-gray-700 mb-2">{holiday.reason}</p>
                          <div className="text-sm text-gray-500">
                            <p>Created by: {holiday.createdBy}</p>
                            {holiday.updatedBy && (
                              <p>Last updated by: {holiday.updatedBy}</p>
                            )}
                            <p>
                              Created: {new Date(holiday.createdAt).toLocaleDateString()}
                              {holiday.updatedAt && (
                                <span className="ml-2">
                                  | Updated: {new Date(holiday.updatedAt).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleEditHoliday(holiday)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit holiday"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteHoliday(holiday.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete holiday"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
                  <div className="flex items-center">
                    <span className="text-amber-500 text-lg mr-2">📊</span>
                    <h4 className="font-semibold text-amber-800">Summary</h4>
                  </div>
                  <p className="text-amber-700 text-sm mt-1">
                    Total holidays declared: {holidays.length}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Holiday Modal */}
      <EditHolidayModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingHoliday(null);
        }}
        onSuccess={handleEditSuccess}
        holidayData={editingHoliday}
      />

      {/* Toast */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}
    </>
  );
};

export default HolidayManagement;
