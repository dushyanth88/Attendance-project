import { useState } from 'react';
import TeamModal from './TeamModal';
import { TEAM_INFO } from './TeamInfoConfig';

export default function TeamFooter() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <footer className="w-full sticky bottom-0 bg-white shadow text-xs sm:text-sm text-gray-600 py-2 flex flex-col items-center z-30 border-t">
        <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1 px-4 justify-center">
          <span>© {TEAM_INFO.copyrightYear} {TEAM_INFO.projectName}</span>
          <span>|</span>
          <span>
            Developed by{' '}
            <button
              className="text-indigo-700 font-semibold transition hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-300"
              onClick={() => setShowModal(true)}
              aria-label="Show Team Akvora info"
            >
              Akvora
            </button>
          </span>
        </div>
      </footer>
      <TeamModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
