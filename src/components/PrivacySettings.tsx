
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
  Lock,
  CircleDot
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
  statusVisibility: 'contacts',
  readReceipts: true,
  groupInvitePermission: 'everyone'
};

const PrivacySettings: React.FC<PrivacySettingsProps> = ({
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
        setSettings({
          ...DEFAULT_SETTINGS,
          ...result.settings
        });
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

    try {
      const result = await privacyAPI.update(settings);

      if (result.success && result.settings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...result.settings
        });
        setSuccessMessage('Privacy settings saved successfully.');
      } else {
        setErrorMessage(
          result.message || 'Unable to save privacy settings.'
        );
      }
    } catch {
      setErrorMessage('Unable to connect to ChatNova server.');
    } finally {
      setSaving(false);
    }
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
      | 'onlineStatusVisibility'
      | 'statusVisibility',
    Icon: React.ElementType
  ) => (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 border-b border-slate-500/15 w-full min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-slate-400 mt-1 break-words">
            {description}
          </p>
        </div>
      </div>

      <select
        value={settings[field]}
        onChange={event =>
          updateField(
            field,
            event.target.value as PrivacySettingsData[typeof field]
          )
        }
        className={`w-[112px] max-w-full rounded-lg border px-2 py-2 text-xs outline-none focus:border-emerald-500 ${fieldClass}`}
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 border-b border-slate-500/15 w-full min-w-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-400 mt-1 break-words">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-label={title}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
          checked ? 'bg-emerald-600' : 'bg-slate-500'
        }`}
      >
        <span
          className={`absolute top-1 left-0 w-5 h-5 rounded-full bg-white shadow transition-transform ${
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
        className={`w-full max-w-lg max-h-[92dvh] overflow-y-auto overflow-x-hidden rounded-2xl border shadow-2xl ${panelClass}`}
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
            className="p-2 rounded-full hover:bg-slate-500/20 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="min-w-0">
            <h2 className="font-bold text-lg">Privacy & Security</h2>
            <p className="text-xs text-slate-400">
              Control your privacy preferences
            </p>
          </div>
        </header>

        <div className="p-4 sm:p-5 min-w-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm mt-3">Loading privacy settings...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-emerald-500 shrink-0" />
                <h3 className="text-sm font-bold">
                  Who can see my information
                </h3>
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

              {renderVisibility(
                'Status',
                'Who can see your 24-hour status updates',
                'statusVisibility',
                CircleDot
              )}

              <div className="flex items-center gap-2 mt-6 mb-2">
                <Lock className="w-4 h-4 text-emerald-500 shrink-0" />
                <h3 className="text-sm font-bold">Messaging Privacy</h3>
              </div>

              {renderToggle(
                'Read Receipts',
                'Choose whether to share read receipt preference',
                settings.readReceipts,
                value => updateField('readReceipts', value)
              )}

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 w-full min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-500" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Group Invites</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Who can add you to groups
                    </p>
                  </div>
                </div>

                <select
                  value={settings.groupInvitePermission}
                  onChange={event =>
                    updateField(
                      'groupInvitePermission',
                      event.target.value as 'everyone' | 'contacts'
                    )
                  }
                  className={`w-[112px] max-w-full rounded-lg border px-2 py-2 text-xs outline-none focus:border-emerald-500 ${fieldClass}`}
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                </select>
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 mt-4">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Status visibility preference is saved here. Status access
                  enforcement will be connected in the status service.
                  Other privacy controls may also need separate enforcement.
                </p>
              </div>

              {successMessage && (
                <div className="flex items-center gap-2 rounded-xl p-3 mt-4 bg-emerald-500/10 text-emerald-500 text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-xl p-3 mt-4 bg-rose-500/10 text-rose-500 text-sm break-words">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
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

export { PrivacySettings };
export default PrivacySettings;
