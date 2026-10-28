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
      // Permission denied or no camera: use realistic simulated optical viewfinder
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

  // Perform device pairing handshake
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

      // Emit WebSocket event to sync multi-device sessions
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

  // Log out a specific device
  const handleLogoutDevice = (deviceId: string) => {
    const target = devices.find((d) => d.id === deviceId);
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    setSelectedDeviceToLogout(null);

    // Notify backend WebSocket
    wsService.emit('device:unlinked', {
      userId: currentUser.id,
      deviceId,
      revokedAt: new Date().toISOString(),
    });

    setSyncNotice(`Session terminated. Keys revoked for ${target?.name || 'device'}.`);
    setTimeout(() => setSyncNotice(null), 3500);
  };

  // Log out from all devices
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
          {/* ==================================================== */}
          {/* 1. MAIN LIST VIEW                                    */}
          {/* ==================================================== */}
          {activeView === 'list' && (
            <div className="p-5 sm:p-6 space-y-6">
              {/* WHATSAPP-STYLE HERO ILLUSTRATION */}
              <div
                className={`p-6 rounded-3xl border text-center transition-colors relative overflow-hidden ${
                  isDark
                    ? 'bg-gradient-to-b from-[#182833] to-[#111b21] border-slate-800'
                    : 'bg-gradient-to-b from-emerald-50/70 to-slate-50 border-emerald-100 shadow-sm'
                }`}
              >
                {/* Decorative devices diagram */}
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

                {/* Primary CTA: LINK A DEVICE BUTTON */}
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

              {/* SECURITY ENCLAVE PILL */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center gap-3 text-xs ${
                  isDark ? 'bg-[#14232f] border-emerald-500/20' : 'bg-emerald-50/60 border-emerald-200'
                }`}
              >
                <Lock className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Your personal messages are <strong>end-to-end encrypted</strong> on all devices using independent cryptographic ratchets.
                </p>
              </div>

              {/* DEVICE STATUS LIST */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-[11px] uppercase tracking-wider font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Device Status ({devices.length} Active)
                  </h4>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Tap device to revoke session
                  </span>
                </div>

                {devices.length === 0 ? (
                  <div
                    className={`p-8 rounded-2xl border border-dashed text-center ${
                      isDark ? 'border-slate-800 bg-slate-900/30 text-slate-400' : 'border-slate-300 bg-slate-50 text-slate-500'
                    }`}
                  >
                    <Laptop className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-xs font-bold mb-1">No Devices Currently Linked</p>
                    <p className="text-[11px] max-w-xs mx-auto">
                      Link your laptop, desktop browser, or tablet to seamlessly reply to chats from anywhere.
                    </p>
                  </div>
                ) : (
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
                            <div className="flex items-center gap-2">
                              <h5 className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {device.name}
                              </h5>
                              {device.lastActive.toLowerCase().includes('active') && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                  Online
                                </span>
                              )}
                            </div>

                            <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {device.browser ? `${device.browser} • ` : ''}
                              {device.location}
                            </p>

                            <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              <span>Last active: {device.lastActive}</span>
                              <span>•</span>
                              <span className="truncate">{device.fingerprint}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedDeviceToLogout(device)}
                          title={`Log out from ${device.name}`}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 shrink-0 ml-2"
                        >
                          Log Out
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LOGOUT ALL SESSIONS KILL SWITCH */}
              {devices.length > 0 && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowLogoutAllConfirm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Log Out from All Companion Devices</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* 2. QR SCANNER VIEW (Mobile scanning laptop)          */}
          {/* ==================================================== */}
          {activeView === 'scanner' && (
            <div className="p-5 sm:p-6 flex flex-col items-center">
              <div className="w-full max-w-sm text-center mb-4">
                <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Scan QR Code to Link Device
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  To use ChatNova Web, go to <span className="font-mono font-bold text-emerald-500">web.chatnova.network</span> on your computer and scan the QR code.
                </p>
              </div>

              {/* SCANNER VIEWFINDER BOX */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden border-2 border-emerald-500/50 bg-black shadow-2xl flex items-center justify-center">
                {/* Real video if camera permitted */}
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  /* Optical Simulated HUD Background */
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#071318] to-slate-950 flex items-center justify-center">
                    {/* Simulated mock QR pattern to scan */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex flex-col items-center justify-center">
                      <QrCode className="w-32 h-32 text-emerald-400/80 animate-pulse" />
                      <span className="text-[10px] font-mono text-emerald-400 mt-2">Target Optical Code Detected</span>
                    </div>
                  </div>
                )}

                {/* Reticle Brackets (Top Left, Top Right, Bottom Left, Bottom Right) */}
                <div className="absolute top-4 left-4 w-7 h-7 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg pointer-events-none" />
                <div className="absolute top-4 right-4 w-7 h-7 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg pointer-events-none" />
                <div className="absolute bottom-4 left-4 w-7 h-7 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg pointer-events-none" />
                <div className="absolute bottom-4 right-4 w-7 h-7 border-b-4 border-r-4 border-emerald-500 rounded-br-lg pointer-events-none" />

                {/* Sweeping Laser Scanner Line */}
                <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-bounce pointer-events-none" />

                {/* Pairing in progress HUD */}
                {isPairing && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                    <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                    <span className="text-xs font-mono font-bold tracking-wider">EXCHANGING E2EE KEYS...</span>
                    <span className="text-[10px] text-slate-400 mt-1">Creating isolated ratchet tunnel</span>
                  </div>
                )}

                {/* Pairing Success HUD */}
                {pairingSuccessDevice && (
                  <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 animate-in zoom-in-95">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
                    <span className="text-sm font-bold">DEVICE LINKED!</span>
                    <span className="text-xs text-emerald-300 font-mono mt-1">{pairingSuccessDevice}</span>
                  </div>
                )}

                {/* Flashlight toggle */}
                <button
                  type="button"
                  onClick={() => setScannerFlashlight(!scannerFlashlight)}
                  className={`absolute bottom-3 right-3 p-2.5 rounded-full transition z-10 cursor-pointer ${
                    scannerFlashlight ? 'bg-amber-400 text-slate-950' : 'bg-black/60 text-white hover:bg-black/80'
                  }`}
                  title="Toggle Flashlight"
                >
                  <Zap className="w-4 h-4" />
                </button>
              </div>

              {/* Instructions and Quick-Pair simulator for developer / user */}
              <div className="mt-5 text-center max-w-sm space-y-3">
                <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-500" />
                    <span>Auto-Detect Active</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Zero-Knowledge QR</span>
                  </span>
                </div>

                {/* Interactive Instant Simulate Scan button */}
                <button
                  type="button"
                  disabled={isPairing || !!pairingSuccessDevice}
                  onClick={() => handleLinkNewDevice()}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-slate-950 font-bold text-xs tracking-wider uppercase shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Simulate Instant QR Scan & Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className={`w-full py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isDark ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Cancel Scanner
                </button>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 3. SHOW COMPANION QR CODE (Laptop waiting to be scanned) */}
          {/* ==================================================== */}
          {activeView === 'show_qr' && (
            <div className="p-5 sm:p-6 flex flex-col items-center">
              <div className="w-full max-w-md text-center mb-4">
                <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Link as Desktop Web Companion
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Scan this code using ChatNova on your mobile phone to authorize this browser session.
                </p>
              </div>

              {/* DYNAMIC QR CODE DISPLAY */}
              <div
                className={`relative p-5 rounded-3xl border shadow-2xl flex flex-col items-center justify-center transition-all ${
                  isDark ? 'bg-white text-slate-950 border-slate-700' : 'bg-white text-slate-950 border-slate-200'
                }`}
              >
                {/* QR Code Container */}
                <div className="relative w-52 h-52 sm:w-60 sm:h-60 bg-white flex items-center justify-center rounded-2xl overflow-hidden p-2">
                  {/* High fidelity SVG QR pattern */}
                  <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                    {/* Top-Left Finder */}
                    <rect x="5" y="5" width="28" height="28" rx="4" fill="#0b141a" />
                    <rect x="9" y="9" width="20" height="20" rx="2" fill="#ffffff" />
                    <rect x="13" y="13" width="12" height="12" rx="1" fill="#059669" />

                    {/* Top-Right Finder */}
                    <rect x="67" y="5" width="28" height="28" rx="4" fill="#0b141a" />
                    <rect x="71" y="9" width="20" height="20" rx="2" fill="#ffffff" />
                    <rect x="75" y="13" width="12" height="12" rx="1" fill="#059669" />

                    {/* Bottom-Left Finder */}
                    <rect x="5" y="67" width="28" height="28" rx="4" fill="#0b141a" />
                    <rect x="9" y="71" width="20" height="20" rx="2" fill="#ffffff" />
                    <rect x="13" y="75" width="12" height="12" rx="1" fill="#059669" />

                    {/* Data Matrix Bits */}
                    <rect x="38" y="8" width="6" height="6" fill="#0b141a" />
                    <rect x="48" y="14" width="6" height="6" fill="#0b141a" />
                    <rect x="58" y="8" width="6" height="6" fill="#0b141a" />
                    <rect x="38" y="24" width="6" height="6" fill="#0b141a" />
                    <rect x="48" y="28" width="6" height="6" fill="#059669" />
                    <rect x="8" y="38" width="6" height="6" fill="#0b141a" />
                    <rect x="18" y="44" width="6" height="6" fill="#0b141a" />
                    <rect x="28" y="38" width="6" height="6" fill="#059669" />
                    <rect x="38" y="38" width="6" height="6" fill="#0b141a" />
                    <rect x="56" y="38" width="6" height="6" fill="#0b141a" />
                    <rect x="68" y="44" width="6" height="6" fill="#059669" />
                    <rect x="78" y="38" width="6" height="6" fill="#0b141a" />
                    <rect x="88" y="44" width="6" height="6" fill="#0b141a" />
                    <rect x="38" y="52" width="6" height="6" fill="#059669" />
                    <rect x="48" y="58" width="6" height="6" fill="#0b141a" />
                    <rect x="58" y="52" width="6" height="6" fill="#0b141a" />
                    <rect x="38" y="68" width="6" height="6" fill="#0b141a" />
                    <rect x="48" y="74" width="6" height="6" fill="#059669" />
                    <rect x="58" y="68" width="6" height="6" fill="#0b141a" />
                    <rect x="68" y="74" width="6" height="6" fill="#0b141a" />
                    <rect x="78" y="68" width="6" height="6" fill="#059669" />
                    <rect x="88" y="74" width="6" height="6" fill="#0b141a" />
                    <rect x="38" y="84" width="6" height="6" fill="#0b141a" />
                    <rect x="52" y="88" width="6" height="6" fill="#0b141a" />
                    <rect x="68" y="84" width="6" height="6" fill="#0b141a" />
                    <rect x="82" y="88" width="6" height="6" fill="#0b141a" />
                  </svg>

                  {/* ChatNova Emblem Center Badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 border-2 border-emerald-500 flex items-center justify-center text-white shadow-lg">
                      <Lock className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>

                  {/* QR Expired Overlay */}
                  {qrExpired && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center text-slate-900 p-4 text-center">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mb-1" />
                      <p className="text-xs font-bold">QR Code Expired</p>
                      <p className="text-[10px] text-slate-600 mb-3">To maintain forward secrecy, tokens auto-expire.</p>
                      <button
                        type="button"
                        onClick={refreshQRToken}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh QR</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Expiry countdown and token pill */}
                <div className="w-full mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${qrTimer > 0 ? 'animate-spin' : ''}`} />
                    <span>Expires in: <strong>{qrTimer}s</strong></span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700">{qrToken.substring(0, 14)}</span>
                </div>
              </div>

              {/* Instructions steps */}
              <div
                className={`w-full max-w-md mt-5 p-4 rounded-2xl border text-xs space-y-2 ${
                  isDark ? 'bg-[#14232f] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="font-bold text-emerald-600 dark:text-emerald-400 uppercase font-mono tracking-wider text-[11px]">
                  How to link your account:
                </p>
                <ol className={`space-y-1.5 list-decimal list-inside text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <li>Open <strong>ChatNova</strong> on your mobile phone</li>
                  <li>Tap <strong>3-dots Menu</strong> or <strong>Settings &gt; Linked Devices</strong></li>
                  <li>Tap <strong>Link a Device</strong> and point your camera here</li>
                </ol>
              </div>

              {/* Quick simulation buttons */}
              <div className="w-full max-w-md mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleLinkNewDevice({
                      name: 'Chrome on macOS (M3)',
                      type: 'laptop',
                      os: 'macOS Sonoma',
                      browser: 'Chrome 126.0',
                    });
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simulate Phone Scanned This QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-300 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL CONFIRMATION: LOGOUT SINGLE DEVICE */}
        {selectedDeviceToLogout && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl ${
                isDark ? 'bg-[#18262f] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3 mx-auto">
                <LogOut className="w-6 h-6" />
              </div>

              <h4 className="text-base font-bold text-center mb-1">
                Log Out of {selectedDeviceToLogout.name}?
              </h4>
              <p className={`text-xs text-center mb-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                This will immediately terminate the session and revoke cryptographic encryption ratchets for this companion device.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDeviceToLogout(null)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleLogoutDevice(selectedDeviceToLogout.id)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer shadow"
                >
                  Log Out Device
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CONFIRMATION: LOGOUT ALL DEVICES */}
        {showLogoutAllConfirm && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl ${
                isDark ? 'bg-[#18262f] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <h4 className="text-base font-bold text-center mb-1">
                Log Out from ALL Devices?
              </h4>
              <p className={`text-xs text-center mb-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                All companion web, desktop, and tablet sessions will be revoked instantly across all network nodes.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutAllConfirm(false)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogoutAllDevices}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer shadow"
                >
                  Revoke All Sessions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
