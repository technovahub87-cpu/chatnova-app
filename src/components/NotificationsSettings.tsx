
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  MessageSquare,
  Users,
  Phone,
  CircleDot,
  Volume2,
  Vibrate,
  Eye,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

import { useTheme } from '../context/ThemeContext';
import {
  notificationAPI,
  NotificationSettingsData
} from '../services/notificationAPI';

interface NotificationsSettingsProps {
  onClose: () => void;
}

const DEFAULT_SETTINGS: NotificationSettingsData = {
  messageNotifications: true,
  groupNotifications: true,
  callNotifications: true,
  statusNotifications: true,
  notificationSound: true,
  vibration: true,
  messagePreview: true
};

const OPTIONS: {
  key: keyof NotificationSettingsData;
  title: string;
  description: string;
  Icon: React.ElementType;
}[] = [
  {
    key: 'messageNotifications',
    title: 'Message Notifications',
    description: 'Receive alerts for new messages',
    Icon: MessageSquare
  },
  {
    key: 'groupNotifications',
    title: 'Group Notifications',
    description: 'Receive alerts from group conversations',
    Icon: Users
  },
  {
    key: 'callNotifications',
    title: 'Call Notifications',
    description: 'Receive incoming call alerts',
    Icon: Phone
  },
  {
    key: 'statusNotifications',
    title: 'Status Notifications',
    description: 'Get notified about new status updates',
    Icon: CircleDot
  },
  {
    key: 'notificationSound',
    title: 'Notification Sound',
    description: 'Play a sound when a notification arrives',
    Icon: Volume2
  },
  {
    key: 'vibration',
    title: 'Vibration',
    description: 'Vibrate when a notification arrives',
    Icon: Vibrate
  },
  {
    key: 'messagePreview',
    title: 'Message Preview',
    description: 'Show message text in notifications',
    Icon: Eye
  }
];

const NotificationsSettings: React.FC<NotificationsSettingsProps> = ({
  onClose
}) => {
  const { isDark } = useTheme();

  const [settings, setSettings] =
    useState<NotificationSettingsData>(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] =
    useState<keyof NotificationSettingsData | null>(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      setLoading(true);
      setErrorMessage('');

      const result = await notificationAPI.get();

      if (!active) return;

      if (result.success && result.settings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...result.settings
        });
      } else {
        setErrorMessage(
          result.message || 'Unable to load notification settings.'
        );
      }

      setLoading(false);
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const handleToggle = async (
    key: keyof NotificationSettingsData
  ) => {
    if (savingKey) return;

    const previousValue = settings[key];
    const nextValue = !previousValue;

    setSettings(previous => ({
      ...previous,
      [key]: nextValue
    }));

    setSavingKey(key);
    setSuccessMessage('');
    setErrorMessage('');

    const result = await notificationAPI.update({
      [key]: nextValue
    });

    if (result.success && result.settings) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...result.settings
      });
      setSuccessMessage('Notification setting saved.');
    } else {
      setSettings(previous => ({
        ...previous,
        [key]: previousValue
      }));

      setErrorMessage(
        result.message || 'Could not save this setting.'
      );
    }

    setSavingKey(null);
  };

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 ${
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

          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-emerald-500" />
          </div>

          <div>
            <h2 className="font-bold text-lg">Notifications</h2>
            <p className="text-xs text-slate-400">
              Manage your notification preferences
            </p>
          </div>
        </header>

        <div className="p-4 sm:p-5 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
              <p className="text-sm text-slate-400">
                Loading your settings...
              </p>
            </div>
          ) : (
            <>
              <div className={`rounded-xl border p-3 mb-4 ${
                isDark
                  ? 'bg-[#202c33] border-slate-700'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <p className="text-xs text-slate-400">
                  Changes are saved automatically to your ChatNova account.
                </p>
              </div>

              {OPTIONS.map(({ key, title, description, Icon }) => {
                const enabled = settings[key];
                const busy = savingKey === key;

                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      isDark
                        ? 'bg-[#202c33] border-slate-700'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-emerald-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {title}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {description}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={title}
                      disabled={!!savingKey}
                      onClick={() => handleToggle(key)}
                      className={`relative w-12 h-7 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                        enabled ? 'bg-emerald-600' : 'bg-slate-500'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      {busy && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}

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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsSettings;
