import { useEffect } from 'react';
import { TEAM_INFO } from './TeamInfoConfig';

export default function TeamModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm overflow-y-auto" onMouseDown={onClose}>
      <div
        className="relative w-full max-w-3xl mx-2 sm:mx-auto bg-white rounded-2xl shadow-2xl animate-fadein border overflow-y-auto max-h-[90vh]"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex flex-col items-center px-6 py-6 border-b">
          {/* Optional Logo, can add <img src=... alt=logo /> */}
          <h1 className="text-2xl font-bold text-blue-700 text-center mb-1">{TEAM_INFO.projectName}</h1>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Project by Team Akvora</h2>
          <p className="text-xs text-gray-500">v{TEAM_INFO.version}</p>
        </div>
        {/* Team Grid */}
        <div className="py-6 px-8">
          <h3 className="text-lg font-semibold mb-4 text-center">Team Members</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {TEAM_INFO.team.map((member, idx) => (
              <div key={idx} className="rounded-xl shadow flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border hover:scale-[1.03] transition-transform">
                {member.image ? (
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-blue-600 mb-2 shadow-md"
                    onError={(e) => {
                      // Fallback to initial if image fails to load
                      e.target.style.display = 'none';
                      const fallback = e.target.nextSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl mb-2 ${member.image ? 'hidden' : ''}`}
                  style={{ display: member.image ? 'none' : 'flex' }}
                >
                  {member.name[0]}
                </div>
                <p className="font-semibold text-gray-900 text-base">{member.name}</p>
                <p className="text-sm text-gray-600">{member.role}</p>
              </div>
            ))}
          </div>
          {/* Project Info Section */}
          <h3 className="text-lg font-semibold mb-2">Project Information</h3>
          <div className="text-gray-700 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><strong>Title:</strong> {TEAM_INFO.projectName}</div>
            <div><strong>Version:</strong> {TEAM_INFO.version}</div>
            <div><strong>Developed By:</strong> {TEAM_INFO.developedBy}</div>
            <div><strong>Institution/Dept.:</strong> {TEAM_INFO.institution}</div>
            {TEAM_INFO.mentor && <div><strong>Mentor:</strong> {TEAM_INFO.mentor}</div>}
            <div><strong>Duration:</strong> {TEAM_INFO.duration}</div>
          </div>
          {/* Tech Stack */}
          <h3 className="text-lg font-semibold mb-2">Tech Stack</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {TEAM_INFO.techStack.map(stack => (
              <span key={stack} className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold border border-blue-300">{stack}</span>
            ))}
          </div>
          {/* Acknowledgment */}
          {TEAM_INFO.acknowledgments && (
            <div className="bg-gray-50 rounded p-4 text-sm text-center text-gray-600 font-medium mb-4">{TEAM_INFO.acknowledgments}</div>
          )}
        </div>
        {/* Modal Footer */}
        <div className="flex justify-center border-t py-4 px-8">
          <button
            className="bg-indigo-700 hover:bg-indigo-800 text-white px-6 py-2 rounded-lg font-semibold shadow transition-colors"
            onClick={onClose}
          >Back to Dashboard</button>
        </div>
        <div className="text-xs text-gray-400 text-center py-2">v{TEAM_INFO.version} © {TEAM_INFO.copyrightYear} Team Akvora</div>
      </div>
    </div>
  );
}
