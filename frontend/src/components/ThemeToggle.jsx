import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
      className={`relative flex items-center w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-uitm-gold ${
        isDark ? 'bg-gray-700' : 'bg-purple-300'
      }`}
    >
      {/* Track icons */}
      <Sun
        size={11}
        className={`absolute left-1.5 transition-opacity duration-300 ${isDark ? 'opacity-30 text-white' : 'opacity-90 text-white'}`}
      />
      <Moon
        size={11}
        className={`absolute right-1.5 transition-opacity duration-300 ${isDark ? 'opacity-90 text-white' : 'opacity-30 text-white'}`}
      />
      {/* Sliding thumb */}
      <span
        className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center transition-transform duration-300 ease-in-out ${
          isDark ? 'translate-x-[30px]' : 'translate-x-0.5'
        }`}
      >
        {isDark
          ? <Moon size={12} className="text-gray-700" />
          : <Sun size={12} className="text-uitm-gold" />
        }
      </span>
    </button>
  );
}
