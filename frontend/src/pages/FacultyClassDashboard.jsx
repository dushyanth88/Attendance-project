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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gradient-to-br from-gray-400 to-gray-500 p-4 rounded-2xl mx-auto w-16 h-16 flex items-center justify-center mb-4">
            <span className="text-3xl">🎓</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Class Selected</h2>
          <p className="text-gray-600 mb-6">Please select a class to manage.</p>
          <button
            onClick={() => navigate('/faculty/class-management')}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg font-semibold"
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
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        {/* Header */}
        <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/faculty/class-management')}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-3 rounded-xl transition-all duration-200 mr-4 shadow-lg"
                  title="Back to Class Management"
                >
                  ←
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {getClassDisplayName(activeClass)}
                  </h1>
                  <p className="text-white text-opacity-90">
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
                    className="appearance-none bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl px-4 py-3 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 backdrop-blur-sm"
                  >
                    {assignedClasses.map((classData) => (
                      <option key={classData._id} value={classData._id} className="text-gray-800">
                        {getClassDisplayName(classData)}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-white">▼</span>
                  </div>
                </div>
                
                <button
                  onClick={() => navigate('/faculty/class-management')}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
                >
                  Manage Classes
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600 bg-gradient-to-b from-white to-indigo-50'
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
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-100 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl mr-4 shadow-lg">
                  <span className="text-2xl">🎓</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">
                    Currently Managing: {getClassDisplayName(activeClass)}
                  </h3>
                  <p className="text-gray-600">
                    Batch: {activeClass.batch} | Department: {activeClass.department || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Class Key</p>
                <p className="text-xs text-gray-600 font-mono">
                  {activeClass.batch}-{activeClass.year}-{activeClass.semester}-{activeClass.section}
                </p>
              </div>
            </div>
          </div>

          {/* Active Tab Content */}
          {ActiveComponent && (
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-100">
              <ActiveComponent />
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default FacultyClassDashboard;