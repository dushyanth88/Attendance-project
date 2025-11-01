import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TeamFooter from '../components/TeamFooter';

const Inauguration = () => {
  const navigate = useNavigate();
  const [confetti, setConfetti] = useState([]);

  // Pre-generate star positions for a subtle parallax sparkle background
  const stars = useMemo(() => Array.from({ length: 40 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 3 + Math.random() * 3,
    delay: Math.random() * 3
  })), []);

  const handleLaunch = () => {
    // Trigger simple confetti burst
    const pieces = Array.from({ length: 80 }).map((_, i) => ({
      id: Date.now() + i,
      left: 50 + (Math.random() * 30 - 15),
      rotation: Math.random() * 360,
      duration: 1000 + Math.random() * 1200,
      color: `hsl(${Math.floor(Math.random() * 360)}, 90%, 60%)`,
      transformX: (Math.random() * 120 - 60),
      transformY: (Math.random() * 60 + 60)
    }));
    setConfetti(pieces);
    // Navigate after animation
    setTimeout(() => navigate('/login'), 1200);
  };

  // Auto-clear confetti after animation
  useEffect(() => {
    if (confetti.length === 0) return;
    const timer = setTimeout(() => setConfetti([]), 1600);
    return () => clearTimeout(timer);
  }, [confetti]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #4338CA 0%, #7E22CE 50%, #DB2777 100%)',
        backgroundSize: '200% 200%',
        animation: 'gradientShift 12s ease infinite'
      }} />

      {/* Floating translucent blobs */}
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-pulse" />
      <div className="absolute -bottom-28 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-[float_8s_ease-in-out_infinite]" />

      {/* Twinkling stars */}
      {stars.map(s => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white/70"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animation: `twinkle 2.6s ease-in-out ${s.delay}s infinite` }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="max-w-3xl w-full text-center bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-10 border border-white/20 shadow-2xl animate-[fadeIn_800ms_ease]">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="/college-logo.png" alt="College Logo" className="h-10 w-auto object-contain drop-shadow" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <h1 className="text-white font-extrabold tracking-wide text-xl sm:text-2xl md:text-3xl whitespace-nowrap overflow-hidden text-ellipsis">
              Er. PERUMAL MANIMEKALAI COLLEGE OF ENGINEERING
            </h1>
          </div>
          <p className="text-indigo-100/90 text-xs sm:text-sm tracking-widest uppercase mb-6">Official Launch</p>
          <h2 className="text-white text-2xl sm:text-3xl md:text-4xl font-bold mb-3 animate-[popIn_700ms_ease]">Attendance Management System</h2>
          <p className="text-white/90 text-sm sm:text-base mb-4">Welcome! Click the button below to proceed to the application login.</p>

          {/* Center marquee appreciation text */}
          <div className="relative overflow-hidden mx-auto max-w-3xl mb-8" style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)', maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)' }}>
            <div className="flex whitespace-nowrap leading-tight">
              <div className="min-w-full animate-[marqueeLeft_16s_linear_infinite] will-change-transform">
              <span className="mx-8 text-white/95 text-sm sm:text-base">
                🎉 Proudly inaugurated by our Hon'ble Principal • Smart Attendance for a Smarter Campus •
              </span>
              <span className="mx-8 text-white/95 text-sm sm:text-base">
                🚀 Accuracy • Transparency • Efficiency • Built by the Department of IT •
              </span>
              <span className="mx-8 text-white/95 text-sm sm:text-base">
                🎓 Congratulations to the Project Team on this milestone launch •
              </span>
              </div>
              <div className="min-w-full animate-[marqueeRight_16s_linear_infinite] will-change-transform" aria-hidden="true">
                <span className="mx-8 text-white/95 text-sm sm:text-base">
                  🎉 Proudly inaugurated by our Hon'ble Principal • Smart Attendance for a Smarter Campus •
                </span>
                <span className="mx-8 text-white/95 text-sm sm:text-base">
                  🚀 Accuracy • Transparency • Efficiency • Built by the Department of IT •
                </span>
                <span className="mx-8 text-white/95 text-sm sm:text-base">
                  🎓 Congratulations to the Project Team on this milestone launch •
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLaunch}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all relative overflow-hidden"
          >
            <span className="relative z-10">Proceed to Login</span>
            <span className="relative z-10">→</span>
            {/* radial hover glow */}
            <span className="absolute inset-0 bg-gradient-to-r from-pink-300/30 to-cyan-300/30 opacity-0 hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>

      {/* Confetti layer */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {confetti.map(p => (
          <span
            key={p.id}
            className="absolute w-2 h-3 md:w-2.5 md:h-3.5"
            style={{
              left: `${p.left}%`,
              top: '45%',
              backgroundColor: p.color,
              transform: `translate(-50%, -50%) rotate(${p.rotation}deg)` ,
              animation: `confettiFall ${p.duration}ms ease forwards`,
              boxShadow: '0 0 8px rgba(255,255,255,0.25)'
            }}
          />
        ))}
      </div>

      {/* removed bottom banner; marquee moved to center */}

      {/* Keyframe styles */}
      <style>{`
        @keyframes gradientShift { 0%{background-position:0% 0%} 50%{background-position:100% 100%} 100%{background-position:0% 0%} }
        @keyframes twinkle { 0%,100%{opacity:.2; transform:scale(.9)} 50%{opacity:1; transform:scale(1.15)} }
        @keyframes float { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-18px) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes popIn { 0%{ transform: scale(.95); opacity: 0 } 70%{ transform: scale(1.03); opacity: 1 } 100%{ transform: scale(1) } }
        @keyframes confettiFall { 
          0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 1 }
          100% { transform: translate(calc(-50% + var(--tx, 0px)), calc(-50% + 160px)) rotate(540deg); opacity: 0 }
        }
        @keyframes marquee { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        @keyframes marqueeCenter { 0% { transform: translateX(0) } 100% { transform: translateX(-100%) } }
        @keyframes marqueeLeft { 0% { transform: translateX(0) } 100% { transform: translateX(-100%) } }
        @keyframes marqueeRight { 0% { transform: translateX(100%) } 100% { transform: translateX(0) } }
      `}</style>
      <TeamFooter />
    </div>
  );
};

export default Inauguration;


