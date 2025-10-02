import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';

const ReportGeneration = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form state
  const [selectedClass, setSelectedClass] = useState('');
  const [reportType, setReportType] = useState('single'); // 'single' or 'range'
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Report data state
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Edit reason state
  const [editingReasonId, setEditingReasonId] = useState(null);
  const [editReasonValue, setEditReasonValue] = useState('');
  const [reasonLoading, setReasonLoading] = useState(false);

  const classOptions = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'];

  useEffect(() => {
    // Set default class to user's assigned class
    if (user?.assignedClass) {
      setSelectedClass(user.assignedClass);
    }
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, [user]);

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      params.append('class_id', selectedClass);

      if (reportType === 'single') {
        if (!selectedDate) {
          setError('Please select a date');
          return;
        }
        params.append('date', selectedDate);
      } else {
        if (!startDate || !endDate) {
          setError('Please select both start and end dates');
          return;
        }
        if (new Date(startDate) > new Date(endDate)) {
          setError('Start date cannot be after end date');
          return;
        }
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

      const response = await apiFetch({
        url: `/api/report/absentees?${params.toString()}`
      });

      // Debug logging (can be removed in production)
      console.log('📊 Report generated:', {
        class: response.data.data?.class,
        attendanceMarked: response.data.data?.attendanceMarked,
        totalAbsentees: response.data.data?.totalAbsentees
      });

      setReportData(response.data.data);
      
      const absentees = response.data.data?.absentees || [];
      const attendanceMarked = response.data.data?.attendanceMarked;
      const message = response.data.data?.message;

      // Handle different cases with appropriate toast notifications
      if (!attendanceMarked) {
        // Case 3: No attendance marked for this date
        setToast({
          show: true,
          message: message || 'Attendance not taken for this date.',
          type: 'warning'
        });
      } else if (absentees.length === 0) {
        // Case 2: Attendance exists but no absentees (all present)
        setToast({
          show: true,
          message: message || 'All students were present on this date.',
          type: 'success'
        });
      } else {
        // Case 1: Attendance exists and absentees found
        setToast({
          show: true,
          message: `Absentees report generated successfully. Found ${response.data.data?.totalAbsentees || absentees.length} absentees.`,
          type: 'success'
        });
      }

    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.response?.data?.message || 'Failed to generate report');
      setToast({
        show: true,
        message: err.response?.data?.message || 'Failed to generate report',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditReason = (absenteeId, currentReason) => {
    if (!absenteeId) return;
    setEditingReasonId(absenteeId);
    setEditReasonValue(currentReason || '');
  };

  const handleSaveReason = async (absenteeId) => {
    if (!absenteeId) return;
    
    try {
      setReasonLoading(true);
      
      await apiFetch({
        url: `/api/attendance/${absenteeId}/reason`,
        method: 'PUT',
        data: { reason: editReasonValue }
      });

      // Update the local report data
      setReportData(prev => ({
        ...prev,
        absentees: (prev?.absentees || []).map(absentee =>
          absentee?.id === absenteeId
            ? { ...absentee, reason: editReasonValue }
            : absentee
        )
      }));

      setEditingReasonId(null);
      setEditReasonValue('');
      
      setToast({
        show: true,
        message: 'Reason updated successfully.',
        type: 'success'
      });

    } catch (err) {
      console.error('Error updating reason:', err);
      setToast({
        show: true,
        message: err.response?.data?.message || 'Failed to update reason.',
        type: 'error'
      });
    } finally {
      setReasonLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingReasonId(null);
    setEditReasonValue('');
  };

  const handleDownloadPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.append('class_id', selectedClass);

      if (reportType === 'single') {
        params.append('date', selectedDate);
      } else {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

      // Get the auth token
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:5000/api/report/absentees/export/pdf?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF download error:', response.status, errorText);
        throw new Error(`Failed to download PDF: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `absentees-report-${selectedClass}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setToast({
        show: true,
        message: 'PDF downloaded successfully.',
        type: 'success'
      });

    } catch (err) {
      console.error('Error downloading PDF:', err);
      setToast({
        show: true,
        message: err.message || 'Failed to download PDF.',
        type: 'error'
      });
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.append('class_id', selectedClass);

      if (reportType === 'single') {
        params.append('date', selectedDate);
      } else {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

      // Get the auth token
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

      const response = await fetch(`http://localhost:5000/api/report/absentees/export/excel?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Excel download error:', response.status, errorText);
        throw new Error(`Failed to download Excel: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `absentees-report-${selectedClass}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setToast({
        show: true,
        message: 'Excel file downloaded successfully.',
        type: 'success'
      });

    } catch (err) {
      console.error('Error downloading Excel:', err);
      setToast({
        show: true,
        message: err.message || 'Failed to download Excel file.',
        type: 'error'
      });
    }
  };

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="mr-4 text-gray-600 hover:text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📝 Report Generation</h1>
              <p className="text-gray-600 text-sm">Generate absentees reports with reasons</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Filters</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Class Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Class</option>
                {classOptions.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="single">Single Date</option>
                <option value="range">Date Range</option>
              </select>
            </div>

            {/* Date Selection */}
            {reportType === 'single' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </>
            )}
          </div>

          {/* Generate Report Button */}
          <div className="flex justify-center">
            <button
              onClick={handleGenerateReport}
              disabled={loading || !selectedClass}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Report Results */}
        {reportData && (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Absentees Report – {reportData?.class || 'Unknown Class'}
                </h3>
                <p className="text-gray-600 text-sm">
                  {reportData?.dateRange?.date 
                    ? `Date: ${reportData.dateRange.date}`
                    : `Date Range: ${reportData?.dateRange?.startDate || 'N/A'} to ${reportData?.dateRange?.endDate || 'N/A'}`
                  }
                </p>
                <p className="text-gray-600 text-sm">
                  Total Absentees: {reportData?.totalAbsentees || 0}
                </p>
                {reportData?.attendanceMarked && reportData?.totalAttendanceRecords && (
                  <p className="text-gray-600 text-sm">
                    Total Records: {reportData.totalAttendanceRecords}
                  </p>
                )}
              </div>

              {/* Export Buttons */}
              {reportData?.absentees?.length > 0 && reportData?.attendanceMarked && (
                <div className="flex space-x-3">
                  <button
                    onClick={handleDownloadPDF}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    📄 Download PDF
                  </button>
                  <button
                    onClick={handleDownloadExcel}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    📊 Download Excel
                  </button>
                </div>
              )}
            </div>

            {/* Absentees Table */}
            {!reportData?.absentees || reportData.absentees.length === 0 ? (
              <div className="text-center py-8">
                {!reportData?.attendanceMarked ? (
                  // Case 3: No attendance marked
                  <>
                    <div className="text-yellow-500 text-lg mb-2">⚠️ Attendance not taken</div>
                    <p className="text-gray-600">Attendance has not been marked for this date.</p>
                  </>
                ) : (
                  // Case 2: All students present
                  <>
                    <div className="text-green-500 text-lg mb-2">✅ All students present</div>
                    <p className="text-gray-600">All students were present on this date.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roll No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(reportData?.absentees || []).map((absentee) => (
                      <tr key={absentee?.id || Math.random()} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {absentee?.rollNo || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {absentee?.studentName || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {absentee?.date || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            {absentee?.status || 'Absent'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                          {editingReasonId === absentee?.id ? (
                            <textarea
                              value={editReasonValue}
                              onChange={(e) => setEditReasonValue(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              rows="2"
                              placeholder="Enter reason for absence..."
                              maxLength="500"
                            />
                          ) : (
                            <span className="break-words">
                              {absentee?.reason || 'No reason provided'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {editingReasonId === absentee?.id ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleSaveReason(absentee?.id)}
                                disabled={reasonLoading}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              >
                                {reasonLoading ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={reasonLoading}
                                className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditReason(absentee?.id, absentee?.reason)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit Reason
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ReportGeneration;
