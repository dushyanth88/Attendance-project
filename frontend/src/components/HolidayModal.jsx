import { useState } from 'react';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';

const HolidayModal = ({ isOpen, onClose, onSuccess, selectedDate }) => {
  const [formData, setFormData] = useState({
    date: selectedDate || new Date().toISOString().split('T')[0],
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showConfirmation, setShowConfirmation] = useState(false);

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

    // Show confirmation first
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    try {
      const response = await apiFetch({
        url: '/api/holidays',
        method: 'POST',
        data: {
          date: formData.date,
          reason: formData.reason.trim()
        }
      });

      const responseData = response.data;
      if (responseData.status === 'success') {
        setToast({
          show: true,
          message: `Holiday marked successfully for ${formData.date}`,
          type: 'success'
        });
        
        // Reset form
        setFormData({
          date: new Date().toISOString().split('T')[0],
          reason: ''
        });
        
        // Notify parent component
        onSuccess && onSuccess(responseData.data);
        
        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        throw new Error(responseData.message || 'Failed to mark holiday');
      }
    } catch (error) {
      console.error('Mark holiday error:', error);
      setToast({
        show: true,
        message: error.response?.data?.message || error.message || 'Failed to mark holiday',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        date: selectedDate || new Date().toISOString().split('T')[0],
        reason: ''
      });
      setShowConfirmation(false);
      onClose();
    }
  };

  if (!isOpen) return null;

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
              <span className="text-2xl mr-3">🎉</span>
              <h3 className="text-lg font-semibold text-gray-900">Mark as Holiday</h3>
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

          {/* Content */}
          <div className="p-6">
            {!showConfirmation ? (
              /* Form */
              <form onSubmit={handleSubmit}>
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

                  {/* Info Box */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-amber-700">
                        <p className="font-medium">Holiday Information:</p>
                        <ul className="mt-1 space-y-1 text-xs">
                          <li>• No attendance will be required on this date</li>
                          <li>• Day will be excluded from working days count</li>
                          <li>• Students will see this as a holiday in their calendar</li>
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
                    Continue
                  </button>
                </div>
              </form>
            ) : (
              /* Confirmation */
              <div>
                <div className="text-center mb-6">
                  <div className="text-4xl mb-4">🎉</div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Confirm Holiday Marking</h4>
                  <p className="text-gray-600">
                    Do you want to mark <span className="font-semibold text-amber-600">{formData.date}</span> as a holiday?
                  </p>
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <span className="font-medium">Reason:</span> {formData.reason}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowConfirmation(false)}
                    disabled={loading}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSubmit}
                    disabled={loading}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Marking...
                      </>
                    ) : (
                      'Yes, Mark as Holiday'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
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

export default HolidayModal;
