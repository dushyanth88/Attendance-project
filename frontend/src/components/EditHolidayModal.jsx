import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';

const EditHolidayModal = ({ isOpen, onClose, onSuccess, holidayData }) => {
  const [formData, setFormData] = useState({
    date: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && holidayData) {
      setFormData({
        date: holidayData.date,
        reason: holidayData.reason
      });
    }
  }, [isOpen, holidayData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.reason.trim()) {
      setToast({
        show: true,
        message: 'Please enter a reason for the holiday',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch({
        url: `/api/holidays/${holidayData.id}`,
        method: 'PUT',
        data: {
          date: formData.date,
          reason: formData.reason.trim()
        }
      });

      const responseData = response.data;
      if (responseData.status === 'success') {
        setToast({
          show: true,
          message: 'Holiday updated successfully',
          type: 'success'
        });
        
        // Notify parent component
        onSuccess && onSuccess(responseData.data);
        
        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error(responseData.message || 'Failed to update holiday');
      }
    } catch (error) {
      console.error('Update holiday error:', error);
      setToast({
        show: true,
        message: error.response?.data?.message || error.message || 'Failed to update holiday',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ date: '', reason: '' });
      onClose();
    }
  };

  if (!isOpen || !holidayData) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleClose}></div>
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <span className="text-2xl mr-3">✏️</span>
              <h3 className="text-lg font-semibold text-gray-900">Edit Holiday</h3>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              {/* Date Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Holiday Date *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {/* Reason Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Holiday *
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  placeholder="e.g., Diwali Festival, National Holiday, College Event"
                  required
                  rows={3}
                  maxLength={255}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.reason.length}/255 characters
                </p>
              </div>

              {/* Original Holiday Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">Original Holiday:</p>
                  <p><span className="font-medium">Date:</span> {holidayData.date}</p>
                  <p><span className="font-medium">Reason:</span> {holidayData.reason}</p>
                  {holidayData.createdBy && (
                    <p><span className="font-medium">Created by:</span> {holidayData.createdBy}</p>
                  )}
                  {holidayData.updatedBy && (
                    <p><span className="font-medium">Last updated by:</span> {holidayData.updatedBy}</p>
                  )}
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-amber-700">
                    <p className="font-medium">Update Information:</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• Changes will be reflected across all dashboards</li>
                      <li>• Attendance calculations will be updated</li>
                      <li>• Date must be unique within your department</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.reason.trim()}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

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

export default EditHolidayModal;
