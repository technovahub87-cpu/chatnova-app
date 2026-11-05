
import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  AlertCircle,
  Camera,
  Volume2,
  Headphones,
  X
} from 'lucide-react';
import {
  webrtcCallService,
  CallType
} from '../services/webrtcCall';

interface CallRequest {
  id: string;
  type: CallType;
  conversationId: string;
}

interface CallOverlayProps {
  request: CallRequest | null;
  onRequestHandled: () => void;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({
  request,
  onRequestHandled
}) => {
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callStatus, setCallStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [currentType, setCurrentType] = useState<CallType>('voice');
  const [callVolume, setCallVolume] = useState(1);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [volumePanelOpen, setVolumePanelOpen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const handledRequestRef = useRef<string | null>(null);

  useEffect(() => {
    webrtcCallService.setRemoteVolume(callVolume);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = callVolume;
    }
  }, [callVolume, remoteStream]);

  // Incoming call ringtone
  useEffect(() => {
    if (!incomingCall) return;

    let audioContext: AudioContext | null = null;
    let ringTimer: number | null = null;
    let stopped = false;

    const playRing = async () => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as any).webkitAudioContext;

        if (!AudioContextClass || stopped) return;

        if (!audioContext) {
          audioContext = new AudioContextClass();
        }

        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        if (stopped || audioContext.state !== 'running') return;

        const now = audioContext.currentTime;

        [0, 0.22].forEach((offset) => {
          const oscillator = audioContext!.createOscillator();
          const gain = audioContext!.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, now + offset);

          gain.gain.setValueAtTime(0, now + offset);
          gain.gain.linearRampToValueAtTime(
            0.16,
            now + offset + 0.04
          );
          gain.gain.setValueAtTime(
            0.16,
            now + offset + 0.38
          );
          gain.gain.linearRampToValueAtTime(
            0,
            now + offset + 0.48
          );

          oscillator.connect(gain);
          gain.connect(audioContext!.destination);

          oscillator.start(now + offset);
          oscillator.stop(now + offset + 0.5);
        });
      } catch (err) {
        console.warn('[ChatNova Ringtone]:', err);
      }
    };

    playRing();
    ringTimer = window.setInterval(playRing, 1800);

    return () => {
      stopped = true;

      if (ringTimer !== null) {
        window.clearInterval(ringTimer);
      }

      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    };
  }, [incomingCall]);

  useEffect(() => {
    webrtcCallService.initialize();

    webrtcCallService.onIncomingCall = (data) => {
      setIncomingCall(data);
      setCurrentType(data.type === 'video' ? 'video' : 'voice');
      setSpeakerEnabled(data.type === 'video');
      setCallStatus('incoming');
      setError('');
      setBusy(false);
      setVolumePanelOpen(false);
    };

    webrtcCallService.onCallStatus = (status) => {
      setCallStatus(status);

      if (
        status === 'connected' ||
        status === 'ringing' ||
        status === 'connection-lost'
      ) {
        setBusy(false);
      }

      if (
        status === 'ended' ||
        status === 'rejected' ||
        status === 'timeout' ||
        status === 'missed'
      ) {
        setIncomingCall(null);
        setBusy(false);
        setLocalStream(null);
        setRemoteStream(null);
        setVolumePanelOpen(false);
      }
    };

    webrtcCallService.onCallError = (message) => {
      setError(message);
      setBusy(false);
    };

    webrtcCallService.onLocalStream = (stream) => {
      setLocalStream(stream);
    };

    webrtcCallService.onRemoteStream = (stream) => {
      setRemoteStream(stream);
    };

    return () => {
      webrtcCallService.onIncomingCall = null;
      webrtcCallService.onCallStatus = null;
      webrtcCallService.onCallError = null;
      webrtcCallService.onLocalStream = null;
      webrtcCallService.onRemoteStream = null;
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;

      if (localStream) {
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [localStream, currentType]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;

      if (remoteStream) {
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [remoteStream, currentType]);

  useEffect(() => {
    if (!request || handledRequestRef.current === request.id) return;

    handledRequestRef.current = request.id;
    onRequestHandled();

    setCurrentType(request.type);
    setSpeakerEnabled(request.type === 'video');
    setError('');
    setIncomingCall(null);
    setCallStatus('calling');
    setBusy(true);
    setMicEnabled(true);
    setCameraEnabled(true);
    setVolumePanelOpen(false);

    webrtcCallService.startOutgoingCall(
      request.conversationId,
      request.type
    ).catch((err: any) => {
      setError(err?.message || 'Unable to start the call.');
      setCallStatus('error');
      setBusy(false);
    });
  }, [request, onRequestHandled]);

  const acceptCall = async () => {
    if (!incomingCall) return;

    setBusy(true);
    setError('');

    const type: CallType =
      incomingCall.type === 'video' ? 'video' : 'voice';

    setCurrentType(type);
    setSpeakerEnabled(type === 'video');

    try {
      await webrtcCallService.acceptIncomingCall(
        incomingCall.callId,
        incomingCall.conversationId,
        type
      );

      setIncomingCall(null);
      setCallStatus('connecting');
      setBusy(false);
    } catch (err: any) {
      setError(err?.message || 'Could not accept the call.');
      setBusy(false);
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;

    webrtcCallService.rejectIncomingCall(incomingCall.callId);
    setIncomingCall(null);
    setCallStatus('');
    setBusy(false);
    setVolumePanelOpen(false);
  };

  const endCall = async () => {
    if (!webrtcCallService.isInCall()) return;

    setBusy(true);

    try {
      await webrtcCallService.endCall();
    } finally {
      setIncomingCall(null);
      setLocalStream(null);
      setRemoteStream(null);
      setCallStatus('ended');
      setBusy(false);
      setVolumePanelOpen(false);
    }
  };

  const toggleMic = () => {
    const enabled = webrtcCallService.toggleMicrophone();
    setMicEnabled(enabled);
  };

  const toggleCamera = () => {
    const enabled = webrtcCallService.toggleCamera();
    setCameraEnabled(enabled);
  };

  const toggleSpeaker = async () => {
    const nextEnabled = !speakerEnabled;

    const changed =
      await webrtcCallService.setSpeakerEnabled(nextEnabled);

    if (changed) {
      setSpeakerEnabled(nextEnabled);
      setError('');
    } else {
      setError(
        'Unable to change audio route on this device. Please check Android audio permissions.'
      );
    }
  };

  const toggleVolumePanel = () => {
    setVolumePanelOpen((previous) => !previous);
  };

  const closePanel = () => {
    setIncomingCall(null);
    setCallStatus('');
    setError('');
    setBusy(false);
    setLocalStream(null);
    setRemoteStream(null);
    setVolumePanelOpen(false);
    handledRequestRef.current = null;
  };

  const statusText: Record<string, string> = {
    incoming: currentType === 'video'
      ? 'Incoming video call'
      : 'Incoming voice call',
    calling: 'Calling...',
    ringing: 'Ringing...',
    connecting: 'Connecting securely...',
    connected: currentType === 'video'
      ? 'Video call connected'
      : 'Voice call connected',
    ended: 'Call ended',
    rejected: 'Call rejected',
    timeout: 'No answer',
    missed: 'Missed call',
    'connection-lost': 'Connection interrupted',
    error: 'Call could not start'
  };

  const visible =
    Boolean(incomingCall) ||
    Boolean(callStatus) ||
    Boolean(error);

  if (!visible) return null;

  const isVideo = currentType === 'video';
  const isActive = webrtcCallService.isInCall();

  const volumeControl = (
    <div className="absolute right-4 top-16 z-50 w-64 rounded-2xl border border-white/15 bg-[#14212b]/95 p-4 shadow-2xl backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium">Call Volume</span>
        <span className="font-semibold text-cyan-300">
          {Math.round(callVolume * 100)}%
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Volume2 className="h-5 w-5 shrink-0 text-cyan-300" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={callVolume}
          onChange={(e) => setCallVolume(Number(e.target.value))}
          className="w-full accent-cyan-400"
          aria-label="Call volume"
        />
      </div>

      <button
        type="button"
        onClick={() => setVolumePanelOpen(false)}
        className="mt-3 w-full rounded-lg bg-white/10 py-2 text-xs text-slate-200"
      >
        Close
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-[#050b12] text-white">

      {isVideo ? (
        <div className="absolute inset-0 bg-black">

          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#101d29] p-5 text-center">
              <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/15">
                <Camera className="h-12 w-12 text-cyan-400" />
              </div>

              <h2 className="text-2xl font-bold">
                {incomingCall?.caller?.displayName || 'ChatNova Contact'}
              </h2>

              <p className="mt-3 text-sm text-slate-300">
                {statusText[callStatus] || 'Waiting for video...'}
              </p>
            </div>
          )}

          {localStream && (
            <div className="absolute right-3 top-20 z-20 aspect-[3/4] w-28 overflow-hidden rounded-2xl border-2 border-white/60 bg-slate-900 shadow-2xl sm:right-6 sm:top-6 sm:w-44">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full scale-x-[-1] object-cover"
              />

              {!cameraEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 text-xs">
                  Camera off
                </div>
              )}
            </div>
          )}

          <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 to-transparent px-4 pb-5 pt-[max(env(safe-area-inset-top),16px)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-cyan-400" />
                <div>
                  <div className="font-bold">ChatNova Video Call</div>
                  <div className="text-xs text-slate-200">
                    {statusText[callStatus] || 'Video Call'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {callStatus === 'connected' && (
                  <span className="rounded-full bg-emerald-500/80 px-3 py-1 text-xs text-white">
                    Connected
                  </span>
                )}

                <button
                  type="button"
                  onClick={toggleVolumePanel}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
                  title="Call volume"
                  aria-label="Open call volume"
                >
                  <Volume2 className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {volumePanelOpen && volumeControl}

          <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-[max(env(safe-area-inset-bottom),20px)] pt-12">
            {error && (
              <div className="mx-4 mb-4 flex gap-2 rounded-xl border border-rose-400/40 bg-rose-500/20 p-3 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {incomingCall ? (
              <div className="flex items-center justify-center gap-8 px-5">
                <button
                  type="button"
                  onClick={rejectCall}
                  disabled={busy}
                  className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full bg-rose-600 disabled:opacity-50"
                >
                  <PhoneOff className="h-6 w-6" />
                  <span className="text-[10px]">Reject</span>
                </button>

                <button
                  type="button"
                  onClick={acceptCall}
                  disabled={busy}
                  className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full bg-emerald-600 disabled:opacity-50"
                >
                  <Phone className="h-6 w-6" />
                  <span className="text-[10px]">
                    {busy ? 'Wait' : 'Accept'}
                  </span>
                </button>
              </div>
            ) : isActive ? (
              <div className="flex items-center justify-center gap-5 px-4">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${micEnabled ? 'bg-white/20' : 'bg-rose-600'}`}
                  title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {micEnabled
                    ? <Mic className="h-6 w-6" />
                    : <MicOff className="h-6 w-6" />}
                </button>

                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${cameraEnabled ? 'bg-white/20' : 'bg-rose-600'}`}
                  title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                >
                  {cameraEnabled
                    ? <Video className="h-6 w-6" />
                    : <VideoOff className="h-6 w-6" />}
                </button>

                <button
                  type="button"
                  onClick={toggleSpeaker}
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${speakerEnabled ? 'bg-cyan-600' : 'bg-white/20'}`}
                  title={speakerEnabled ? 'Switch to earpiece' : 'Switch to speaker'}
                >
                  {speakerEnabled
                    ? <Volume2 className="h-6 w-6" />
                    : <Headphones className="h-6 w-6" />}
                </button>

                <button
                  type="button"
                  onClick={endCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600"
                  title="End call"
                >
                  <PhoneOff className="h-7 w-7" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={closePanel}
                className="mx-auto block rounded-full bg-slate-700 px-8 py-3"
              >
                Close
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-between bg-gradient-to-b from-[#14212b] to-[#071018]">

          <div className="relative flex w-full items-center justify-between p-5 pt-[max(env(safe-area-inset-top),20px)]">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-emerald-400" />
              <div>
                <div className="font-bold">ChatNova</div>
                <div className="text-xs text-slate-400">Voice Call</div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleVolumePanel}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
              title="Call volume"
              aria-label="Open call volume"
            >
              <Volume2 className="h-5 w-5 text-white" />
            </button>
          </div>

          {volumePanelOpen && volumeControl}

          <div className="flex flex-col items-center px-5 text-center">
            <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
              <Mic className="h-14 w-14 text-emerald-400" />
            </div>

            <h2 className="text-2xl font-bold">
              {incomingCall?.caller?.displayName || 'ChatNova Contact'}
            </h2>

            {incomingCall?.caller?.customId && (
              <p className="mt-2 text-sm text-slate-400">
                {incomingCall.caller.customId}
              </p>
            )}

            <p className="mt-4 text-emerald-400">
              {statusText[callStatus] || 'Voice Call'}
            </p>
          </div>

          <div className="w-full pb-[max(env(safe-area-inset-bottom),24px)]">
            {error && (
              <div className="mx-4 mb-4 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {incomingCall ? (
              <div className="flex items-center justify-center gap-10">
                <button
                  type="button"
                  onClick={rejectCall}
                  disabled={busy}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 disabled:opacity-50"
                >
                  <PhoneOff className="h-7 w-7" />
                </button>

                <button
                  type="button"
                  onClick={acceptCall}
                  disabled={busy}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 disabled:opacity-50"
                >
                  <Phone className="h-7 w-7" />
                </button>
              </div>
            ) : isActive ? (
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${micEnabled ? 'bg-slate-700' : 'bg-rose-600'}`}
                >
                  {micEnabled
                    ? <Mic className="h-6 w-6" />
                    : <MicOff className="h-6 w-6" />}
                </button>

                <button
                  type="button"
                  onClick={toggleSpeaker}
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${speakerEnabled ? 'bg-cyan-600' : 'bg-slate-700'}`}
                  title={speakerEnabled ? 'Switch to earpiece' : 'Switch to speaker'}
                >
                  {speakerEnabled
                    ? <Volume2 className="h-6 w-6" />
                    : <Headphones className="h-6 w-6" />}
                </button>

                <button
                  type="button"
                  onClick={endCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600"
                  title="End call"
                >
                  <PhoneOff className="h-7 w-7" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={closePanel}
                className="mx-auto block rounded-full bg-slate-700 px-8 py-3"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallOverlay;
