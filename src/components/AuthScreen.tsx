
import React, { useState } from 'react';
import {
  Shield,
  Eye,
  EyeOff,
  Smartphone,
  KeyRound,
  Copy,
  CheckCircle2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

import { User as UserType } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import {
  authAPI,
  setAuthToken,
  removeAuthToken
} from '../services/api';

interface AuthScreenProps {
  onLogin: (user: UserType) => void;
  onOpenMasterAdmin?: () => void;
}

type AuthStep =
  | 'credentials'
  | 'sms-otp'
  | 'authenticator-setup'
  | 'recovery-codes'
  | 'login-2fa'
  | 'forgot-password';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLogin,
  onOpenMasterAdmin
}) => {
  const { isDark } = useTheme();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [step, setStep] = useState<AuthStep>('credentials');

  const [customId, setCustomId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [authenticatorCode, setAuthenticatorCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [smsOtp, setSmsOtp] = useState('');

  const [qrCode, setQrCode] = useState('');
  const [manualEntryKey, setManualEntryKey] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const cleanCustomId = () => {
    const value = customId.trim().toLowerCase();
    return value.startsWith('@') ? value : `@${value}`;
  };

  const showError = (message: string) => {
    setErrorMsg(message || 'Something went wrong. Please try again.');
    setSuccessMsg('');
  };

  const resetMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const mapUser = (user: any): UserType => ({
    id: String(user.id || user._id || ''),
    customId: user.customId || cleanCustomId(),
    displayName: user.displayName || 'ChatNova User',
    avatar:
      user.avatar ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    bio: user.bio || '',
    status: user.status || 'online',
    lastSeen: user.lastSeen || 'Online',
    publicKeyFingerprint: user.publicKeyFingerprint || '',
    role: user.role || 'user',
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    createdAt: user.createdAt
      ? new Date(user.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    isBanned: Boolean(user.isBanned)
  });

  const finishLogin = (token: string, user: any) => {
    if (!token || !user) {
      showError('Server did not return a valid login session.');
      return;
    }

    setAuthToken(token);
    const mappedUser = mapUser(user);

    if (!mappedUser.id) {
      removeAuthToken();
      showError('User identity is incomplete. Please contact support.');
      return;
    }

    onLogin(mappedUser);
  };

  const handleCredentialsSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    const id = cleanCustomId();

    if (!/^@[a-z0-9_]{3,24}$/.test(id)) {
      showError('ChatNova ID must contain 3 to 24 letters, numbers or underscores.');
      return;
    }

    if (password.length < 8) {
      showError('Password must contain at least 8 characters.');
      return;
    }

    if (isRegisterMode && !/^\d{10}$/.test(mobileNumber.replace(/\D/g, '').slice(-10))) {
      showError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);

    try {
      if (isRegisterMode) {
        const result = await authAPI.register({
          customId: id,
          displayName: displayName.trim(),
          password,
          mobileNumber: mobileNumber.replace(/\D/g, '').slice(-10)
        });

        if (!result.success) {
          showError(result.message || 'Registration failed.');
          return;
        }

        setSuccessMsg(
          'Registration OTP has been sent to your mobile number.'
        );
        setSmsOtp('');
        setStep('sms-otp');
      } else {
        setStep('login-2fa');
        setAuthenticatorCode('');
        setRecoveryCode('');
        setUseRecoveryCode(false);
        setSuccessMsg('Enter your Authenticator App code to continue.');
      }
    } catch {
      showError('Unable to connect to ChatNova server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySmsOtp = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    if (!/^\d{6}$/.test(smsOtp)) {
      showError('Enter the complete 6-digit SMS OTP.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authAPI.verifyRegistrationOtp({
        customId: cleanCustomId(),
        otp: smsOtp
      });

      if (!result.success || !result.data?.token) {
        showError(result.message || 'SMS OTP verification failed.');
        return;
      }

      setAuthToken(result.data.token);

      const setupResult = await authAPI.setupAuthenticator();

      if (!setupResult.success || !setupResult.data?.qrCode) {
        removeAuthToken();
        showError(
          setupResult.message ||
          'Could not start Authenticator setup. Please try again.'
        );
        return;
      }

      setQrCode(setupResult.data.qrCode);
      setManualEntryKey(setupResult.data.manualEntryKey || '');
      setStep('authenticator-setup');
      setSuccessMsg('Mobile number verified successfully.');
    } catch {
      showError('Unable to verify SMS OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAuthenticatorSetup = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    if (!/^\d{6}$/.test(authenticatorCode)) {
      showError('Enter the 6-digit code from your Authenticator App.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authAPI.verifyAuthenticatorSetup(
        authenticatorCode
      );

      if (!result.success || !result.data?.recoveryCodes) {
        showError(
          result.message || 'Authenticator verification failed.'
        );
        return;
      }

      setRecoveryCodes(result.data.recoveryCodes);
      setStep('recovery-codes');
      setAuthenticatorCode('');
      setSuccessMsg(
        'Authenticator App enabled. Save your recovery codes safely.'
      );
    } catch {
      showError('Unable to complete Authenticator setup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishRegistration = async () => {
    resetMessages();
    setIsLoading(true);

    try {
      const result = await authAPI.login({
        customId: cleanCustomId(),
        password,
        authenticatorCode
      });

      if (!result.success || !result.data?.token) {
        showError(
          result.message ||
          'Registration is complete, but automatic login failed. Please sign in.'
        );
        return;
      }

      finishLogin(result.data.token, result.data.user);
    } catch {
      showError('Registration completed. Please sign in again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    if (!useRecoveryCode && !/^\d{6}$/.test(authenticatorCode)) {
      showError('Enter your 6-digit Authenticator code.');
      return;
    }

    if (useRecoveryCode && !recoveryCode.trim()) {
      showError('Enter an unused recovery code.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authAPI.login({
        customId: cleanCustomId(),
        password,
        ...(useRecoveryCode
          ? { recoveryCode: recoveryCode.trim() }
          : { authenticatorCode })
      });

      if (!result.success || !result.data?.token) {
        showError(result.message || 'Login failed.');
        return;
      }

      finishLogin(result.data.token, result.data.user);
    } catch {
      showError('Unable to connect to ChatNova server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    if (newPassword.length < 8) {
      showError('New password must contain at least 8 characters.');
      return;
    }

    if (
      !useRecoveryCode &&
      !/^\d{6}$/.test(authenticatorCode)
    ) {
      showError('Enter your 6-digit Authenticator code.');
      return;
    }

    if (useRecoveryCode && !recoveryCode.trim()) {
      showError('Enter an unused recovery code.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authAPI.forgotPassword({
        customId: cleanCustomId(),
        newPassword,
        ...(useRecoveryCode
          ? { recoveryCode: recoveryCode.trim() }
          : { authenticatorCode })
      });

      if (!result.success) {
        showError(result.message || 'Password reset failed.');
        return;
      }

      removeAuthToken();
      setPassword('');
      setNewPassword('');
      setAuthenticatorCode('');
      setRecoveryCode('');
      setUseRecoveryCode(false);
      setStep('credentials');
      setIsRegisterMode(false);
      setSuccessMsg('Password changed successfully. Please sign in again.');
    } catch {
      showError('Unable to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    resetMessages();

    if (step === 'sms-otp') {
      setStep('credentials');
    } else if (
      step === 'login-2fa' ||
      step === 'forgot-password'
    ) {
      setStep('credentials');
    } else {
      removeAuthToken();
      setStep('credentials');
    }
  };

  const cardClass = isDark
    ? 'bg-[#111b21] border-slate-800 text-white'
    : 'bg-white border-slate-200 text-slate-900';

  const inputClass = `w-full rounded-xl px-4 py-3 text-sm border outline-none focus:ring-2 focus:ring-emerald-500 ${
    isDark
      ? 'bg-[#0b141a] border-slate-700 text-white placeholder-slate-500'
      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
  }`;

  const buttonClass =
    'w-full rounded-xl py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm transition';

  return (
    <div
      className={`min-h-dvh flex items-center justify-center p-4 ${
        isDark
          ? 'bg-gradient-to-br from-[#060c10] via-[#0b141a] to-[#071017]'
          : 'bg-gradient-to-br from-slate-100 via-white to-slate-200'
      }`}
    >
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 sm:p-8 ${cardClass}`}>
        <div className="flex items-center justify-between mb-7">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => onOpenMasterAdmin?.()}
            title="ChatNova"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold">
                Chat<span className="text-emerald-500">Nova</span>
              </h1>
              <p className="text-[10px] text-emerald-500 font-bold tracking-widest uppercase">
                Secure Identity
              </p>
            </div>
          </div>
          <ThemeToggle variant="pill" />
        </div>

        {(errorMsg || successMsg) && (
          <div
            className={`mb-5 p-3 rounded-xl text-xs flex items-start gap-2 ${
              errorMsg
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
            }`}
          >
            {errorMsg ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{errorMsg || successMsg}</span>
          </div>
        )}

        {step === 'credentials' && (
          <>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-500/10 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  resetMessages();
                }}
                className={`py-2.5 rounded-lg text-xs font-bold ${
                  !isRegisterMode
                    ? 'bg-emerald-600 text-white'
                    : 'opacity-60'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(true);
                  resetMessages();
                }}
                className={`py-2.5 rounded-lg text-xs font-bold ${
                  isRegisterMode
                    ? 'bg-emerald-600 text-white'
                    : 'opacity-60'
                }`}
              >
                Create Account
              </button>
            </div>

            <h2 className="text-lg font-bold mb-1">
              {isRegisterMode ? 'Create your ChatNova ID' : 'Welcome back'}
            </h2>
            <p className="text-xs opacity-60 mb-5">
              {isRegisterMode
                ? 'Create your account with one-time mobile verification.'
                : 'Sign in using your ChatNova ID and password.'}
            </p>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {isRegisterMode && (
                <>
                  <input
                    className={inputClass}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display name"
                    maxLength={60}
                    required
                  />

                  <div>
                    <label className="text-xs font-semibold opacity-70 mb-1 block">
                      Mobile number (registration OTP only)
                    </label>
                    <div className="flex gap-2">
                      <span className="rounded-xl px-3 py-3 bg-slate-500/10 text-sm font-bold">
                        +91
                      </span>
                      <input
                        className={inputClass}
                        type="tel"
                        inputMode="numeric"
                        value={mobileNumber}
                        onChange={(e) =>
                          setMobileNumber(
                            e.target.value.replace(/\D/g, '').slice(0, 10)
                          )
                        }
                        placeholder="10-digit mobile number"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-semibold opacity-70 mb-1 block">
                  ChatNova Custom ID
                </label>
                <input
                  className={inputClass}
                  value={customId}
                  onChange={(e) =>
                    setCustomId(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, '')
                    )
                  }
                  placeholder="@your_id"
                  maxLength={25}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold opacity-70 mb-1 block">
                  Password
                </label>
                <div className="relative">
                  <input
                    className={`${inputClass} pr-12`}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 opacity-60"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button className={buttonClass} disabled={isLoading}>
                {isLoading
                  ? 'Please wait...'
                  : isRegisterMode
                  ? 'Send Registration OTP'
                  : 'Continue'}
              </button>

              {!isRegisterMode && (
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setStep('forgot-password');
                    setUseRecoveryCode(false);
                  }}
                  className="w-full text-xs text-emerald-500 font-semibold py-2"
                >
                  Forgot password?
                </button>
              )}
            </form>
          </>
        )}

        {step === 'sms-otp' && (
          <form onSubmit={handleVerifySmsOtp} className="space-y-4">
            <button type="button" onClick={goBack} className="text-xs opacity-60 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <Smartphone className="w-10 h-10 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-center">
              Verify Mobile Number
            </h2>
            <p className="text-xs opacity-60 text-center">
              Enter the 6-digit OTP sent to your registered mobile number.
              This SMS verification is required only during registration.
            </p>
            <input
              className={`${inputClass} text-center tracking-[0.5em] text-xl`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={smsOtp}
              onChange={(e) =>
                setSmsOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="000000"
              required
            />
            <button className={buttonClass} disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Verify SMS OTP'}
            </button>
          </form>
        )}

        {step === 'authenticator-setup' && (
          <form onSubmit={handleVerifyAuthenticatorSetup} className="space-y-4">
            <h2 className="text-lg font-bold text-center">
              Set Up Authenticator App
            </h2>
            <p className="text-xs opacity-60 text-center">
              Scan this QR code using Google Authenticator or another compatible authenticator app.
            </p>

            {qrCode && (
              <div className="bg-white rounded-2xl p-3 w-fit mx-auto">
                <img
                  src={qrCode}
                  alt="Authenticator QR Code"
                  className="w-48 h-48"
                />
              </div>
            )}

            <div className="rounded-xl p-3 bg-slate-500/10">
              <p className="text-[10px] opacity-60 mb-2">
                Can't scan? Enter this setup key manually:
              </p>
              <p className="text-xs font-mono break-all select-all">
                {manualEntryKey}
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(manualEntryKey);
                  setSuccessMsg('Setup key copied.');
                }}
                className="text-emerald-500 text-xs flex items-center gap-1 mt-2"
              >
                <Copy className="w-3 h-3" /> Copy setup key
              </button>
            </div>

            <input
              className={`${inputClass} text-center tracking-[0.5em] text-xl`}
              inputMode="numeric"
              maxLength={6}
              value={authenticatorCode}
              onChange={(e) =>
                setAuthenticatorCode(
                  e.target.value.replace(/\D/g, '').slice(0, 6)
                )
              }
              placeholder="6-digit code"
              required
            />

            <button className={buttonClass} disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Activate Authenticator'}
            </button>
          </form>
        )}

        {step === 'recovery-codes' && (
          <div className="space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-center">
              Save Your Recovery Codes
            </h2>
            <p className="text-xs text-rose-500 text-center">
              These codes are shown only once. Each code can be used one time.
              Save them somewhere safe and private.
            </p>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-500/10 p-3">
              {recoveryCodes.map((code) => (
                <div
                  key={code}
                  className="font-mono text-sm text-center py-2 select-all"
                >
                  {code}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(recoveryCodes.join('\n'));
                setSuccessMsg('Recovery codes copied. Store them safely.');
              }}
              className="w-full rounded-xl py-3 border border-emerald-500 text-emerald-500 text-sm font-bold flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> Copy Recovery Codes
            </button>

            <p className="text-[10px] opacity-60 text-center">
              After saving these codes, sign in with your Authenticator App code.
            </p>

            <button
              type="button"
              onClick={() => {
                setStep('login-2fa');
                setIsRegisterMode(false);
                setAuthenticatorCode('');
                setUseRecoveryCode(false);
                setRecoveryCodes([]);
                setSuccessMsg('Enter your Authenticator code to sign in.');
              }}
              className={buttonClass}
            >
              Continue to Sign In
            </button>
          </div>
        )}

        {step === 'login-2fa' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <button type="button" onClick={goBack} className="text-xs opacity-60 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <KeyRound className="w-10 h-10 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-center">
              Two-Step Login
            </h2>
            <p className="text-xs opacity-60 text-center">
              Sign in as {cleanCustomId()} using your second factor.
            </p>

            {useRecoveryCode ? (
              <input
                className={inputClass}
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="One-time recovery code"
                required
              />
            ) : (
              <input
                className={`${inputClass} text-center tracking-[0.5em] text-xl`}
                inputMode="numeric"
                maxLength={6}
                value={authenticatorCode}
                onChange={(e) =>
                  setAuthenticatorCode(
                    e.target.value.replace(/\D/g, '').slice(0, 6)
                  )
                }
                placeholder="6-digit code"
                required
              />
            )}

            <button
              type="button"
              onClick={() => setUseRecoveryCode(!useRecoveryCode)}
              className="w-full text-xs text-emerald-500 font-semibold"
            >
              {useRecoveryCode
                ? 'Use Authenticator App instead'
                : 'Use a recovery code instead'}
            </button>

            <button className={buttonClass} disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Secure Sign In'}
            </button>
          </form>
        )}

        {step === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <button type="button" onClick={goBack} className="text-xs opacity-60 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <h2 className="text-lg font-bold text-center">
              Reset Password
            </h2>
            <p className="text-xs opacity-60 text-center">
              Verify with your Authenticator App or an unused recovery code.
              SMS OTP is not used for password recovery.
            </p>

            {useRecoveryCode ? (
              <input
                className={inputClass}
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="One-time recovery code"
                required
              />
            ) : (
              <input
                className={`${inputClass} text-center tracking-[0.5em] text-xl`}
                inputMode="numeric"
                maxLength={6}
                value={authenticatorCode}
                onChange={(e) =>
                  setAuthenticatorCode(
                    e.target.value.replace(/\D/g, '').slice(0, 6)
                  )
                }
                placeholder="6-digit Authenticator code"
                required
              />
            )}

            <button
              type="button"
              onClick={() => setUseRecoveryCode(!useRecoveryCode)}
              className="w-full text-xs text-emerald-500 font-semibold"
            >
              {useRecoveryCode
                ? 'Use Authenticator App instead'
                : 'Use a recovery code instead'}
            </button>

            <input
              className={inputClass}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (minimum 8 characters)"
              minLength={8}
              required
            />

            <button className={buttonClass} disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="mt-7 pt-4 border-t border-slate-500/20 text-center">
          <p className="text-[10px] opacity-50">
            ChatNova • Secure Identity • Registration SMS is one-time only
          </p>
        </div>
      </div>
    </div>
  );
};
