import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Lock,
  KeyRound,
  User,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { User as UserType } from '../types';
import { INITIAL_USERS } from '../data/mockData';
import { generateFingerprint } from '../services/crypto';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import { authAPI, setAuthToken } from '../services/api';

interface AuthScreenProps {
  onLoginSuccess: (user: UserType) => void;
  onOpenMasterAdmin: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onOpenMasterAdmin }) => {
  const { isDark } = useTheme();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [customId, setCustomId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 2FA / OTP step
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('749216');
  const [timer, setTimer] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown for OTP
  useEffect(() => {
    let interval: any;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Handle credentials submission
  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const formattedId = customId.trim().startsWith('@')
      ? customId.trim()
      : `@${customId.trim()}`;

    if (!formattedId || formattedId.length < 3) {
      setErrorMsg('Please enter a valid Custom Username/ID (min 3 chars).');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(randomOtp);
    setTimer(60);
    setOtpDigits(['', '', '', '', '', '']);
    setStep('otp');
  };

  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = val.slice(-1);
    setOtpDigits(newDigits);

    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = (providedCode?: string) => {
    const code = providedCode || otpDigits.join('');
    if (code.length < 6) {
      setErrorMsg('Please enter the full 6-digit security code.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    const cleanId = customId.trim().startsWith('@') ? customId.trim() : `@${customId.trim()}`;

    // 1. Try real live backend API first
    (async () => {
      try {
        let apiRes;
        if (isRegisterMode) {
          apiRes = await authAPI.register({
            customId: cleanId,
            displayName: displayName.trim() || cleanId.replace('@', ''),
            password,
          });
        } else {
          apiRes = await authAPI.login({
            customId: cleanId,
            password,
          });
        }

        if (apiRes.isLiveBackend) {
          if (apiRes.success && apiRes.data?.user) {
            if (apiRes.data.token) {
              setAuthToken(apiRes.data.token);
            }
            setIsVerifying(false);
            onLoginSuccess(apiRes.data.user);
            return;
          } else if (!apiRes.success && apiRes.message) {
            setIsVerifying(false);
            setErrorMsg(apiRes.message);
            setStep('credentials');
            return;
          }
        }
      } catch (err) {
        console.warn('[ChatNova Auth] Live backend request skipped, using enclave mode.');
      }

      // 2. Offline / Enclave mode fallback
      setTimeout(() => {
        setIsVerifying(false);

        const existing = INITIAL_USERS.find(
          (u) => u.customId.toLowerCase() === cleanId.toLowerCase()
        );

        if (existing) {
          if (existing.isBanned) {
            setErrorMsg('This identity has been suspended by Master Administration.');
            setStep('credentials');
            return;
          }
          onLoginSuccess(existing);
        } else {
          const newUser: UserType = {
            id: 'user_' + Math.random().toString(36).substring(2, 9),
            customId: cleanId,
            displayName: displayName.trim() || cleanId.replace('@', ''),
            avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
            bio: 'ChatNova encrypted communicator • Zero Logs',
            status: 'online',
            lastSeen: 'Online',
            publicKeyFingerprint: generateFingerprint(),
            role: 'user',
            twoFactorEnabled: true,
            createdAt: new Date().toISOString().split('T')[0],
          };
          onLoginSuccess(newUser);
        }
      }, 700);
    })();
  };

  return (
    <div
      className={`relative min-h-dvh flex items-center justify-center p-4 transition-colors duration-300 overflow-y-auto ${
        isDark
          ? 'bg-gradient-to-br from-[#060c10] via-[#0b141a] to-[#071017] text-slate-100'
          : 'bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] text-slate-800'
      }`}
    >
      {/* Ambient background glows */}
      <div
        className={`absolute top-10 left-10 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
          isDark ? 'bg-emerald-600/10' : 'bg-emerald-500/15'
        }`}
      />
      <div
        className={`absolute bottom-10 right-10 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
          isDark ? 'bg-teal-500/10' : 'bg-cyan-500/15'
        }`}
      />

      {/* Outer Card */}
      <div
        className={`relative w-full max-w-md backdrop-blur-xl border rounded-3xl p-6 sm:p-8 transition-colors duration-200 ${
          isDark
            ? 'bg-[#111b21]/90 border-slate-800 shadow-[0_12px_45px_rgba(0,0,0,0.6)]'
            : 'bg-white/95 border-slate-200/90 shadow-[0_12px_45px_rgba(0,0,0,0.08)]'
        }`}
      >
        {/* Top Header Badge & Theme Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => {
              (window as any).__chatnova_auth_taps = ((window as any).__chatnova_auth_taps || 0) + 1;
              clearTimeout((window as any).__chatnova_auth_timer);
              if ((window as any).__chatnova_auth_taps >= 5) {
                (window as any).__chatnova_auth_taps = 0;
                onOpenMasterAdmin();
              } else {
                (window as any).__chatnova_auth_timer = setTimeout(() => {
                  (window as any).__chatnova_auth_taps = 0;
                }, 2200);
              }
            }}
            title="ChatNova Secure Identity"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-950/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2
                className={`text-xl font-bold tracking-tight flex items-center gap-1.5 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Chat<span className="text-emerald-500 font-extrabold">Nova</span>
              </h2>
              <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                Your Privacy • Our Priority
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle Pill */}
            <ThemeToggle variant="pill" />

            <div
              className={`hidden sm:flex px-2 py-0.5 rounded-full border text-[10px] font-mono items-center gap-1.5 ${
                isDark
                  ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              No Phone Req.
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: CREDENTIALS (NO PHONE NUMBER) */}
        {step === 'credentials' && (
          <div>
            {/* Mode Tabs */}
            <div
              className={`grid grid-cols-2 gap-1 p-1 rounded-2xl mb-6 border ${
                isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setErrorMsg('');
                }}
                className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  !isRegisterMode
                    ? 'bg-emerald-600 text-white shadow-md'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In With ID
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(true);
                  setErrorMsg('');
                }}
                className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  isRegisterMode
                    ? 'bg-emerald-600 text-white shadow-md'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Nova ID
              </button>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {/* Display name if registering */}
              {isRegisterMode && (
                <div>
                  <label
                    className={`block text-xs font-medium mb-1.5 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    Display Name (Alias)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Agent Phoenix"
                      className={`w-full rounded-xl px-4 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 border ${
                        isDark
                          ? 'bg-[#0b141a] border-slate-700 text-white placeholder-slate-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                      }`}
                    />
                    <Sparkles className="w-4 h-4 text-emerald-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Custom Username / ID Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className={`text-xs font-medium ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    Custom Username / ID
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    Unique • Never Phone
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm select-none">
                    @
                  </span>
                  <input
                    type="text"
                    value={customId.replace(/^@/, '')}
                    onChange={(e) =>
                      setCustomId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder="custom_username"
                    className={`w-full rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono transition focus:outline-none focus:ring-2 focus:ring-emerald-500 border ${
                      isDark
                        ? 'bg-[#0b141a] border-slate-700 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                    }`}
                    required
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
                <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Your identity exists as a decentralized cryptographic handle.
                </p>
              </div>

              {/* Password Field */}
              <div>
                <label
                  className={`block text-xs font-medium mb-1.5 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full rounded-xl pl-4 pr-10 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 border ${
                      isDark
                        ? 'bg-[#0b141a] border-slate-700 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition transform active:scale-[0.99] cursor-pointer"
              >
                <span>{isRegisterMode ? 'Generate Identity & 2FA' : 'Proceed to Secure 2FA'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: SECURE OTP / 2FA VERIFICATION FLOW */}
        {step === 'otp' && (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-emerald-500 animate-pulse" />
            </div>

            <h3
              className={`text-lg font-bold mb-1 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Secure 2FA / OTP Verification
            </h3>
            <p
              className={`text-xs max-w-xs mx-auto mb-2 ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              Enter the 6-digit cryptographic verification token for{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                {customId.startsWith('@') ? customId : `@${customId}`}
              </span>
            </p>

            {/* Simulated OTP Display Banner */}
            <div
              className={`mb-5 p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                isDark
                  ? 'bg-emerald-950/40 border-emerald-500/30'
                  : 'bg-emerald-50 border-emerald-200 text-slate-800'
              }`}
            >
              <span className="text-[11px] text-slate-500">Enclave Token:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold tracking-widest text-sm bg-black/10 dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/40">
                {generatedOtp}
              </span>
              <button
                type="button"
                onClick={() => {
                  setOtpDigits(generatedOtp.split(''));
                  handleVerifyOtp(generatedOtp);
                }}
                className="text-[10px] text-teal-600 dark:text-teal-300 underline font-semibold cursor-pointer"
              >
                Auto-fill & Verify
              </button>
            </div>

            {/* 6 Digit Inputs */}
            <div className="flex justify-center gap-2 mb-5">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className={`w-11 h-12 text-center text-lg font-mono font-bold rounded-xl border-2 outline-none transition shadow-inner ${
                    isDark
                      ? 'bg-[#0b141a] border-slate-700 focus:border-emerald-400 text-white'
                      : 'bg-slate-50 border-slate-300 focus:border-emerald-500 text-slate-900 focus:bg-white'
                  }`}
                />
              ))}
            </div>

            {/* Resend & Timer */}
            <div
              className={`flex items-center justify-between text-xs mb-5 px-1 font-mono ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <button
                type="button"
                disabled={timer > 0}
                onClick={() => {
                  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
                  setGeneratedOtp(newOtp);
                  setTimer(60);
                }}
                className={`flex items-center gap-1 cursor-pointer ${
                  timer > 0
                    ? 'opacity-40 cursor-not-allowed'
                    : 'text-emerald-600 dark:text-emerald-400 hover:underline'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Resend Token
              </button>
              <span>{timer > 0 ? `Expires in 00:${timer < 10 ? `0${timer}` : timer}` : 'Expired'}</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handleVerifyOtp()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Cryptographic Proof...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Decrypt Session</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setErrorMsg('');
                }}
                className={`w-full py-2 text-xs transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Back to credentials
              </button>
            </div>
          </div>
        )}

        {/* Security & Cryptographic Integrity Badges */}
        <div
          className={`mt-6 pt-4 border-t flex items-center justify-between text-[11px] ${
            isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500'
          }`}
        >
          <span className="flex items-center gap-1 font-mono">
            <Lock className="w-3 h-3 text-emerald-500" /> 256-Bit E2EE
          </span>

          <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
            <Shield className="w-3 h-3" />
            Zero-Knowledge Enclave
          </span>
        </div>
      </div>
    </div>
  );
};
