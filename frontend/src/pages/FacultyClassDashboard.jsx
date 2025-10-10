import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClass } from '../context/ClassContext';
import AttendanceManager from './AttendanceManager';
import AttendanceHistory from './AttendanceHistory';
import StudentManagement from './StudentManagement';
import ReportGenerator from './ReportGenerator';
import Toast from '../components/Toast';

const FacultyClassDashboard = () => {
  const { user } = useAuth();
  const { 
    activeClass, 
    assignedClasses, 
    switchClass, 
    getClassDisplayName,
    hasAssignedClasses,
    fetchAssignedClasses
  } = useClass();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('attendance');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (user?.id) {
      fetchAssignedClasses(user.id);
    }
  }, [user?.id, fetchAssignedClasses]);

  useEffect(() => {
    if (!activeClass && hasAssignedClasses()) {
      // If no active class but classes are available, redirect to class management
      navigate('/faculty/class-management');
    }
  }, [activeClass, hasAssignedClasses, navigate]);

  const handleClassSwitch = (classData) => {
    switchClass(classData);
    setToast({ 
      show: true, 
      message: `Switched to ${getClassDisplayName(classData)}`, 
      type: 'success' 
    });
  };

  const tabs = [
    { id: 'attendance', label: 'Attendance', icon: '📊', component: AttendanceManager },
    { id: 'history', label: 'History', icon: '📋', component: AttendanceHistory },
    { id: 'students', label: 'Students', icon: '👥', component: StudentManagement },
    { id: 'reports', label: 'Reports', icon: '📈', component: ReportGenerator }
  ];

  if (!activeClass) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Class Selected</h2>
          <p className="text-gray-600 mb-6">Please select a class to manage.</p>
          <button
            onClick={() => navigate('/faculty/class-management')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Select Class
          </button>
        </div>
      </div>
    );
  }

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/faculty/class-management')}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Back to Class Management"
                >
                  ←
                </button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {getClassDisplayName(activeClass)}
                  </h1>
                  <p className="text-sm text-gray-600">
                    Batch: {activeClass.batch} | Faculty: {user?.name}
                  </p>
                </div>
              </div>
              
              {/* Class Switcher */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <select
                    value={activeClass._id}
                    onChange={(e) => {
                      const selectedClass = assignedClasses.find(c => c._id === e.target.value);
                      if (selectedClass) {
                        handleClassSwitch(selectedClass);
                      }
                    }}
                    className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {assignedClasses.map((classData) => (
                      <option key={classData._id} value={classData._id}>
                        {getClassDisplayName(classData)}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <span className="text-gray-400">▼</span>
                  </div>
                </div>
                
                <button
                  onClick={() => navigate('/faculty/class-management')}
                  className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Manage Classes
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Class Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🎓</span>
                <div>
                  <h3 className="font-semibold text-blue-900">
                    Currently Managing: {getClassDisplayName(activeClass)}
                  </h3>
                  <p className="text-sm text-blue-700">
                    Batch: {activeClass.batch} | Department: {activeClass.department || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600">Class Key</p>
                <p className="text-xs text-blue-500 font-mono">
                  {activeClass.batch}-{activeClass.year}-{activeClass.semester}-{activeClass.section}
                </p>
              </div>
            </div>
          </div>

          {/* Active Tab Content */}
          {ActiveComponent && (
            <div className="bg-white rounded-lg shadow-md">
              <ActiveComponent />
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default FacultyClassDashboard;