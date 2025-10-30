import { useAuth } from '../../context/AuthContext';

const PrincipalDashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="bg-white bg-opacity-20 p-3 rounded-xl mr-4">
                <span className="text-3xl">🎓</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Principal Dashboard</h1>
                <p className="text-white text-opacity-90">Welcome back, {user?.name}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg border border-blue-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">👥</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Students</p>
                <p className="text-2xl font-bold text-gray-800">2,847</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg border border-purple-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">👨‍🏫</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Faculty Members</p>
                <p className="text-2xl font-bold text-gray-800">156</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-lg border border-green-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">📚</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Departments</p>
                <p className="text-2xl font-bold text-gray-800">12</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-white to-pink-50 rounded-2xl shadow-lg border border-pink-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-3 rounded-xl mr-3 shadow-lg">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Avg. Attendance</p>
                <p className="text-2xl font-bold text-green-600">87.3%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Reports */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">🏢</span>
              <h3 className="text-lg font-semibold">Department Reports</h3>
            </div>
            <p className="text-gray-600 mb-4">View attendance reports by department</p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              View Reports
            </button>
          </div>

          {/* Faculty Performance */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">👩‍🏫</span>
              <h3 className="text-lg font-semibold">Faculty Performance</h3>
            </div>
            <p className="text-gray-600 mb-4">Monitor faculty attendance and performance</p>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              View Performance
            </button>
          </div>

          {/* Global Analytics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📈</span>
              <h3 className="text-lg font-semibold">Global Analytics</h3>
            </div>
            <p className="text-gray-600 mb-4">Comprehensive institutional analytics</p>
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              View Analytics
            </button>
          </div>

          {/* Policy Management */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📋</span>
              <h3 className="text-lg font-semibold">Policy Management</h3>
            </div>
            <p className="text-gray-600 mb-4">Manage attendance policies and rules</p>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Manage Policies
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrincipalDashboard;
