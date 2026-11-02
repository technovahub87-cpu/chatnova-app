
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Laptop, Smartphone, RefreshCw, Trash2,
  Loader2, ShieldCheck, AlertCircle, CheckCircle,
  QrCode, Camera, X, Check, XCircle
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

import { linkedDevicesAPI } from '../services/linkedDevicesAPI';
import { useTheme } from '../context/ThemeContext';
import { setAuthToken } from '../services/api';

interface Device {
  _id: string;
  deviceName: string;
  browser: string;
  operatingSystem: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface PairingRequest {
  id: string;
  status: string;
  targetDeviceName: string;
  targetBrowser: string;
  targetOperatingSystem: string;
}

interface Props {
  onClose: () => void;
}

export const LinkedDevicesSettings: React.FC<Props> = ({ onClose }) => {
  const { isDark } = useTheme();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [view, setView] = useState<'list' | 'qr' | 'scanner'>('list');
  const [qrImage, setQrImage] = useState('');
  const [pairingId, setPairingId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [pairingRequest, setPairingRequest] = useState<PairingRequest | null>(null);
  const [claimInfo, setClaimInfo] = useState<{ pairingId: string; claimSecret: string } | null>(null);
  const [scannerReady, setScannerReady] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const claimStartedRef = useRef(false);

  const cardClass = isDark
    ? 'bg-[#202c33] border-slate-700 text-white'
    : 'bg-white border-slate-200 text-slate-900';

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError('');

    const result: any = await linkedDevicesAPI.getDevices();

    if (!result.success) {
      setError(result.message || 'Unable to load linked devices.');
    } else {
      setDevices(Array.isArray(result.sessions) ? result.sessions : []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Create a real server-generated QR code.
  const createQR = async () => {
    setError('');
    setSuccess('');
    setPairingRequest(null);
    setPairingId('');
    setQrImage('');
    setView('qr');

    const result: any = await linkedDevicesAPI.createPairing();

    if (!result.success || !result.qrCode || !result.pairingId) {
      setError(result.message || 'Could not create QR code.');
      setView('list');
      return;
    }

    setQrImage(result.qrCode);
    setPairingId(String(result.pairingId));
    setExpiresAt(result.expiresAt || '');
  };

  // Poll on the source device for a scan request.
  useEffect(() => {
    if (view !== 'qr' || !pairingId) return;

    let active = true;

    const checkStatus = async () => {
      const result: any = await linkedDevicesAPI.getPairingStatus(pairingId);

      if (!active || !result.success || !result.pairing) return;

      const pairing = result.pairing as PairingRequest;
      setPairingRequest(pairing);

      if (pairing.status === 'rejected') {
        setError('The device linking request was rejected.');
      }

      if (pairing.status === 'consumed') {
        setSuccess('New device linked successfully.');
        setTimeout(() => {
          if (active) {
            setView('list');
            loadDevices();
          }
        }, 1200);
      }
    };

    checkStatus();
    const timer = window.setInterval(checkStatus, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [view, pairingId, loadDevices]);

  const approveRequest = async () => {
    if (!pairingId) return;

    setError('');
    const result: any = await linkedDevicesAPI.approvePairing(pairingId);

    if (!result.success) {
      setError(result.message || 'Could not approve device.');
    } else {
      setSuccess('Device approved. Waiting for it to finish linking...');
    }
  };

  const rejectRequest = async () => {
    if (!pairingId) return;

    const result: any = await linkedDevicesAPI.rejectPairing(pairingId);

    if (!result.success) {
      setError(result.message || 'Could not reject request.');
    } else {
      setPairingRequest(null);
      setError('Device linking request rejected.');
    }
  };

  // Scan a QR and claim the pairing request.
  useEffect(() => {
    if (view !== 'scanner') return;

    let cancelled = false;
    const scanner = new Html5Qrcode('chatnova-qr-reader');
    scannerRef.current = scanner;
    setScannerReady(false);
    claimStartedRef.current = false;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          async (decodedText) => {
            if (claimStartedRef.current || cancelled) return;
            claimStartedRef.current = true;

            try {
              const payload = JSON.parse(decodedText);

              if (
                payload.type !== 'chatnova-device-pairing' ||
                payload.version !== 1 ||
                typeof payload.code !== 'string'
              ) {
                throw new Error('This is not a valid ChatNova pairing QR.');
              }

              await scanner.stop().catch(() => {});
              if (cancelled) return;

              const result: any = await linkedDevicesAPI.claimPairing(payload.code);

              if (!result.success || !result.pairingId || !result.claimSecret) {
                throw new Error(result.message || 'Unable to request device linking.');
              }

              setClaimInfo({
                pairingId: String(result.pairingId),
                claimSecret: result.claimSecret
              });
            } catch (err) {
              claimStartedRef.current = false;
              setError(err instanceof Error ? err.message : 'QR scan failed.');
            }
          },
          () => {}
        );

        if (!cancelled) setScannerReady(true);
      } catch {
        if (!cancelled) {
          setError('Camera could not start. Please allow camera permission and use HTTPS.');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [view]);

  // The new device waits until the source device approves it.
  useEffect(() => {
    if (!claimInfo) return;

    let active = true;
    let busy = false;

    const checkApproval = async () => {
      if (!active || busy) return;
      busy = true;

      try {
        const result: any = await linkedDevicesAPI.completePairing(
          claimInfo.pairingId,
          claimInfo.claimSecret
        );

        if (!active) return;

        if (result.success && result.token && result.user) {
          setAuthToken(result.token);
          setSuccess('Device linked. Opening ChatNova...');
          window.setTimeout(() => window.location.reload(), 700);
        } else if (
          result.message &&
          /expired|already been used|invalid/i.test(result.message)
        ) {
          setError(result.message);
          setClaimInfo(null);
        }
      } finally {
        busy = false;
      }
    };

    checkApproval();
    const timer = window.setInterval(checkApproval, 2500);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [claimInfo]);

  const removeDevice = async (device: Device) => {
    if (device.isCurrent) {
      setError('You cannot remove the device you are currently using.');
      return;
    }

    if (!window.confirm(`Remove ${device.deviceName} from linked devices?`)) return;

    setRemovingId(device._id);
    setError('');
    setSuccess('');

    const result: any = await linkedDevicesAPI.removeDevice(device._id);

    if (!result.success) {
      setError(result.message || 'Could not remove this device.');
    } else {
      setDevices(previous => previous.filter(item => item._id !== device._id));
      setSuccess('Device removed successfully.');
    }

    setRemovingId('');
  };

  const formatDate = (value: string) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  };

  return (
    <div className={`fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 ${isDark ? 'bg-black/70' : 'bg-slate-900/40'}`}>
      <div className={`w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border shadow-2xl ${isDark ? 'bg-[#111b21] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
        <header className={`sticky top-0 z-10 flex items-center gap-3 p-4 border-b ${isDark ? 'bg-[#202c33] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <button type="button" onClick={() => setView('list')} className="p-2 rounded-full hover:bg-slate-500/20" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-lg">Linked Devices</h2>
            <p className="text-xs text-slate-400">Secure QR device linking</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-500/20" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {success && (
            <div className="flex items-center gap-2 rounded-xl p-3 bg-emerald-500/10 text-emerald-500 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />{success}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl p-3 bg-rose-500/10 text-rose-500 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {view === 'list' && (
            <>
              <div className={`rounded-xl border p-4 ${cardClass}`}>
                <div className="flex gap-3 items-start">
                  <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Link another device</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Generate a QR on this logged-in device, then scan it from the device you want to link. Approve the request here.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  <button type="button" onClick={createQR} className="rounded-xl p-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2">
                    <QrCode className="w-4 h-4" /> Show my QR
                  </button>
                  <button type="button" onClick={() => { setError(''); setSuccess(''); setClaimInfo(null); setView('scanner'); }} className="rounded-xl p-3 border border-emerald-500 text-emerald-600 text-sm font-bold flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4" /> Scan a QR
                  </button>
                </div>
              </div>

              <div className={`rounded-xl border p-4 ${cardClass}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm">Your active devices</p>
                  <button type="button" onClick={loadDevices} disabled={loading} className="p-2 rounded-full hover:bg-slate-500/20">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {loading ? (
                  <div className="py-6 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading devices...</div>
                ) : devices.length === 0 ? (
                  <p className="text-xs text-slate-400">No linked devices found.</p>
                ) : (
                  <div className="space-y-3">
                    {devices.map(device => (
                      <div key={device._id} className="rounded-xl border border-slate-500/20 p-3 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          {device.operatingSystem === 'Android' || device.operatingSystem === 'iOS' ? <Smartphone className="w-5 h-5 text-emerald-500" /> : <Laptop className="w-5 h-5 text-emerald-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-sm">{device.deviceName || 'Unknown Device'}</p>
                            {device.isCurrent && <span className="text-[10px] rounded-full px-2 py-1 bg-emerald-500/10 text-emerald-500">This device</span>}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{device.browser} · {device.operatingSystem}</p>
                          <p className="text-[11px] text-slate-400 mt-1">Last active: {formatDate(device.lastActiveAt)}</p>
                          <p className="text-[11px] text-slate-400 mt-1">Added: {formatDate(device.createdAt)}</p>
                        </div>
                        {!device.isCurrent && (
                          <button type="button" onClick={() => removeDevice(device)} disabled={removingId === device._id} className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10">
                            {removingId === device._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {view === 'qr' && (
            <div className="text-center space-y-4">
              <h3 className="font-bold">Scan this QR from your other device</h3>
              {qrImage ? (
                <img src={qrImage} alt="ChatNova device linking QR" className="w-64 h-64 max-w-full mx-auto bg-white p-3 rounded-xl" />
              ) : (
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              )}
              <p className="text-xs text-slate-400">This QR expires in 2 minutes and can only be used once.</p>
              {expiresAt && <p className="text-xs text-slate-400">Expires: {formatDate(expiresAt)}</p>}

              {pairingRequest?.status === 'claimed' && (
                <div className="rounded-xl border border-emerald-500/30 p-4 text-left space-y-3">
                  <p className="font-bold text-sm">New device wants to link</p>
                  <p className="text-sm">{pairingRequest.targetDeviceName}</p>
                  <p className="text-xs text-slate-400">{pairingRequest.targetBrowser} · {pairingRequest.targetOperatingSystem}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={approveRequest} className="rounded-xl bg-emerald-600 text-white p-3 text-sm font-bold flex justify-center gap-2"><Check className="w-4 h-4" /> Approve</button>
                    <button type="button" onClick={rejectRequest} className="rounded-xl bg-rose-600 text-white p-3 text-sm font-bold flex justify-center gap-2"><XCircle className="w-4 h-4" /> Reject</button>
                  </div>
                </div>
              )}

              {pairingRequest?.status === 'approved' && <p className="text-sm text-emerald-500">Approved. Waiting for the new device...</p>}
              <button type="button" onClick={createQR} className="text-sm text-emerald-500 font-semibold">Generate a new QR</button>
            </div>
          )}

          {view === 'scanner' && (
            <div className="space-y-4 text-center">
              <h3 className="font-bold">Scan ChatNova QR code</h3>
              <p className="text-xs text-slate-400">Allow camera access when your browser asks.</p>
              <div id="chatnova-qr-reader" className="w-full overflow-hidden rounded-xl bg-black min-h-64" />
              {!scannerReady && !claimInfo && <p className="text-xs text-slate-400">Starting camera...</p>}
              {claimInfo && (
                <div className="rounded-xl border border-emerald-500/30 p-4 space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-500" />
                  <p className="font-semibold text-sm">Waiting for approval</p>
                  <p className="text-xs text-slate-400">Approve this device on the device that displayed the QR code. This screen will sign in automatically after approval.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkedDevicesSettings;
