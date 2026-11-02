
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  User,
  AtSign,
  Info,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Camera,
  Trash2,
  ShieldCheck
} from 'lucide-react';

import { User as ChatNovaUser } from '../types';
import { authAPI, API_BASE_URL } from '../services/api';
import { profileImageAPI } from '../services/profileImageAPI';
import { useTheme } from '../context/ThemeContext';
import PrivacySettings from './PrivacySettings';

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

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [displayName, setDisplayName] = useState(
    currentUser.displayName || ''
  );
  const [bio, setBio] = useState(currentUser.bio || '');
  const [photoPreview, setPhotoPreview] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const resolveAvatarUrl = (avatar: string) => {
    if (!avatar) return '';
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    const base = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${base}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
  };

  useEffect(() => {
    setDisplayName(currentUser.displayName || '');
    setBio(currentUser.bio || '');
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handlePhotoSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Photo must be 2 MB or smaller.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Only JPG, PNG and WEBP photos are allowed.');
      return;
    }

    setSelectedFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a photo first.');
      return;
    }

    setPhotoSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await profileImageAPI.upload(selectedFile);

      if (!result.success || !result.avatar) {
        setErrorMessage(result.message || 'Photo upload failed.');
        return;
      }

      const updatedUser: ChatNovaUser = {
        ...currentUser,
        avatar: resolveAvatarUrl(result.avatar)
      };

      onUpdateUser(updatedUser);
      setSelectedFile(null);
      setPhotoPreview('');
      setSuccessMessage('Profile photo updated successfully.');
    } catch {
      setErrorMessage('Unable to upload photo. Please try again.');
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!currentUser.avatar && !selectedFile) {
      setErrorMessage('There is no profile photo to remove.');
      return;
    }

    setRemovingPhoto(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await profileImageAPI.remove();

      if (!result.success) {
        setErrorMessage(result.message || 'Photo removal failed.');
        return;
      }

      const updatedUser: ChatNovaUser = {
        ...currentUser,
        avatar: ''
      };

      onUpdateUser(updatedUser);
      setSelectedFile(null);
      setPhotoPreview('');
      setSuccessMessage('Profile photo removed successfully.');
    } catch {
      setErrorMessage('Unable to remove photo. Please try again.');
    } finally {
      setRemovingPhoto(false);
    }
  };

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
        setErrorMessage(result.message || 'Profile could not be updated.');
        return;
      }

      const responseData: any = result.data;
      const savedUser = responseData.user || responseData;

      const updatedUser: ChatNovaUser = {
        ...currentUser,
        displayName: savedUser.displayName || cleanName,
        bio: savedUser.bio ?? cleanBio
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

  const visiblePhoto =
    photoPreview || resolveAvatarUrl(currentUser.avatar);

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
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition hover:border-emerald-500 ${
              isDark
                ? 'border-slate-700 bg-[#202c33]'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Privacy & Security</p>
              <p className="text-xs text-slate-400 mt-1">
                Last Seen, Profile Photo, Read Receipts and more
              </p>
            </div>
            <span className="text-emerald-500 text-sm font-semibold">
              Open
            </span>
          </button>

          <div className="flex flex-col items-center py-3">
            <div className="relative">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-emerald-500/30 bg-emerald-600 flex items-center justify-center">
                {visiblePhoto ? (
                  <img
                    src={visiblePhoto}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-14 h-14 text-white" />
                )}
              </div>

              <label
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer border-2 border-white"
                title="Choose profile photo"
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            </div>

            <p className="font-semibold mt-3">
              {currentUser.displayName}
            </p>

            <p className="text-xs text-emerald-500 mt-1">
              {currentUser.customId}
            </p>

            <p className="text-[11px] text-slate-400 mt-2">
              JPG, PNG or WEBP · Maximum 2 MB
            </p>

            {selectedFile && (
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handlePhotoUpload}
                  disabled={photoSaving}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2"
                >
                  {photoSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {photoSaving ? 'Uploading...' : 'Upload Photo'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPhotoPreview('');
                  }}
                  className="rounded-lg border border-slate-500/40 px-3 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}

            {!selectedFile && currentUser.avatar && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={removingPhoto}
                className="flex items-center gap-2 mt-3 text-sm text-rose-500 hover:text-rose-400 disabled:opacity-60"
              >
                {removingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Remove Photo
              </button>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <User className="w-4 h-4 text-emerald-500" />
              Display Name
            </label>

            <input
              type="text"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
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
              onChange={event => setBio(event.target.value)}
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

      {showPrivacy && (
        <PrivacySettings onClose={() => setShowPrivacy(false)} />
      )}
    </div>
  );
};

export default ProfileSettings;
