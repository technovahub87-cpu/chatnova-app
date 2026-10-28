import React, { useState } from 'react';
import { X, Shield, CheckCircle2, QrCode, Lock, Copy, Check } from 'lucide-react';
import { User } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SafetyNumberModalProps {
  contact: User;
  isOpen: boolean;
  onClose: () => void;
}

export const SafetyNumberModal: React.FC<SafetyNumberModalProps> = ({ contact, isOpen, onClose }) => {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(contact.publicKeyFingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className={`relative w-full max-w-sm border rounded-3xl p-6 shadow-2xl transition-colors ${
          isDark
            ? 'bg-[#111b21] border-emerald-500/30 text-slate-100'
            : 'bg-white border-emerald-500/40 text-slate-900 shadow-xl'
        }`}
      >
        <div
          className={`flex items-center justify-between pb-4 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            <h3
              className={`font-bold text-base ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Verify Safety Number
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Simulation Card */}
        <div className="my-5 flex flex-col items-center">
          <div className="w-44 h-44 bg-white p-3 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center relative">
            <QrCode className="w-32 h-32 text-slate-950" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 border-2 border-white flex items-center justify-center shadow">
                <Lock className="w-4 h-4 text-white" />
              </div>
            </div>
            <span className="text-[10px] text-slate-700 font-mono mt-1 font-semibold">
              {contact.customId}
            </span>
          </div>

          <p
            className={`mt-4 text-xs text-center max-w-xs leading-relaxed ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            To verify that calls and messages with{' '}
            <strong className={isDark ? 'text-white' : 'text-slate-900'}>
              {contact.displayName}
            </strong>{' '}
            are end-to-end encrypted with zero intermediary interception, compare these numbers or scan the QR.
          </p>
        </div>

        {/* 60 Digit Number Block */}
        <div
          className={`border rounded-xl p-3 mb-5 ${
            isDark ? 'bg-[#0b141a] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
              Safety Number Fingerprint
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className={`text-[11px] flex items-center gap-1 font-mono transition cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div
            className={`font-mono text-xs tracking-wider text-center select-all font-semibold leading-relaxed ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            {contact.publicKeyFingerprint} 7210 9940 8219 0134 5582 1920
          </div>
        </div>

        {/* Mark as Verified Button */}
        <button
          type="button"
          onClick={() => {
            setIsVerified(!isVerified);
          }}
          className={`w-full py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            isVerified
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/50'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white dark:text-slate-950 shadow'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isVerified ? 'Marked as Cryptographically Verified' : 'Confirm Safety Match'}</span>
        </button>
      </div>
    </div>
  );
};
