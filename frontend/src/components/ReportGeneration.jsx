import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';

const ReportGeneration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const facultyProfile = location.state?.facultyProfile;

  // Form state
  const [filters, setFilters] = useState({
    batch: '',
    year: '',
    semester: '',
    section: '',
    reportType: 'single', // single, range, cumulative
    date: new Date().toISOString().split('T')[0],
    startDate: '',
    endDate: ''
  });

  // Report data state
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Edit reason state
  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({ reason: '', actionTaken: '' });

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    
    // Pre-fill form with faculty profile data if available
    if (facultyProfile) {
      setFilters(prev => ({
        ...prev,
        batch: facultyProfile.batch || '',
        year: facultyProfile.year || '',
        semester: facultyProfile.semester || '',
        section: facultyProfile.section || '',
        date: today
      }));
      setInitialLoading(false);
    } else {
      // If no faculty profile passed, try to fetch it
      const fetchFacultyProfile = async () => {
        try {
          const response = await apiFetch({
            url: '/api/faculty/profile',
            method: 'GET'
          });
          
          // apiFetch returns the full axios response, so data is in response.data
          const responseData = response.data;
          
          if (responseData.status === 'success' && responseData.data) {
            const profile = responseData.data;
            setFilters(prev => ({
              ...prev,
              batch: profile.batch || '',
              year: profile.year || '',
              semester: profile.semester || '',
              section: profile.section || '',
              date: today
            }));
          }
        } catch (error) {
          console.log('Could not fetch faculty profile:', error);
          // Just set the date if we can't fetch profile
          setFilters(prev => ({
            ...prev,
            date: today
          }));
        } finally {
          setInitialLoading(false);
        }
      };
      
      fetchFacultyProfile();
    }
  }, [facultyProfile]);

  // Scroll to top when data loads
  useEffect(() => {
    if (!loading && reportData) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loading, reportData]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerateReport = async () => {
    if (!filters.batch || !filters.year || !filters.semester) {
      setError('Please fill in all required fields (Batch, Year, Semester)');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        batch: filters.batch,
        year: filters.year,
        semester: filters.semester
      });

      if (filters.section) params.append('section', filters.section);

      if (filters.reportType === 'single' && filters.date) {
        params.append('date', filters.date);
      } else if (filters.reportType === 'range' && filters.startDate && filters.endDate) {
        params.append('startDate', filters.startDate);
        params.append('endDate', filters.endDate);
      }

      console.log('📊 Sending report request with params:', {
        batch: filters.batch,
        year: filters.year,
        semester: filters.semester,
        section: filters.section,
        reportType: filters.reportType,
        date: filters.date,
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      const response = await apiFetch({
        url: `/api/report/enhanced-absentees?${params.toString()}`,
        method: 'GET'
      });

      console.log('📊 Report response:', response);

      // apiFetch returns the full axios response, so data is in response.data
      const responseData = response.data;

      if (responseData.status === 'success') {
        console.log('📊 Report data received:', responseData.data);
        setReportData(responseData.data);
        setToast({
          show: true,
          message: 'Enhanced report generated successfully',
          type: 'success'
        });
      } else {
        setError(responseData.message || 'Failed to generate report');
        setToast({
          show: true,
          message: responseData.message || 'Failed to generate report',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Generate report error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      const errorMessage = error.response?.data?.message || error.message || 'Failed to generate report. Please try again.';
      setError(errorMessage);
      setToast({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (row) => {
    setEditingRow(row.sNo);
    setEditData({
      reason: row.reason || '',
      actionTaken: row.actionTaken || ''
    });
  };

  const handleEditSave = async (studentId) => {
    try {
      console.log('💾 Saving absence details:', {
        studentId,
        reason: editData.reason,
        actionTaken: editData.actionTaken
      });

      const response = await apiFetch({
        url: '/api/report/update-absence-details',
        method: 'PUT',
        data: {
          studentId,
          reason: editData.reason,
          actionTaken: editData.actionTaken
        }
      });

      // apiFetch returns the full axios response, so data is in response.data
      const responseData = response.data;

      if (responseData.status === 'success') {
        // Update the report data
      setReportData(prev => ({
        ...prev,
          reportData: prev.reportData.map(row => 
            row.regNo === responseData.data.rollNumber 
              ? { ...row, reason: editData.reason, actionTaken: editData.actionTaken }
              : row
        )
      }));
        setEditingRow(null);
      setToast({
        show: true,
          message: 'Details updated successfully',
        type: 'success'
      });
      } else {
        setToast({
        show: true,
          message: responseData.message || 'Failed to update details',
        type: 'error'
      });
      }
    } catch (error) {
      console.error('Update details error:', error);
      setToast({
        show: true,
        message: 'Failed to update details. Please try again.',
        type: 'error'
      });
    }
  };

  const handleEditCancel = () => {
    setEditingRow(null);
    setEditData({ reason: '', actionTaken: '' });
  };

  const exportReport = async (format) => {
    if (!reportData) {
      setToast({
        show: true,
        message: 'Please generate a report first',
        type: 'error'
      });
      return;
    }

    try {
      const params = new URLSearchParams({
        batch: filters.batch,
        year: filters.year,
        semester: filters.semester
      });

      if (filters.section) params.append('section', filters.section);
      if (filters.reportType === 'single' && filters.date) {
        params.append('date', filters.date);
      } else if (filters.reportType === 'range' && filters.startDate && filters.endDate) {
        params.append('startDate', filters.startDate);
        params.append('endDate', filters.endDate);
      }

      console.log('📤 Exporting report:', {
        format,
        params: params.toString(),
        url: `/api/report/enhanced-absentees/export/${format}?${params.toString()}`
      });

      const response = await fetch(`/api/report/enhanced-absentees/export/${format}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      console.log('📤 Export response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });

      if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
        a.download = `enhanced-absentees-report-${filters.batch}-${filters.year}-Sem${filters.semester}${filters.section ? `-${filters.section}` : ''}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setToast({
        show: true,
          message: `${format.toUpperCase()} report exported successfully`,
        type: 'success'
      });
      } else {
        const errorText = await response.text();
        console.error('Export error response:', errorText);
        setToast({
        show: true,
          message: `Failed to export ${format.toUpperCase()} report: ${response.status} ${response.statusText}`,
        type: 'error'
      });
      }
    } catch (error) {
      console.error('Export error:', error);
      setToast({
        show: true,
        message: `Failed to export ${format.toUpperCase()} report. Please try again.`,
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

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="mr-4 text-gray-600 hover:text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📝 Enhanced Report Generation</h1>
              <p className="text-gray-600 text-sm">Generate detailed absentees reports with cumulative data</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {initialLoading ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading faculty profile...</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filters Panel */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Report Filters</h3>
            {facultyProfile && (
              <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                ✓ Pre-filled with your assigned class
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Batch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Batch *
              </label>
              <input
                type="text"
                value={filters.batch}
                onChange={(e) => handleFilterChange('batch', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="2021-2025"
                required
              />
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year *
              </label>
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Year</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            {/* Semester */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Semester *
              </label>
              <select
                value={filters.semester}
                onChange={(e) => handleFilterChange('semester', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section
              </label>
              <select
                value={filters.section}
                onChange={(e) => handleFilterChange('section', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Sections</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
            </div>
          </div>

          {/* Report Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="single"
                  checked={filters.reportType === 'single'}
                  onChange={(e) => handleFilterChange('reportType', e.target.value)}
                  className="mr-2"
                />
                Single Date
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="range"
                  checked={filters.reportType === 'range'}
                  onChange={(e) => handleFilterChange('reportType', e.target.value)}
                  className="mr-2"
                />
                Date Range
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="cumulative"
                  checked={filters.reportType === 'cumulative'}
                  onChange={(e) => handleFilterChange('reportType', e.target.value)}
                  className="mr-2"
                />
                Cumulative
              </label>
            </div>
            </div>

            {/* Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {filters.reportType === 'single' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => handleFilterChange('date', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}
            {filters.reportType === 'range' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
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
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
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
              disabled={loading || !filters.batch || !filters.year || !filters.semester}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Generating...' : 'Generate Enhanced Report'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Report Results */}
        {reportData && reportData.reportData && reportData.reportData.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Enhanced Absentees Report
                </h3>
                <p className="text-gray-600 text-sm">
                  Class: {reportData.classInfo.batch}, {reportData.classInfo.year}, Sem {reportData.classInfo.semester}
                  {reportData.classInfo.section !== 'All Sections' && `, Section ${reportData.classInfo.section}`}
                </p>
                <p className="text-gray-600 text-sm">
                  Generated on: {new Date(reportData.generatedAt).toLocaleString()}
                </p>
              </div>

              {/* Export Buttons */}
              {reportData.reportData && reportData.reportData.length > 0 && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportReport('pdf')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    📄 Export PDF
                  </button>
                  <button
                    onClick={() => exportReport('excel')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    📊 Export Excel
                  </button>
                </div>
              )}
            </div>

            {/* Report Table */}
            {!reportData.reportData || reportData.reportData.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-yellow-500 text-lg mb-2">⚠️ No absentees found</div>
                <p className="text-gray-600">{reportData.message || 'No absentees found for the selected period.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        S.No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Year (Batch/Year/Semester)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reg No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Absent Days
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action Taken
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.reportData.map((row) => (
                      <tr key={row.sNo} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.sNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.regNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.studentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.phoneNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {row.totalAbsentDays}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {editingRow === row.sNo ? (
                            <input
                              type="text"
                              value={editData.reason}
                              onChange={(e) => setEditData(prev => ({ ...prev, reason: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Enter reason"
                            />
                          ) : (
                            <span className="max-w-xs truncate block">
                              {row.reason || 'No reason provided'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {editingRow === row.sNo ? (
                            <input
                              type="text"
                              value={editData.actionTaken}
                              onChange={(e) => setEditData(prev => ({ ...prev, actionTaken: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Enter action taken"
                            />
                          ) : (
                            <span className="max-w-xs truncate block">
                              {row.actionTaken || 'No action taken'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {editingRow === row.sNo ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditSave(row.studentId)}
                                className="text-green-600 hover:text-green-900 text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleEditCancel}
                                className="text-gray-600 hover:text-gray-900 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditStart(row)}
                              className="text-indigo-600 hover:text-indigo-900 text-xs"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            <div className="bg-gray-50 px-6 py-4 border-t mt-6">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Total Absentees:</span> {reportData.totalAbsentees} | 
                  <span className="font-medium ml-2">Total Students:</span> {reportData.totalStudents} |
                  <span className="font-medium ml-2">Working Days:</span> {reportData.totalWorkingDays || 0}
                  {reportData.holidays && reportData.holidays.length > 0 && (
                    <span className="ml-2 text-yellow-600">
                      🎉 {reportData.holidays.length} Holiday{reportData.holidays.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  Generated by: {reportData.generatedBy}
                </div>
              </div>
            </div>

            {/* Holidays Section */}
            {reportData.holidays && reportData.holidays.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <h4 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center">
                  <span className="text-lg mr-2">🎉</span>
                  Holidays in Report Period
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {reportData.holidays.map((holiday, index) => (
                    <div key={index} className="text-sm text-yellow-700">
                      <span className="font-medium">{holiday.date}:</span> {holiday.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : reportData && reportData.reportData && reportData.reportData.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="text-center py-8">
              <div className="text-gray-500 text-lg mb-2">📊</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Absentees Found</h3>
              <p className="text-gray-600">
                {reportData.message || 'No students were absent for the selected date/class.'}
              </p>
              <div className="mt-4 text-sm text-gray-500">
                <p>Total Students: {reportData.totalStudents || 0}</p>
                <p>Attendance Status: {reportData.attendanceMarked ? '✅ Marked' : '❌ Not Marked'}</p>
              </div>
            </div>
          </div>
        ) : null}
          </>
        )}
      </main>
    </div>
  );
};

export default ReportGeneration;

  