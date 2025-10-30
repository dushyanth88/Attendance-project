import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login, error, clearError, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const roles = [
    { value: 'admin', label: 'Admin', icon: '👨‍💻', color: 'from-red-500 to-pink-500' },
    { value: 'principal', label: 'Principal', icon: '🎓', color: 'from-purple-500 to-indigo-500' },
    { value: 'hod', label: 'HOD', icon: '🧑‍🏫', color: 'from-blue-500 to-cyan-500' },
    { value: 'faculty', label: 'Faculty', icon: '👩‍🏫', color: 'from-green-500 to-teal-500' },
    { value: 'student', label: 'Student', icon: '🎒', color: 'from-orange-500 to-yellow-500' }
  ];

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    clearError();
  }, [formData.role, clearError]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(formData.email, formData.password, formData.role);
    
    if (result.success) {
      // Redirect based on role
      const roleRoutes = {
        admin: '/admin/dashboard',
        principal: '/principal/dashboard',
        hod: '/hod/dashboard',
        faculty: '/class-management', // Redirect faculty to class management page
        student: '/student/dashboard'
      };
      navigate(roleRoutes[formData.role] || '/dashboard');
    }
    
    setIsLoading(false);
  };

  const selectedRole = roles.find(role => role.value === formData.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-md mx-auto flex flex-col items-center">
        {/* Logo and Title */}
        <div className="flex flex-col items-center justify-center mb-5 sm:mb-6 w-full">
          <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-white rounded-full mb-3 sm:mb-4 shadow-xl">
            <span className="text-2xl sm:text-3xl">🎓</span>
          </div>
          <h1 className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-white mb-1.5 whitespace-nowrap leading-tight text-center w-full">
            Er. PERUMAL MANIMEKALAI COLLEGE OF ENGINEERING
          </h1>
          <p className="text-white text-xs sm:text-sm font-semibold mb-2 sm:mb-3 tracking-wider text-center w-full">
            (AUTONOMOUS INSTITUTION)
          </p>
          <p className="text-blue-100 text-sm sm:text-base font-medium text-center mt-1 w-full">Sign in to your account</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8">
          {/* Role Selector */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 sm:mb-3">
              Select Your Role
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 sm:gap-2">
              {roles.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: role.value })}
                  className={`p-2 sm:p-3 rounded-lg text-center transition-all duration-200 min-h-[44px] ${
                    formData.role === role.value
                      ? `bg-gradient-to-r ${role.color} text-white shadow-lg transform scale-105`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className="text-sm sm:text-lg mb-1">{role.icon}</div>
                  <div className="text-xs font-medium leading-tight">{role.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Role Display */}
          {selectedRole && (
            <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg bg-gradient-to-r ${selectedRole.color} text-white`}>
              <div className="flex items-center">
                <span className="text-xl sm:text-2xl mr-2 sm:mr-3">{selectedRole.icon}</span>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base">Signing in as {selectedRole.label}</h3>
                  <p className="text-xs sm:text-sm opacity-90">Access your {selectedRole.label.toLowerCase()} dashboard</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 sm:p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
              <div className="flex items-start">
                <span className="text-red-400 mr-2 text-sm sm:text-base">⚠️</span>
                <div>
                  <h4 className="text-red-800 font-medium text-sm sm:text-base">Login Failed</h4>
                  <p className="text-red-700 text-xs sm:text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm sm:text-base"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 pr-10 sm:pr-12 text-sm sm:text-base"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                >
                  <span className="text-sm sm:text-base">{showPassword ? '🙈' : '👁️'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                <span className="ml-2 text-xs sm:text-sm text-gray-600">Remember me</span>
              </label>
              <a href="#" className="text-xs sm:text-sm text-blue-600 hover:text-blue-800">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 min-h-[44px] ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : `bg-gradient-to-r ${selectedRole?.color || 'from-blue-500 to-purple-500'} hover:shadow-lg transform hover:scale-105`
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                  <span className="text-sm sm:text-base">Signing in...</span>
                </div>
              ) : (
                <span className="text-sm sm:text-base">Sign In</span>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
            <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Demo Credentials:</h4>
            <div className="text-xs text-gray-600 space-y-1 overflow-x-auto">
              <div className="break-all"><strong>Admin:</strong> admin@attendance.com / password123</div>
              <div className="break-all"><strong>Principal:</strong> principal@attendance.com / principal123</div>
              <div className="break-all"><strong>HOD (CS):</strong> hod.cs@attendance.com / hod123</div>
              <div className="break-all"><strong>HOD (EE):</strong> hod.ee@attendance.com / hod123</div>
              <div className="break-all"><strong>Faculty (CS):</strong> faculty.cs1@attendance.com / faculty123</div>
              <div className="break-all"><strong>Faculty (EE):</strong> faculty.ee1@attendance.com / faculty123</div>
              <div className="break-all"><strong>Student (CS):</strong> student.cs1@attendance.com / student123</div>
              <div className="break-all"><strong>Student (EE):</strong> student.ee1@attendance.com / student123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
