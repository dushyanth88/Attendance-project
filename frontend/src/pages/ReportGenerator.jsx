import { useState, useEffect } from 'react';
import { useClass } from '../context/ClassContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';

const ReportGenerator = () => {
  const { activeClass, getClassInfo } = useClass();
  const [reportType, setReportType] = useState('summary');
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    endDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const classInfo = getClassInfo();

  const reportTypes = [
    { id: 'summary', label: 'Attendance Summary', description: 'Overall attendance statistics' },
    { id: 'detailed', label: 'Detailed Report', description: 'Student-wise attendance details' },
    { id: 'absentees', label: 'Absentees Report', description: 'List of students with poor attendance' }
  ];

  const generateReport = async () => {
    if (!classInfo) return;
    
    setLoading(true);
    try {
      let url = '';
      let params = {};

      switch (reportType) {
        case 'summary':
          url = '/api/report/attendance-summary';
          params = {
            batch: classInfo.batch,
            year: classInfo.year,
            semester: classInfo.semester,
            section: classInfo.section,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          };
          break;
        case 'detailed':
          url = '/api/report/attendance-detailed';
          params = {
            batch: classInfo.batch,
            year: classInfo.year,
            semester: classInfo.semester,
            section: classInfo.section,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          };
          break;
        case 'absentees':
          url = '/api/report/enhanced-absentees';
          params = {
            batch: classInfo.batch,
            year: classInfo.year,
            semester: classInfo.semester,
            section: classInfo.section,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          };
          break;
        default:
          throw new Error('Invalid report type');
      }

      const response = await apiFetch({
        url: `${url}?${new URLSearchParams(params).toString()}`,
        method: 'GET'
      });

      if (response.data.status === 'success' || response.data.success) {
        setReportData(response.data.data || response.data);
        setToast({ show: true, message: 'Report generated successfully', type: 'success' });
      } else {
        throw new Error(response.data.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setToast({ show: true, message: 'Failed to generate report', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!reportData) return;
    
    try {
      const response = await apiFetch({
        url: '/api/report/export-pdf',
        method: 'POST',
        data: {
          reportType,
          classInfo,
          dateRange,
          reportData
        }
      });

      if (response.data.success) {
        // Create download link
        const blob = new Blob([response.data.pdf], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-report-${classInfo.section}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setToast({ show: true, message: 'PDF exported successfully', type: 'success' });
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setToast({ show: true, message: 'Failed to export PDF', type: 'error' });
    }
  };

  const exportToExcel = async () => {
    if (!reportData) return;
    
    try {
      const response = await apiFetch({
        url: '/api/report/export-excel',
        method: 'POST',
        data: {
          reportType,
          classInfo,
          dateRange,
          reportData
        }
      });

      if (response.data.success) {
        // Create download link
        const blob = new Blob([response.data.excel], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-report-${classInfo.section}-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setToast({ show: true, message: 'Excel file exported successfully', type: 'success' });
      }
    } catch (error) {
      console.error('Error exporting Excel:', error);
      setToast({ show: true, message: 'Failed to export Excel', type: 'error' });
    }
  };

  if (!classInfo) {
    return (
      <div className="p-6 text-center">
        <div className="bg-gradient-to-br from-gray-400 to-gray-500 p-4 rounded-2xl mx-auto w-16 h-16 flex items-center justify-center mb-4">
          <span className="text-3xl">📊</span>
        </div>
        <p className="text-gray-600 font-medium">No class selected</p>
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">📊 Report Generator</h2>
          <p className="text-gray-600">
            Generate attendance reports for {classInfo.year} | Semester {classInfo.semester} | Section {classInfo.section}
          </p>
        </div>

        {/* Report Configuration */}
        <div className="bg-gradient-to-br from-white to-blue-50 border border-blue-100 rounded-2xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Report Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                📋 Report Type
              </label>
              <div className="space-y-3">
                {reportTypes.map((type) => (
                  <label key={type.id} className="flex items-center p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer">
                    <input
                      type="radio"
                      name="reportType"
                      value={type.id}
                      checked={reportType === type.id}
                      onChange={(e) => setReportType(e.target.value)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <div className="ml-3">
                      <div className="text-sm font-semibold text-gray-800">{type.label}</div>
                      <div className="text-sm text-gray-600">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                📅 Date Range
              </label>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">End Date</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="mt-6">
            <button
              onClick={generateReport}
              disabled={loading}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-semibold"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Report Results */}
        {reportData && (
          <div className="bg-gradient-to-br from-white to-green-50 border border-green-100 rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Report Results</h3>
              <div className="flex space-x-3">
                <button
                  onClick={exportToPDF}
                  className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-2 rounded-xl hover:from-red-600 hover:to-pink-700 transition-all duration-200 text-sm shadow-lg font-semibold"
                >
                  📄 Export PDF
                </button>
                <button
                  onClick={exportToExcel}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 text-sm shadow-lg font-semibold"
                >
                  📊 Export Excel
                </button>
              </div>
            </div>

            {/* Report Content */}
            <div className="space-y-4">
              {reportType === 'summary' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">{reportData.totalStudents || 0}</div>
                    <div className="text-sm text-blue-800">Total Students</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">{reportData.totalWorkingDays || 0}</div>
                    <div className="text-sm text-green-800">Working Days</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">{reportData.overallAttendance || 0}%</div>
                    <div className="text-sm text-purple-800">Overall Attendance</div>
                  </div>
                </div>
              )}

              {reportType === 'absentees' && reportData.students && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Absentees Report</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Absent Days</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.students.map((student, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {student.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {student.rollNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {student.totalAbsentDays || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {student.attendancePercentage || 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportType === 'detailed' && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📊</div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Detailed Report Generated</h4>
                  <p className="text-gray-600">Detailed attendance data has been processed and is ready for export.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ReportGenerator;

