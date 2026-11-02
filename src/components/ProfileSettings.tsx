
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  User,
  AtSign,
  Info,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

import { User as ChatNovaUser } from '../types';
import { authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

interface ProfileSettingsProps {
  currentUser: ChatNovaUser;
  onClose: () => void;
  onUpdateUser: (updatedUser: ChatNovaUser) => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  currentUser,
  onClose,
  onUpdateUser
}) => {
  const { isDark } = useTheme();

  const [displayName, setDisplayName] = useState(
    currentUser.displayName || ''
  );

  const [bio, setBio] = useState(
    currentUser.bio || ''
  );

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setDisplayName(currentUser.displayName || '');
    setBio(currentUser.bio || '');
  }, [currentUser]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanName = displayName.trim();
    const cleanBio = bio.trim();

    if (!cleanName || cleanName.length > 50) {
      setErrorMessage('Name must be between 1 and 50 characters.');
      return;
    }

    if (cleanBio.length > 160) {
      setErrorMessage('About cannot exceed 160 characters.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await authAPI.updateProfile({
        displayName: cleanName,
        bio: cleanBio
      });

      if (!result.success || !result.data) {
        setErrorMessage(
          result.message || 'Profile could not be updated.'
        );
        return;
      }

      const responseData: any = result.data;
      const savedUser = responseData.user || responseData;

      const updatedUser: ChatNovaUser = {
        ...currentUser,
        displayName: savedUser.displayName || cleanName,
        bio: savedUser.bio ?? cleanBio,
        avatar: savedUser.avatar || currentUser.avatar
      };

      onUpdateUser(updatedUser);
      setDisplayName(updatedUser.displayName);
      setBio(updatedUser.bio);
      setSuccessMessage('Profile updated successfully.');
    } catch {
      setErrorMessage('Unable to connect to ChatNova server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 ${
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
            className="p-2 rounded-full hover:bg-slate-500/20"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h2 className="font-bold text-lg">Profile</h2>
            <p className="text-xs text-slate-400">
              Manage your ChatNova information
            </p>
          </div>
        </header>

        <form onSubmit={handleSave} className="p-5 space-y-5">
          <div className="flex flex-col items-center py-3">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-emerald-500/30 bg-emerald-600 flex items-center justify-center">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-white" />
              )}
            </div>

            <p className="font-semibold mt-3">
              {currentUser.displayName}
            </p>

            <p className="text-xs text-emerald-500 mt-1">
              {currentUser.customId}
            </p>

            <p className="text-[11px] text-slate-400 mt-2">
              Profile photo editing will be added with secure media storage.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <User className="w-4 h-4 text-emerald-500" />
              Display Name
            </label>

            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={50}
              required
              placeholder="Enter your name"
              className={`w-full rounded-xl border px-4 py-3 outline-none focus:border-emerald-500 ${
                isDark
                  ? 'bg-[#202c33] border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />

            <p className="text-right text-[10px] text-slate-400 mt-1">
              {displayName.length}/50
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <AtSign className="w-4 h-4 text-emerald-500" />
              ChatNova ID
            </label>

            <div
              className={`w-full rounded-xl border px-4 py-3 text-sm opacity-70 ${
                isDark
                  ? 'bg-[#202c33] border-slate-700'
                  : 'bg-slate-100 border-slate-200'
              }`}
            >
              {currentUser.customId}
            </div>

            <p className="text-[10px] text-slate-400 mt-1">
              Your unique ChatNova ID cannot be changed here.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Info className="w-4 h-4 text-emerald-500" />
              About
            </label>

            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Write something about yourself..."
              className={`w-full rounded-xl border px-4 py-3 outline-none resize-none focus:border-emerald-500 ${
                isDark
                  ? 'bg-[#202c33] border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />

            <p className="text-right text-[10px] text-slate-400 mt-1">
              {bio.length}/160
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
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-3 transition"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}

            {saving ? 'Saving Profile...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
