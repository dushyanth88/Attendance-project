import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/apiFetch';
import TeamFooter from '../../components/TeamFooter';
import PasswordResetModal from '../../components/PasswordResetModal';

const PrincipalDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [hodCount, setHodCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hods, setHods] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' });
  const [saving, setSaving] = useState(false);
  const [deptCounts, setDeptCounts] = useState([]);
  const [facultyDeptCounts, setFacultyDeptCounts] = useState([]);
  const [totalFaculties, setTotalFaculties] = useState(0);
  const [facultiesByDepartment, setFacultiesByDepartment] = useState([]);
  const [expandedDepartments, setExpandedDepartments] = useState(new Set());
  const [profileImage, setProfileImage] = useState(user?.profileImage);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [overallStats, setOverallStats] = useState({loading: true});
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);

  useEffect(() => {
    setProfileImage(user?.profileImage);
  }, [user?.profileImage]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const [countRes, listRes, deptRes, facultyDeptRes, facultiesByDeptRes] = await Promise.all([
          apiFetch({ url: '/api/admin/hod-count' }),
          apiFetch({ url: '/api/admin/hods' }),
          apiFetch({ url: '/api/admin/student-counts-by-department' }),
          apiFetch({ url: '/api/admin/faculty-counts-by-department' }),
          apiFetch({ url: '/api/admin/faculties-by-department' })
        ]);
        if (!isMounted) return;
        setHodCount(countRes?.data?.data?.totalHODs ?? 0);
        setHods(listRes?.data?.data?.hods ?? []);
        setDeptCounts(deptRes?.data?.data?.departments ?? []);
        setFacultyDeptCounts(facultyDeptRes?.data?.data?.departments ?? []);
        setTotalFaculties(facultyDeptRes?.data?.data?.total ?? 0);
        setFacultiesByDepartment(facultiesByDeptRes?.data?.data?.departments ?? []);
        setError('');
      } catch (e) {
        if (!isMounted) return;
        setError('Failed to load HOD count');
        setHodCount(0);
        setHods([]);
        setDeptCounts([]);
        setFacultyDeptCounts([]);
        setTotalFaculties(0);
        setFacultiesByDepartment([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    // Fetch OVERALL stats for all students, all departments/classes for today
    let mounted = true;
    setOverallStats({loading:true});
    apiFetch({ url: '/api/admin/overall-daily-attendance' })
      .then(res => {
        if (!mounted) return;
        if (res.data.success) {
          setOverallStats({
            ...res.data.data,
            loading: false
          });
        } else {
          setOverallStats({loading: false, error: res.data.msg || 'Failed to fetch stats'});
        }
      })
      .catch(() => setOverallStats({loading:false, error:'Failed to fetch stats'}));
    return () => { mounted = false; }
  }, []);

  const refresh = async () => {
    const [countRes, listRes, deptRes, facultyDeptRes, facultiesByDeptRes] = await Promise.all([
      apiFetch({ url: '/api/admin/hod-count' }),
      apiFetch({ url: '/api/admin/hods' }),
      apiFetch({ url: '/api/admin/student-counts-by-department' }),
      apiFetch({ url: '/api/admin/faculty-counts-by-department' }),
      apiFetch({ url: '/api/admin/faculties-by-department' })
    ]);
    setHodCount(countRes?.data?.data?.totalHODs ?? 0);
    setHods(listRes?.data?.data?.hods ?? []);
    setDeptCounts(deptRes?.data?.data?.departments ?? []);
    setFacultyDeptCounts(facultyDeptRes?.data?.data?.departments ?? []);
    setTotalFaculties(facultyDeptRes?.data?.data?.total ?? 0);
    setFacultiesByDepartment(facultiesByDeptRes?.data?.data?.departments ?? []);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      await apiFetch({ url: '/api/admin/hods', method: 'POST', data: form });
      setForm({ name: '', email: '', password: '', department: '' });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.msg || 'Failed to create HOD');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiFetch({ url: `/api/admin/hods/${id}`, method: 'DELETE' });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.msg || 'Failed to remove HOD');
    }
  };

  // Handlers for profile pic:
  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setToast({ show: true, message: 'Please select a valid image file (JPEG, PNG, GIF, WebP)', type: 'error' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast({ show: true, message: 'Image size must be less than 2MB', type: 'error' });
      return;
    }
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('profilePicture', file);
      const response = await apiFetch({
        url: '/api/faculty/profile-picture',
        method: 'POST',
        data: formData
      });
      if (response.data.success) {
        setProfileImage(response.data.data.profileImage);
        setToast({ show: true, message: 'Profile picture uploaded successfully!', type: 'success' });
      } else {
        setToast({ show: true, message: response.data.msg || 'Failed to upload profile picture', type: 'error' });
      }
    } catch (error) {
      setToast({ show: true, message: 'Failed to upload profile picture', type: 'error' });
    } finally {
      setUploadingImage(false);
    }
  };
  const handleRemoveProfilePicture = async () => {
    try {
      setUploadingImage(true);
      const response = await apiFetch({
        url: '/api/faculty/profile-picture',
        method: 'DELETE'
      });
      if (response.data.success) {
        setProfileImage(null);
        setToast({ show: true, message: 'Profile picture removed successfully!', type: 'success' });
      } else {
        setToast({ show: true, message: response.data.msg || 'Failed to remove profile picture', type: 'error' });
      }
    } catch (error) {
      setToast({ show: true, message: 'Failed to remove profile picture', type: 'error' });
    } finally {
      setUploadingImage(false);
    }
  };
  const handleProfilePictureClick = (e) => {
    e.stopPropagation();
    if (profileImage) setShowImageModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              {/* Profile Pic Section */}
              <div className="relative group mr-4">
                <div 
                  className="bg-white bg-opacity-20 p-3 rounded-full cursor-pointer hover:bg-opacity-30 transition-all duration-200"
                  onClick={handleProfilePictureClick}
                >
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={`${user?.name || 'Principal'}'s profile`}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div className={`w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-white font-semibold text-xl ${profileImage ? 'hidden' : 'flex'}`}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
                  </div>
                </div>
                {/* Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center space-y-1 pointer-events-auto">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      className="hidden"
                      id="principal-profile-picture-upload"
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor="principal-profile-picture-upload"
                      className="text-white text-xs cursor-pointer hover:text-blue-200 transition-colors"
                    >
                      {uploadingImage ? '⏳' : (profileImage ? '📷' : '➕')}
                    </label>
                    {profileImage && (
                      <button
                        onClick={handleRemoveProfilePicture}
                        className="text-white text-xs hover:text-red-200 transition-colors"
                        disabled={uploadingImage}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Principal Dashboard</h1>
                <p className="text-white text-opacity-90">Welcome back, {user?.name}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/principal/students-by-department')}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
              >
                View All Students
              </button>
              <button
                onClick={() => navigate('/principal/department-attendance')}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
              >
                Department Attendance
              </button>
              <button
                onClick={() => setShowPasswordResetModal(true)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
              >
                Change Password
              </button>
              <button
                onClick={logout}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-xl transition-all duration-200 shadow-lg font-semibold backdrop-blur-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-20 right-4 z-[9999]">
          <div className={`px-5 py-4 rounded-lg shadow-xl text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>{toast.message}</div>
        </div>
      )}
      {/* Profile Image Preview Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setShowImageModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-[90%] p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Profile Picture</h3>
              <button className="text-gray-500 hover:text-gray-700 text-2xl leading-none" onClick={() => setShowImageModal(false)}>×</button>
            </div>
            <div className="flex items-center justify-center">
              {profileImage ? (
                <img src={profileImage} alt={`${user?.name || 'Principal'} profile`} className="max-h-[70vh] max-w-full rounded-lg object-contain" />
              ) : (
                <div className="w-40 h-40 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-5xl font-bold">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* OVERALL DAILY STATS */}
        <div className="mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg p-6 flex flex-col xs:flex-row justify-between items-center text-white animate-fadein min-h-[116px]">
            {overallStats.loading ? (
              <div className="flex items-center gap-4"><div className="h-9 w-9 bg-white/40 rounded-lg animate-pulse"></div><span className="text-xl font-bold">Loading attendance stats...</span></div>
            ) : overallStats.error ? (
              <span className="text-red-100 font-bold">{overallStats.error}</span>
            ) : (
              <div className="flex flex-col sm:flex-row w-full justify-between gap-8 items-center">
                <div className="flex flex-col items-center"><span className="text-lg">Total Students</span><span className="text-3xl font-bold">{overallStats.totalStudents}</span></div>
                <div className="flex flex-col items-center"><span className="text-lg">Present</span><span className="text-2xl font-semibold text-green-200">{overallStats.presentStudents}</span></div>
                <div className="flex flex-col items-center"><span className="text-lg">Absent</span><span className="text-2xl font-semibold text-red-200">{overallStats.absentStudents}</span></div>
                <div className="flex flex-col items-center"><span className="text-lg">Not Marked</span><span className="text-2xl font-semibold text-yellow-200">{overallStats.notMarkedStudents}</span></div>
                <div className="flex flex-col items-center"><span className="text-lg">Present %</span><span className="text-2xl font-bold text-white">{overallStats.attendancePercentage}%</span></div>
              </div>
            )}
          </div>
        </div>
        {/* Students by Department (Top) */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Students by Department</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deptCounts.map((d) => (
              <div key={d.department} className="border rounded-xl p-4 flex items-center justify-between">
                <span className="font-medium text-gray-700">{d.department}</span>
                <span className="text-indigo-600 font-bold">{d.count}</span>
              </div>
            ))}
            {(!deptCounts || deptCounts.length === 0) && (
              <p className="text-sm text-gray-500">No student data available.</p>
            )}
          </div>
        </div>

        {/* Faculty by Department */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Faculty by Department</h3>
            <div className="bg-purple-100 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600 font-medium">Total Faculties: </span>
              <span className="text-purple-600 font-bold text-lg">{totalFaculties}</span>
            </div>
          </div>
          
          {/* Department Cards with Expandable Faculty Lists */}
          <div className="space-y-4">
            {facultiesByDepartment.map((dept) => (
              <div key={dept.department} className="border rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    const newExpanded = new Set(expandedDepartments);
                    if (newExpanded.has(dept.department)) {
                      newExpanded.delete(dept.department);
                    } else {
                      newExpanded.add(dept.department);
                    }
                    setExpandedDepartments(newExpanded);
                  }}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-gray-800 text-lg">{dept.department}</span>
                    <span className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm font-medium">
                      {dept.count} {dept.count === 1 ? 'Faculty' : 'Faculties'}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      expandedDepartments.has(dept.department) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedDepartments.has(dept.department) && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dept.faculties.map((faculty) => (
                        <div
                          key={faculty.id}
                          className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800 mb-1">{faculty.name}</h4>
                              <p className="text-sm text-gray-600 mb-1">{faculty.position}</p>
                              <p className="text-xs text-gray-500">{faculty.email}</p>
                              {faculty.phone && (
                                <p className="text-xs text-gray-500 mt-1">📞 {faculty.phone}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {dept.faculties.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No faculties found in this department.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {(!facultiesByDepartment || facultiesByDepartment.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No faculty data available.</p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="bg-indigo-600 text-white p-3 rounded-xl mr-3">
                <span className="text-2xl">🏛️</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">HODs</p>
                <p className="text-2xl font-bold text-gray-800">
                  {loading ? '—' : hodCount}
                </p>
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Manage HODs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-4">Add HOD</h3>
            <div className="grid grid-cols-1 gap-4">
              <input value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} className="border rounded-lg px-3 py-2" placeholder="Name" required />
              <input value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} type="email" className="border rounded-lg px-3 py-2" placeholder="Email" required />
              <input value={form.password} onChange={e=>setForm({ ...form, password: e.target.value })} type="password" className="border rounded-lg px-3 py-2" placeholder="Password" required />
              <input value={form.department} onChange={e=>setForm({ ...form, department: e.target.value })} className="border rounded-lg px-3 py-2" placeholder="Department (e.g., CSE)" required />
            </div>
            <button disabled={saving} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-60">{saving ? 'Saving...' : 'Create HOD'}</button>
          </form>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-4">Existing HODs</h3>
            <ul className="divide-y">
              {hods.map(h => (
                <li key={h._id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{h.name} <span className="text-sm text-gray-500">({h.department || '—'})</span></p>
                    <p className="text-sm text-gray-500">{h.email}</p>
                  </div>
                  <button onClick={() => handleDelete(h._id)} className="text-red-600 hover:underline">Remove</button>
                </li>
              ))}
              {(!hods || hods.length === 0) && (
                <li className="py-3 text-sm text-gray-500">No HODs found</li>
              )}
            </ul>
          </div>
        </div>

        
      </main>

      {/* Password Reset Modal */}
      <PasswordResetModal 
        isOpen={showPasswordResetModal} 
        onClose={() => setShowPasswordResetModal(false)} 
      />

      <TeamFooter />
    </div>
  );
};

export default PrincipalDashboard;
