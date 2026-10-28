import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'pill' | 'row';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', variant = 'icon' }) => {
  const { isDark, toggleTheme } = useTheme();

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono transition-all duration-200 cursor-pointer ${
          isDark
            ? 'bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700'
            : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
        } ${className}`}
        title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      >
        {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        <span className="font-semibold">{isDark ? 'Light' : 'Dark'}</span>
      </button>
    );
  }

  if (variant === 'row') {
    return (
      <div
        onClick={toggleTheme}
        className={`w-full p-3.5 rounded-2xl cursor-pointer transition flex items-center justify-between ${
          isDark
            ? 'bg-[#202c33] hover:bg-[#28373f] text-slate-100'
            : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm'
        } ${className}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-xs font-bold leading-tight">
              {isDark ? 'Light Appearance' : 'Dark Stealth Appearance'}
            </p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Current theme: <span className="font-semibold capitalize">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </p>
          </div>
        </div>

        {/* Switch Pill */}
        <div
          className={`w-12 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer ${
            isDark ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
          }`}
        >
          <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
        </div>
      </div>
    );
  }

  // Default icon button
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${
        isDark
          ? 'text-amber-300 hover:text-amber-200 hover:bg-slate-700/60'
          : 'text-amber-600 hover:text-amber-700 hover:bg-slate-200/80'
      } ${className}`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
};
