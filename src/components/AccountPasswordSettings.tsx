
import React, { useState } from 'react';
import {
  ArrowLeft,
  LockKeyhole,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  LogOut
} from 'lucide-react';

import { useTheme } from '../context/ThemeContext';
import { accountPasswordAPI } from '../services/accountPasswordAPI';
import { removeAuthToken } from '../services/api';

interface AccountPasswordSettingsProps {
  onClose: () => void;
}

const AccountPasswordSettings: React.FC<AccountPasswordSettingsProps> = ({
  onClose
}) => {
  const { isDark } = useTheme();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authenticatorCode, setAuthenticatorCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [passwordChanged, setPasswordChanged] = useState(false);

  const inputClass = `w-full rounded-xl border px-4 py-3 outline-none focus:border-emerald-500 ${
    isDark
      ? 'bg-[#202c33] border-slate-700 text-white'
      : 'bg-slate-50 border-slate-200 text-slate-900'
  }`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (newPassword.length < 8 || newPassword.length > 128) {
      setErrorMessage('New password must contain 8 to 128 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and Confirm Password do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage('New password must be different from current password.');
      return;
    }

    if (useRecoveryCode) {
      if (!recoveryCode.trim()) {
        setErrorMessage('Please enter an unused Recovery Code.');
        return;
      }
    } else if (!/^\d{6}$/.test(authenticatorCode.trim())) {
      setErrorMessage('Please enter a valid 6-digit Authenticator code.');
      return;
    }

    setSaving(true);

    try {
      const result = await accountPasswordAPI.changePassword({
        currentPassword,
        newPassword,
        ...(useRecoveryCode
          ? { recoveryCode: recoveryCode.trim() }
          : { authenticatorCode: authenticatorCode.trim() })
      });

      if (!result.success) {
        setErrorMessage(result.message || 'Password change failed.');
        return;
      }

      setSuccessMessage(
        result.message ||
        'Password changed. All devices have been signed out.'
      );

      setPasswordChanged(true);
    } catch {
      setErrorMessage('Unable to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSecureLogout = () => {
    removeAuthToken();
    window.location.reload();
  };

  return (
    <div
      className={`fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6 ${
        isDark ? 'bg-black/70' : 'bg-slate-900/40'
      }`}
    >
      <div
        className={`w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border shadow-2xl ${
          isDark
            ? 'bg-[#111b21] border-slate-700 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <header
          className={`sticky top-0 z-10 flex items-center gap-3 p-4 border-b ${
            isDark
              ? 'bg-[#202c33] border-slate-700'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={passwordChanged}
            className="p-2 rounded-full hover:bg-slate-500/20 disabled:opacity-40"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h2 className="font-bold text-lg">Account & Password</h2>
            <p className="text-xs text-slate-400">
              Change your ChatNova account password
            </p>
          </div>
        </header>

        <div className="p-5 space-y-5">
          {passwordChanged ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center py-5">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-emerald-500" />
                </div>

                <h3 className="font-bold text-lg mt-4">
                  Password Changed Successfully
                </h3>

                <p className="text-sm text-slate-400 mt-2">
                  All previously logged-in devices have been signed out.
                  Please log in again using your new password and
                  Authenticator code.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSecureLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3"
              >
                <LogOut className="w-4 h-4" />
                Continue to Login
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  Secure Password Change
                </div>

                <p className="text-xs text-slate-400 mt-2">
                  Your current password and Authenticator verification
                  are required to protect your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Current Password
                  </label>

                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={event => setCurrentPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      className={`${inputClass} pr-12`}
                      placeholder="Enter current password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-label="Toggle current password visibility"
                    >
                      {showCurrent
                        ? <EyeOff className="w-5 h-5" />
                        : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    New Password
                  </label>

                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={event => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      className={`${inputClass} pr-12`}
                      placeholder="Enter new password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-label="Toggle new password visibility"
                    >
                      {showNew
                        ? <EyeOff className="w-5 h-5" />
                        : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    Minimum 8 characters, maximum 128 characters.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Confirm New Password
                  </label>

                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={event => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                      className={`${inputClass} pr-12`}
                      placeholder="Re-enter new password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirm
                        ? <EyeOff className="w-5 h-5" />
                        : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-500/20 pt-4">
                  <label className="block text-sm font-semibold mb-3">
                    Security Verification
                  </label>

                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setUseRecoveryCode(false);
                        setErrorMessage('');
                      }}
                      className={`flex-1 rounded-lg border py-2 px-2 text-xs font-semibold ${
                        !useRecoveryCode
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                          : 'border-slate-500/30'
                      }`}
                    >
                      Authenticator Code
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUseRecoveryCode(true);
                        setErrorMessage('');
                      }}
                      className={`flex-1 rounded-lg border py-2 px-2 text-xs font-semibold ${
                        useRecoveryCode
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                          : 'border-slate-500/30'
                      }`}
                    >
                      Recovery Code
                    </button>
                  </div>

                  {useRecoveryCode ? (
                    <input
                      type="text"
                      value={recoveryCode}
                      onChange={event => setRecoveryCode(event.target.value)}
                      autoComplete="off"
                      required
                      className={inputClass}
                      placeholder="Enter unused Recovery Code"
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={authenticatorCode}
                      onChange={event =>
                        setAuthenticatorCode(
                          event.target.value.replace(/\D/g, '').slice(0, 6)
                        )
                      }
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      className={`${inputClass} tracking-[0.35em] text-center`}
                      placeholder="000000"
                    />
                  )}

                  <p className="text-xs text-slate-400 mt-2">
                    {useRecoveryCode
                      ? 'Each recovery code can be used only once.'
                      : 'Enter the current 6-digit code from your Authenticator App.'}
                  </p>
                </div>

                {successMessage && (
                  <div className="flex items-center gap-2 rounded-xl p-3 bg-emerald-500/10 text-emerald-500 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    {successMessage}
                  </div>
                )}

                {errorMessage && (
                  <div className="flex items-center gap-2 rounded-xl p-3 bg-rose-500/10 text-rose-500 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-3"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LockKeyhole className="w-4 h-4" />
                  )}
                  {saving ? 'Changing Password...' : 'Change Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountPasswordSettings;
