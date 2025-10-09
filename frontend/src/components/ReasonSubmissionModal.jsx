import { useState } from 'react';
import { apiFetch } from '../utils/apiFetch';

const ReasonSubmissionModal = ({ isOpen, onClose, attendanceRecord, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please enter a reason');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiFetch({
        url: '/api/attendance/reason',
        method: 'PATCH',
        data: {
          studentId: attendanceRecord.studentId,
          date: attendanceRecord.date,
          reason: reason.trim()
        }
      });

      if (response.data.status === 'success') {
        onSuccess(response.data.data);
        onClose();
        setReason('');
      } else {
        setError(response.data.message || 'Failed to submit reason');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit reason');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            📝 Submit Absence Reason
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Date: <span className="font-medium">{attendanceRecord.date}</span>
          </p>
          <p className="text-sm text-gray-600">
            Status: <span className="font-medium text-red-600">Absent</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Absence *
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for your absence (e.g., illness, personal emergency, etc.)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              maxLength={500}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {reason.length}/500 characters
            </p>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Reason'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReasonSubmissionModal;
