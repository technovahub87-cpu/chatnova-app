import React, { useEffect, useState } from 'react';
import { Shield, Lock, CheckCircle2, Server } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(12);
  const [statusText, setStatusText] = useState('Initializing Ephemeral Enclave...');
  const [stepIndex, setStepIndex] = useState(0);

  const stages = [
    { threshold: 25, text: 'Generating Client Curve25519 Ephemeral Keys...' },
    { threshold: 55, text: 'Negotiating Offshore Handshake (Zurich Relay)...' },
    { threshold: 85, text: 'Verifying Zero-Knowledge Identity Credentials...' },
    { threshold: 100, text: 'End-to-End Encrypted Tunnel Established.' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 450);
          return 100;
        }
        const nextVal = prev + Math.floor(Math.random() * 12) + 8;
        const clamped = Math.min(nextVal, 100);

        // Update status text based on progress
        for (let i = stages.length - 1; i >= 0; i--) {
          if (clamped >= stages[i].threshold) {
            setStatusText(stages[i].text);
            setStepIndex(i);
            break;
          }
        }
        return clamped;
      });
    }, 180);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-[#070d12] via-[#0b141a] to-[#050a0e] p-6 text-white select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top micro badge */}
      <div className="pt-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-emerald-500/30 text-emerald-400 text-xs tracking-wider uppercase font-mono shadow-inner">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Post-Quantum E2EE Relay
      </div>

      {/* Center Logo & Branding */}
      <div className="flex flex-col items-center text-center my-auto">
        {/* Animated Emblem */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Rotating halo ring */}
          <div className="absolute -inset-4 rounded-3xl border border-emerald-500/20 animate-spin [animation-duration:12s]" />
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-cyan-500/20 blur-md" />

          {/* Shield & Lock Box */}
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[#11242e] to-[#0a171f] border-2 border-emerald-400/60 shadow-[0_0_35px_rgba(16,185,129,0.35)] flex items-center justify-center">
            <Shield className="w-13 h-13 text-emerald-400 drop-shadow-[0_2px_10px_rgba(52,211,153,0.6)]" strokeWidth={1.8} />
            <div className="absolute inset-0 flex items-center justify-center pt-1">
              <Lock className="w-6 h-6 text-cyan-300 drop-shadow" strokeWidth={2.4} />
            </div>
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-1.5 flex items-center justify-center gap-2">
          Chat<span className="text-emerald-400">Nova</span>
        </h1>

        {/* Tagline as specified in user request */}
        <p className="text-sm font-semibold tracking-widest text-emerald-400/90 uppercase font-mono">
          Your Privacy • Our Priority
        </p>

        <p className="mt-3 text-xs text-slate-400 max-w-xs leading-relaxed">
          Zero-knowledge cryptographic enclave with decentralized offshore routing.
        </p>
      </div>

      {/* Bottom Loading Progress Bar */}
      <div className="w-full max-w-xs mb-8 flex flex-col items-center">
        {/* Progress Bar Container */}
        <div className="w-full bg-slate-800/80 rounded-full h-2 p-0.5 border border-slate-700/60 overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-200 ease-out shadow-[0_0_12px_rgba(52,211,153,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress Status Text & Percent */}
        <div className="w-full flex items-center justify-between mt-2.5 text-[11px] font-mono text-slate-400">
          <span className="truncate max-w-[210px] text-slate-300 flex items-center gap-1.5">
            <Server className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
            {statusText}
          </span>
          <span className="font-bold text-emerald-400 shrink-0">{progress}%</span>
        </div>

        {/* Security badges row */}
        <div className="mt-5 flex items-center gap-4 text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> No Phone Numbers
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Zero Logs
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> AES-256-GCM
          </span>
        </div>
      </div>
    </div>
  );
};
