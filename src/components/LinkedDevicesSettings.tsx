
import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Laptop,
  Smartphone,
  RefreshCw,
  Trash2,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

import { linkedDevicesAPI } from '../services/linkedDevicesAPI';
import { useTheme } from '../context/ThemeContext';

interface Device {
  _id: string;
  deviceName: string;
  browser: string;
  operatingSystem: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface Props {
  onClose: () => void;
}

export const LinkedDevicesSettings: React.FC<Props> = ({
  onClose
}) => {
  const { isDark } = useTheme();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError('');

    const result: any = await linkedDevicesAPI.getDevices();

    if (!result.success) {
      setError(result.message || 'Unable to load linked devices.');
      setLoading(false);
      return;
    }

    setDevices(
      Array.isArray(result.sessions) ? result.sessions : []
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const removeDevice = async (device: Device) => {
    if (device.isCurrent) {
      setError('You cannot remove the device you are currently using.');
      return;
    }

    const confirmed = window.confirm(
      `Remove ${device.deviceName} from your linked devices?`
    );

    if (!confirmed) return;

    setRemovingId(device._id);
    setError('');
    setSuccess('');

    const result: any = await linkedDevicesAPI.removeDevice(
      device._id
    );

    if (!result.success) {
      setError(result.message || 'Could not remove this device.');
    } else {
      setDevices(previous =>
        previous.filter(item => item._id !== device._id)
      );
      setSuccess('Device removed successfully.');
    }

    setRemovingId('');
  };

  const formatDate = (value: string) => {
    if (!value) return 'Unknown';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Unknown';

    return date.toLocaleString();
  };

  const cardClass = isDark
    ? 'bg-[#202c33] border-slate-700 text-white'
    : 'bg-white border-slate-200 text-slate-900';

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

          <div className="flex-1">
            <h2 className="font-bold text-lg">Linked Devices</h2>
            <p className="text-xs text-slate-400">
              Manage devices connected to your account
            </p>
          </div>

          <button
            type="button"
            onClick={loadDevices}
            disabled={loading}
            title="Refresh devices"
            className="p-2 rounded-full hover:bg-slate-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <div className={`rounded-xl border p-4 ${cardClass}`}>
            <div className="flex gap-3 items-start">
              <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  Account security
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Review your active sessions. Remove any device you
                  no longer recognize.
                </p>
              </div>
            </div>
          </div>

          {success && (
            <div className="flex items-center gap-2 rounded-xl p-3 bg-emerald-500/10 text-emerald-500 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl p-3 bg-rose-500/10 text-rose-500 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3" />
              Loading linked devices...
            </div>
          ) : devices.length === 0 ? (
            <div className={`rounded-xl border p-6 text-center ${cardClass}`}>
              <Laptop className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="font-semibold text-sm">
                No linked devices found
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Your active login sessions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map(device => (
                <div
                  key={device._id}
                  className={`rounded-xl border p-4 ${cardClass}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      {device.operatingSystem === 'Android' ||
                      device.operatingSystem === 'iOS' ? (
                        <Smartphone className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Laptop className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-sm">
                          {device.deviceName || 'Unknown Device'}
                        </p>

                        {device.isCurrent && (
                          <span className="text-[10px] rounded-full px-2 py-1 bg-emerald-500/10 text-emerald-500 font-semibold">
                            This device
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1">
                        {device.browser} · {device.operatingSystem}
                      </p>

                      <p className="text-[11px] text-slate-400 mt-2">
                        Last active: {formatDate(device.lastActiveAt)}
                      </p>

                      <p className="text-[11px] text-slate-400 mt-1">
                        Added: {formatDate(device.createdAt)}
                      </p>
                    </div>

                    {!device.isCurrent && (
                      <button
                        type="button"
                        onClick={() => removeDevice(device)}
                        disabled={removingId === device._id}
                        title="Remove device"
                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        {removingId === device._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Removing a device revokes its ChatNova session. The device
            will need to log in again.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LinkedDevicesSettings;
