
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Eye,
  Camera,
  Info,
  Wifi,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Save,
  Lock
} from 'lucide-react';

import { useTheme } from '../context/ThemeContext';
import {
  privacyAPI,
  PrivacySettingsData
} from '../services/privacyAPI';

interface PrivacySettingsProps {
  onClose: () => void;
}

const DEFAULT_SETTINGS: PrivacySettingsData = {
  lastSeenVisibility: 'everyone',
  profilePhotoVisibility: 'everyone',
  aboutVisibility: 'everyone',
  onlineStatusVisibility: 'everyone',
  readReceipts: true,
  groupInvitePermission: 'everyone'
};

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  onClose
}) => {
  const { isDark } = useTheme();

  const [settings, setSettings] =
    useState<PrivacySettingsData>(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      setLoading(true);
      setErrorMessage('');

      const result = await privacyAPI.get();

      if (!active) return;

      if (result.success && result.settings) {
        setSettings(result.settings);
      } else {
        setErrorMessage(
          result.message || 'Privacy settings could not be loaded.'
        );
      }

      setLoading(false);
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const updateField = <K extends keyof PrivacySettingsData>(
    field: K,
    value: PrivacySettingsData[K]
  ) => {
    setSettings(previous => ({
      ...previous,
      [field]: value
    }));

    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    const result = await privacyAPI.update(settings);

    if (result.success && result.settings) {
      setSettings(result.settings);
      setSuccessMessage('Privacy settings saved successfully.');
    } else {
      setErrorMessage(
        result.message || 'Unable to save privacy settings.'
      );
    }

    setSaving(false);
  };

  const panelClass = isDark
    ? 'bg-[#111b21] border-slate-700 text-white'
    : 'bg-white border-slate-200 text-slate-900';

  const fieldClass = isDark
    ? 'bg-[#202c33] border-slate-700 text-white'
    : 'bg-slate-50 border-slate-200 text-slate-900';

  const visibilityOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'contacts', label: 'My Contacts' },
    { value: 'nobody', label: 'Nobody' }
  ];

  const renderVisibility = (
    title: string,
    description: string,
    field:
      | 'lastSeenVisibility'
      | 'profilePhotoVisibility'
      | 'aboutVisibility'
      | 'onlineStatusVisibility',
    Icon: React.ElementType
  ) => (
    <div className="flex items-center gap-3 py-4 border-b border-slate-500/15">
      <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-emerald-500" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>

      <select
        value={settings[field]}
        onChange={event =>
          updateField(field, event.target.value as PrivacySettingsData[typeof field])
        }
        className={`max-w-[125px] rounded-lg border px-2 py-2 text-xs outline-none focus:border-emerald-500 ${fieldClass}`}
      >
        {visibilityOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const renderToggle = (
    title: string,
    description: string,
    checked: boolean,
    onChange: (value: boolean) => void
  ) => (
    <div className="flex items-center gap-3 py-4 border-b border-slate-500/15">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-emerald-600' : 'bg-slate-500'
        }`}
      >
        <span
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 ${
        isDark ? 'bg-black/70' : 'bg-slate-900/40'
      }`}
    >
      <div
        className={`w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border shadow-2xl ${panelClass}`}
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

          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>

          <div>
            <h2 className="font-bold text-lg">Privacy & Security</h2>
            <p className="text-xs text-slate-400">
              Control your privacy preferences
            </p>
          </div>
        </header>

        <div className="p-5">
          {loading ? (
            <div className="py-16 flex flex-col items-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm mt-3">Loading privacy settings...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold">Who can see my information</h3>
              </div>

              {renderVisibility(
                'Last Seen',
                'Who can see when you were last active',
                'lastSeenVisibility',
                Eye
              )}

              {renderVisibility(
                'Profile Photo',
                'Who can see your profile picture',
                'profilePhotoVisibility',
                Camera
              )}

              {renderVisibility(
                'About',
                'Who can read your About information',
                'aboutVisibility',
                Info
              )}

              {renderVisibility(
                'Online Status',
                'Who can see when you are online',
                'onlineStatusVisibility',
                Wifi
              )}

              <div className="flex items-center gap-2 mt-6 mb-2">
                <Lock className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold">Messaging Privacy</h3>
              </div>

              {renderToggle(
                'Read Receipts',
                'Choose whether to share read receipt preference',
                settings.readReceipts,
                value => updateField('readReceipts', value)
              )}

              <div className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-500" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Group Invites</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Who can add you to groups
                  </p>
                </div>

                <select
                  value={settings.groupInvitePermission}
                  onChange={event =>
                    updateField(
                      'groupInvitePermission',
                      event.target.value as 'everyone' | 'contacts'
                    )
                  }
                  className={`max-w-[125px] rounded-lg border px-2 py-2 text-xs outline-none focus:border-emerald-500 ${fieldClass}`}
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                </select>
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 mt-4">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  These preferences are saved to your account. Their effect on profile visibility, group invitations and message read receipts will be connected in the next implementation step.
                </p>
              </div>

              {successMessage && (
                <div className="flex items-center gap-2 rounded-xl p-3 mt-4 bg-emerald-500/10 text-emerald-500 text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-xl p-3 mt-4 bg-rose-500/10 text-rose-500 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-3 mt-5"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Privacy Settings'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrivacySettings;
