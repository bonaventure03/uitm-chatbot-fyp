import { useState, useEffect } from 'react';

const SHOW_MS   = 2200; // how long the preloader stays fully visible
const FADE_MS   = 450;  // duration of the fade-out (must match CSS animation)

export default function Preloader({ onDone }) {
  const [phase, setPhase] = useState('in');   // 'in' | 'visible' | 'out' | 'done'

  useEffect(() => {
    // Logo finishes scaling in at ~550ms, stay visible until SHOW_MS, then fade
    const fadeTimer   = setTimeout(() => setPhase('out'),  SHOW_MS);
    const removeTimer = setTimeout(() => { setPhase('done'); onDone?.(); }, SHOW_MS + FADE_MS);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center
        bg-[#1A0A2E] transition-opacity
        ${phase === 'out' ? 'animate-preloader-out' : ''}`}
    >
      {/* Radial glow behind the logo */}
      <div className="absolute w-80 h-80 rounded-full bg-uitm-maroon/20 blur-3xl pointer-events-none" />

      {/* Logo */}
      <div className={`relative z-10 animate-preloader-in animate-preloader-glow`}>
        <img
          src="/logo.png"
          alt="UiTM Campus Assistant"
          className="w-40 h-40 object-contain select-none"
          draggable={false}
        />
      </div>

      {/* App name */}
      <div className={`mt-6 text-center z-10 animate-preloader-in`} style={{ animationDelay: '0.2s', opacity: 0 }}>
        <p className="font-display text-xl font-semibold text-uitm-gold tracking-wide">
          UiTM Campus Assistant
        </p>
        <p className="text-xs text-purple-300/70 mt-1 tracking-widest uppercase">
          AI-Powered One-Stop Service
        </p>
      </div>

      {/* Animated loading dots */}
      <div className="flex gap-2 mt-8 z-10">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-uitm-gold animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
