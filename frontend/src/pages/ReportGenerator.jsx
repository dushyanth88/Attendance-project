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
        <p className="text-gray-500">No class selected</p>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Report Generator</h2>
          <p className="text-gray-600">
            Generate attendance reports for {classInfo.year} | Semester {classInfo.semester} | Section {classInfo.section}
          </p>
        </div>

        {/* Report Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Report Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type
              </label>
              <div className="space-y-2">
                {reportTypes.map((type) => (
                  <label key={type.id} className="flex items-center">
                    <input
                      type="radio"
                      name="reportType"
                      value={type.id}
                      checked={reportType === type.id}
                      onChange={(e) => setReportType(e.target.value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">{type.label}</div>
                      <div className="text-sm text-gray-500">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Report Results */}
        {reportData && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Report Results</h3>
              <div className="flex space-x-2">
                <button
                  onClick={exportToPDF}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  📄 Export PDF
                </button>
                <button
                  onClick={exportToExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
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

