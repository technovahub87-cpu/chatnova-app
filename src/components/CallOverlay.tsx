
import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  AlertCircle,
  X,
  Camera,
  Volume2
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

useEffect(() => {
  webrtcCallService.setRemoteVolume(callVolume);

  if (remoteVideoRef.current) {
    remoteVideoRef.current.volume = callVolume;
  }
}, [callVolume, remoteStream]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const handledRequestRef = useRef<string | null>(null);

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
      setCallStatus('incoming');
      setError('');
      setBusy(false);
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
    setError('');
    setIncomingCall(null);
    setCallStatus('calling');
    setBusy(true);
    setMicEnabled(true);
    setCameraEnabled(true);

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

  const closePanel = () => {
    setIncomingCall(null);
    setCallStatus('');
    setError('');
    setBusy(false);
    setLocalStream(null);
    setRemoteStream(null);
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

  return (
    <div className="fixed inset-0 z-[100] w-screen h-[100dvh] bg-[#050b12] text-white overflow-hidden">

      {isVideo ? (
        <div className="absolute inset-0 bg-black">

          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5 bg-[#101d29]">
              <div className="w-28 h-28 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-5">
                <Camera className="w-12 h-12 text-cyan-400" />
              </div>

              <h2 className="text-2xl font-bold">
                {incomingCall?.caller?.displayName || 'ChatNova Contact'}
              </h2>

              <p className="text-sm text-slate-300 mt-3">
                {statusText[callStatus] || 'Waiting for video...'}
              </p>
            </div>
          )}

          {localStream && (
            <div className="absolute top-20 right-3 sm:top-6 sm:right-6 w-28 sm:w-44 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/60 shadow-2xl bg-slate-900 z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {!cameraEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 text-xs">
                  Camera off
                </div>
              )}
            </div>
          )}

          <div className="absolute top-0 inset-x-0 z-30 px-4 pt-[max(env(safe-area-inset-top),16px)] pb-5 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="font-bold">ChatNova Video Call</div>
                  <div className="text-xs text-slate-200">
                    {statusText[callStatus] || 'Video Call'}
                  </div>
                </div>
              </div>

              {callStatus === 'connected' && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/80 text-white text-xs">
                  Connected
                </span>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 inset-x-0 z-30 pt-12 pb-[max(env(safe-area-inset-bottom),20px)] bg-gradient-to-t from-black/90 via-black/50 to-transparent">
            {error && (
              <div className="mx-4 mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
{isActive && (
  <div className="mx-auto mb-5 w-64 rounded-2xl bg-black/50 p-3">
    <div className="mb-2 flex items-center justify-between text-xs">
      <span>Call Volume</span>
      <span>{Math.round(callVolume * 100)}%</span>
    </div>
    <div className="flex items-center gap-3">
      <Volume2 className="h-5 w-5 shrink-0" />
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={callVolume}
        onChange={(e) => setCallVolume(Number(e.target.value))}
        className="w-full accent-cyan-400"
        aria-label="Call volume"
      />
    </div>
  </div>
)}
            {incomingCall ? (
              <div className="flex items-center justify-center gap-8 px-5">
                <button
                  type="button"
                  onClick={rejectCall}
                  disabled={busy}
                  className="w-16 h-16 rounded-full bg-rose-600 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                >
                  <PhoneOff className="w-6 h-6" />
                  <span className="text-[10px]">Reject</span>
                </button>

                <button
                  type="button"
                  onClick={acceptCall}
                  disabled={busy}
                  className="w-16 h-16 rounded-full bg-emerald-600 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Phone className="w-6 h-6" />
                  <span className="text-[10px]">{busy ? 'Wait' : 'Accept'}</span>
                </button>
              </div>
            ) : isActive ? (
              <div className="flex items-center justify-center gap-5 px-4">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`w-14 h-14 rounded-full flex items-center justify-center ${micEnabled ? 'bg-white/20' : 'bg-rose-600'}`}
                  title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>

                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`w-14 h-14 rounded-full flex items-center justify-center ${cameraEnabled ? 'bg-white/20' : 'bg-rose-600'}`}
                  title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                >
                  {cameraEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>

                <button
                  type="button"
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-rose-600 flex items-center justify-center"
                  title="End call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={closePanel}
                className="mx-auto block px-8 py-3 rounded-full bg-slate-700"
              >
                Close
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-between bg-gradient-to-b from-[#14212b] to-[#071018]">

          <div className="w-full flex items-center justify-between p-5 pt-[max(env(safe-area-inset-top),20px)]">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="font-bold">ChatNova</div>
                <div className="text-xs text-slate-400">Voice Call</div>
              </div>
            </div>
            <Volume2 className="w-5 h-5 text-slate-400" />
          </div>

          <div className="flex flex-col items-center text-center px-5">
            <div className="w-32 h-32 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
              <Mic className="w-14 h-14 text-emerald-400" />
            </div>

            <h2 className="text-2xl font-bold">
              {incomingCall?.caller?.displayName || 'ChatNova Contact'}
            </h2>

            {incomingCall?.caller?.customId && (
              <p className="text-sm text-slate-400 mt-2">
                {incomingCall.caller.customId}
              </p>
            )}

            <p className="text-emerald-400 mt-4">
              {statusText[callStatus] || 'Voice Call'}
            </p>
          </div>

          <div className="w-full pb-[max(env(safe-area-inset-bottom),24px)]">
            {error && (
              <div className="mx-4 mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {incomingCall ? (
              <div className="flex items-center justify-center gap-10">
                <button
                  type="button"
                  onClick={rejectCall}
                  disabled={busy}
                  className="w-16 h-16 rounded-full bg-rose-600 flex items-center justify-center disabled:opacity-50"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>

                <button
                  type="button"
                  onClick={acceptCall}
                  disabled={busy}
                  className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center disabled:opacity-50"
                >
                  <Phone className="w-7 h-7" />
                </button>
              </div>
            ) : isActive ? (
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`w-14 h-14 rounded-full flex items-center justify-center ${micEnabled ? 'bg-slate-700' : 'bg-rose-600'}`}
                >
                  {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>

                <button
                  type="button"
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-rose-600 flex items-center justify-center"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={closePanel}
                className="mx-auto block px-8 py-3 rounded-full bg-slate-700"
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
