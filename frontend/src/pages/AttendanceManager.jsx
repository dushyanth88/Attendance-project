import { useState, useEffect } from 'react';
import { useClass } from '../context/ClassContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';

const AttendanceManager = () => {
  const { activeClass, getClassInfo } = useClass();
  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    absentees: ''
  });
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const classInfo = getClassInfo();

  useEffect(() => {
    if (classInfo) {
      fetchStudents();
      checkHolidayStatus(attendanceForm.date);
      checkAttendanceStatus(attendanceForm.date);
    }
  }, [classInfo, attendanceForm.date]);

  const fetchStudents = async () => {
    if (!classInfo) return;
    
    try {
      const response = await apiFetch({
        url: `/api/students?batch=${encodeURIComponent(classInfo.batch)}&year=${encodeURIComponent(classInfo.year)}&semester=${encodeURIComponent(classInfo.semester)}&section=${encodeURIComponent(classInfo.section)}`,
        method: 'GET'
      });

      if (response.data.success) {
        setStudents(response.data.data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setToast({ show: true, message: 'Failed to load students', type: 'error' });
    }
  };

  const checkHolidayStatus = async (date) => {
    try {
      const response = await apiFetch({
        url: `/api/holidays/check/${date}`,
        method: 'GET'
      });
      
      if (response.data?.data?.isHoliday) {
        setIsHoliday(true);
        setHolidayReason(response.data.data.holiday.reason);
      } else {
        setIsHoliday(false);
        setHolidayReason('');
      }
    } catch (error) {
      console.error('Error checking holiday status:', error);
      setIsHoliday(false);
      setHolidayReason('');
    }
  };

  const checkAttendanceStatus = async (date) => {
    if (!classInfo) return;
    
    try {
      const url = `/api/attendance/history-by-class?batch=${encodeURIComponent(classInfo.batch)}&year=${encodeURIComponent(classInfo.year)}&semester=${encodeURIComponent(classInfo.semester)}&date=${encodeURIComponent(date)}&section=${encodeURIComponent(classInfo.section)}`;
      const response = await apiFetch({ url });
      
      if (response.data?.status === 'success' && response.data?.data?.records) {
        const hasMarkedStudents = response.data.data.records.some(record => 
          record.status === 'Present' || record.status === 'Absent'
        );
        setAttendanceMarked(hasMarkedStudents);
      } else {
        setAttendanceMarked(false);
      }
    } catch (error) {
      console.error('Error checking attendance status:', error);
      setAttendanceMarked(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAttendanceForm(prev => ({ ...prev, [name]: value }));
    
    if (name === 'date') {
      checkHolidayStatus(value);
      checkAttendanceStatus(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!classInfo) return;
    
    if (attendanceMarked) {
      setToast({ 
        show: true, 
        message: 'Attendance already marked for this date. Use edit function to modify.', 
        type: 'warning' 
      });
      return;
    }

    if (isHoliday) {
      setToast({ 
        show: true, 
        message: 'Cannot mark attendance on a holiday.', 
        type: 'error' 
      });
      return;
    }

    setLoading(true);
    try {
      // Parse absent roll numbers
      const absentRollNumbers = (attendanceForm.absentees || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Get IST date
      const today = new Date();
      const istDate = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
      const istDateString = istDate.toISOString().split('T')[0];

      const response = await apiFetch({
        url: '/api/attendance/mark-students',
        method: 'POST',
        data: {
          facultyId: classInfo.facultyId,
          batch: classInfo.batch,
          year: classInfo.year,
          semester: classInfo.semester,
          section: classInfo.section,
          date: istDateString,
          absentRollNumbers
        }
      });

      if (response.data.status === 'success') {
        const classDisplay = `${classInfo.year} | Semester ${classInfo.semester} | Section ${classInfo.section}`;
        setToast({ 
          show: true, 
          message: `✅ Attendance marked successfully for ${classDisplay}. ${response.data.data?.presentCount || 0} present, ${response.data.data?.absentCount || 0} absent.`, 
          type: 'success' 
        });
        
        // Clear form and mark as attended
        setAttendanceForm(prev => ({ ...prev, absentees: '' }));
        setAttendanceMarked(true);
      } else {
        throw new Error(response.data.message || 'Failed to mark attendance');
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to mark attendance';
      setToast({ show: true, message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Mark Attendance</h2>
          <p className="text-gray-600">
            Mark daily attendance for {classInfo.year} | Semester {classInfo.semester} | Section {classInfo.section}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date and Class Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                name="date"
                value={attendanceForm.date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
              <input
                disabled
                value={`${classInfo.year} | Semester ${classInfo.semester} | Section ${classInfo.section}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
              />
            </div>
          </div>

          {/* Holiday Status */}
          {isHoliday && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-amber-500 text-xl mr-2">🎉</span>
                <div>
                  <p className="text-amber-800 font-medium">This date is marked as a holiday</p>
                  <p className="text-amber-700 text-sm">Reason: {holidayReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Attendance Status */}
          {attendanceMarked && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-green-500 text-xl mr-2">✅</span>
                <div>
                  <p className="text-green-800 font-medium">Attendance already marked for this date</p>
                  <p className="text-green-700 text-sm">Use the History tab to edit attendance records</p>
                </div>
              </div>
            </div>
          )}

          {/* Absentees Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Absent Roll Numbers (comma-separated)
            </label>
            <input
              type="text"
              name="absentees"
              value={attendanceForm.absentees}
              onChange={handleInputChange}
              placeholder="e.g., 44, 7, 12"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isHoliday || attendanceMarked}
            />
            <p className="text-sm text-gray-500 mt-1">
              Students not listed will be automatically marked as Present. Leave empty if all students are present.
            </p>
          </div>

          {/* Student List Preview */}
          {students.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Students in this class ({students.length})
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {students.map((student) => (
                    <div key={student._id} className="flex items-center">
                      <span className="text-gray-500 mr-2">#{student.rollNumber}</span>
                      <span className="text-gray-700">{student.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || isHoliday || attendanceMarked}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 
               isHoliday ? 'Cannot mark on holiday' : 
               attendanceMarked ? 'Already Marked' : 
               'Mark Attendance'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AttendanceManager;

