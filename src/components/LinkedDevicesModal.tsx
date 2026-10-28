import React, { useState, useEffect, useRef } from 'react';
import {
  Laptop,
  Monitor,
  Tablet,
  Globe,
  QrCode,
  Camera,
  ScanLine,
  RefreshCw,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  Lock,
  Smartphone,
  Wifi,
  ExternalLink,
  ChevronRight,
  Sun,
  Moon,
  Zap,
  Info
} from 'lucide-react';
import { LinkedDevice, User } from '../types';
import { INITIAL_LINKED_DEVICES } from '../data/mockData';
import { wsService } from '../services/websocket';
import { useTheme } from '../context/ThemeContext';

interface LinkedDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

export const LinkedDevicesModal: React.FC<LinkedDevicesModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { isDark } = useTheme();

  // Devices state
  const [devices, setDevices] = useState<LinkedDevice[]>(() => {
    const saved = localStorage.getItem(`chatnova_linked_devices_${currentUser.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_LINKED_DEVICES;
      }
    }
    return INITIAL_LINKED_DEVICES;
  });

  // Modal sub-states
  const [activeView, setActiveView] = useState<'list' | 'scanner' | 'show_qr'>('list');
  const [selectedDeviceToLogout, setSelectedDeviceToLogout] = useState<LinkedDevice | null>(null);
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);

  // Scanner states
  const [scannerFlashlight, setScannerFlashlight] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [pairingSuccessDevice, setPairingSuccessDevice] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Desktop Show QR code states
  const [qrToken, setQrToken] = useState('CN-QR-' + Math.floor(100000 + Math.random() * 900000));
  const [qrTimer, setQrTimer] = useState(25);
  const [qrExpired, setQrExpired] = useState(false);

  // Sync animation toast
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Save devices in localStorage
  useEffect(() => {
    localStorage.setItem(`chatnova_linked_devices_${currentUser.id}`, JSON.stringify(devices));
  }, [devices, currentUser.id]);

  // QR token refresh countdown
  useEffect(() => {
    if (activeView === 'show_qr' && !qrExpired) {
      const interval = setInterval(() => {
        setQrTimer((prev) => {
          if (prev <= 1) {
            setQrExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeView, qrExpired]);

  // Manage real camera when entering scanner view
  useEffect(() => {
    if (activeView === 'scanner') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeView]);

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraActive(true);
      }
    } catch (e) {
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const refreshQRToken = () => {
    setQrToken('CN-QR-' + Math.floor(100000 + Math.random() * 900000) + '-' + Date.now().toString().slice(-4));
    setQrTimer(25);
    setQrExpired(false);
  };

  const handleLinkNewDevice = (deviceMeta?: Partial<LinkedDevice>) => {
    setIsPairing(true);

    setTimeout(() => {
      const detectedNames = [
        { name: 'MacBook Pro 14" (Apple M3)', type: 'laptop' as const, os: 'macOS Sonoma 14.6', browser: 'Safari 17.5' },
        { name: 'Google Chrome on Windows 11', type: 'browser' as const, os: 'Windows 11 Enterprise', browser: 'Chrome 126.0' },
        { name: 'Brave Browser on Linux x86_64', type: 'desktop' as const, os: 'Ubuntu 24.04 LTS', browser: 'Brave 1.66' },
        { name: 'iPad Pro 11" (M4)', type: 'tablet' as const, os: 'iPadOS 17.5', browser: 'ChatNova Companion' },
      ];

      const sample = deviceMeta || detectedNames[Math.floor(Math.random() * detectedNames.length)];

      const newDevice: LinkedDevice = {
        id: 'dev_' + Date.now(),
        name: sample.name || 'ChatNova Desktop Web',
        type: sample.type || 'browser',
        os: sample.os || 'Desktop OS',
        browser: sample.browser || 'Web Companion v2.4',
        location: 'Zurich, Switzerland',
        ipAddress: `194.230.${Math.floor(10 + Math.random() * 200)}.${Math.floor(10 + Math.random() * 200)}`,
        linkedAt: 'Just now',
        lastActive: 'Active now',
        fingerprint: `E2EE-DEV-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      };

      setDevices((prev) => [newDevice, ...prev]);
      setIsPairing(false);
      setPairingSuccessDevice(newDevice.name);

      wsService.emit('device:linked', {
        userId: currentUser.id,
        customId: currentUser.customId,
        device: newDevice,
      });

      setSyncNotice(`Device paired! Synchronizing 50 recent encrypted chats via multi-device ratchet.`);
      setTimeout(() => setSyncNotice(null), 4500);

      setTimeout(() => {
        setPairingSuccessDevice(null);
        setActiveView('list');
      }, 1400);
    }, 1200);
  };

  const handleLogoutDevice = (deviceId: string) => {
    const target = devices.find((d) => d.id === deviceId);
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    setSelectedDeviceToLogout(null);

    wsService.emit('device:unlinked', {
      userId: currentUser.id,
      deviceId,
      revokedAt: new Date().toISOString(),
    });

    setSyncNotice(`Session terminated. Keys revoked for ${target?.name || 'device'}.`);
    setTimeout(() => setSyncNotice(null), 3500);
  };

  const handleLogoutAllDevices = () => {
    setDevices([]);
    setShowLogoutAllConfirm(false);

    wsService.emit('device:unlinked_all', {
      userId: currentUser.id,
      revokedAt: new Date().toISOString(),
    });

    setSyncNotice('All companion sessions forcefully terminated and cryptographic ratchets revoked.');
    setTimeout(() => setSyncNotice(null), 4000);
  };

  const getDeviceIcon = (type: LinkedDevice['type']) => {
    switch (type) {
      case 'laptop':
        return <Laptop className="w-5 h-5 text-emerald-500" />;
      case 'desktop':
        return <Monitor className="w-5 h-5 text-teal-500" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-blue-500" />;
      default:
        return <Globe className="w-5 h-5 text-cyan-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl max-h-[92vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isDark
            ? 'bg-[#111b21] border-slate-800 text-slate-100 shadow-emerald-950/20'
            : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        }`}
      >
        {/* HEADER */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between shrink-0 transition-colors ${
            isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {activeView !== 'list' ? (
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className={`p-1.5 rounded-full transition cursor-pointer ${
                  isDark ? 'hover:bg-slate-700/60 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-900/20 text-white">
                <Laptop className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold leading-tight flex items-center gap-2">
                <span>Linked Devices</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  E2EE SYNC
                </span>
              </h2>
              <p className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {activeView === 'scanner'
                  ? 'Point camera at ChatNova Web QR'
                  : activeView === 'show_qr'
                  ? 'Scan with ChatNova mobile app'
                  : `${devices.length} Companion Session${devices.length === 1 ? '' : 's'} Active`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-full transition cursor-pointer ${
              isDark ? 'hover:bg-slate-700/60 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOAST SYNC NOTIFICATION */}
        {syncNotice && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2.5 flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-300 animate-in slide-in-from-top-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="truncate">{syncNotice}</span>
          </div>
        )}

        {/* BODY CONTENT */}
        <div className="flex-1 overflow-y-auto">
          {activeView === 'list' && (
            <div className="p-5 sm:p-6 space-y-6">
              <div
                className={`p-6 rounded-3xl border text-center transition-colors relative overflow-hidden ${
                  isDark
                    ? 'bg-gradient-to-b from-[#182833] to-[#111b21] border-slate-800'
                    : 'bg-gradient-to-b from-emerald-50/70 to-slate-50 border-emerald-100 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-inner">
                    <Smartphone className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="flex items-center gap-1 text-emerald-500/70 animate-pulse">
                    <Wifi className="w-4 h-4 rotate-90" />
                    <span className="text-[10px] font-mono font-bold tracking-widest">E2EE</span>
                    <Wifi className="w-4 h-4 -rotate-90" />
                  </div>
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-500 shadow-inner">
                    <Laptop className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                </div>

                <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Use ChatNova on All Your Devices
                </h3>
                <p className={`text-xs max-w-sm mx-auto mb-5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Mirror and sync your encrypted chats to laptops, browsers, and tablets. Your private keys never leave your devices.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveView('scanner')}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs tracking-wider uppercase shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Link a Device (Scan QR)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      refreshQRToken();
                      setActiveView('show_qr');
                    }}
                    className={`w-full sm:w-auto px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                      isDark
                        ? 'border-slate-700 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300'
                        : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs'
                    }`}
                  >
                    <Monitor className="w-4 h-4 text-teal-500" />
                    <span>Show Companion QR</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-[11px] uppercase tracking-wider font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Device Status ({devices.length} Active)
                  </h4>
                </div>

                <div className="space-y-2.5">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between group ${
                        isDark
                          ? 'bg-[#17242c] hover:bg-[#1d2d37] border-slate-800'
                          : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                            isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'
                          }`}
                        >
                          {getDeviceIcon(device.type)}
                        </div>
                        <div className="min-w-0">
                          <h5 className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {device.name}
                          </h5>
                          <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {device.browser ? `${device.browser} • ` : ''} {device.location}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLogoutDevice(device.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 shrink-0 ml-2"
                      >
                        Log Out
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === 'scanner' && (
            <div className="p-5 sm:p-6 flex flex-col items-center">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden border-2 border-emerald-500/50 bg-black shadow-2xl flex items-center justify-center">
                {cameraActive ? (
                  <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                    <QrCode className="w-32 h-32 text-emerald-400/80 animate-pulse" />
                  </div>
                )}
                {isPairing && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-20">
                    <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                    <span className="text-xs font-mono font-bold">LINKING DEVICE...</span>
                  </div>
                )}
              </div>

              <div className="mt-5 text-center max-w-sm space-y-3 w-full">
                <button
                  type="button"
                  disabled={isPairing}
                  onClick={() => handleLinkNewDevice()}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase shadow-lg transition cursor-pointer"
                >
                  Simulate Instant QR Scan & Link
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className="w-full py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer text-slate-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {activeView === 'show_qr' && (
            <div className="p-5 sm:p-6 flex flex-col items-center">
              <div className="p-5 rounded-3xl bg-white text-slate-950 border shadow-2xl flex flex-col items-center justify-center">
                <div className="relative w-52 h-52 sm:w-60 sm:h-60 bg-white flex items-center justify-center rounded-2xl overflow-hidden p-2">
                  <QrCode className="w-40 h-40 text-emerald-600" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border-2 border-emerald-500 flex items-center justify-center text-white shadow-lg">
                      <Lock className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300"
              >
                Back to Devices
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
