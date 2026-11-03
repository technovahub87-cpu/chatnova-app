
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
  Camera
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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const handledRequestRef = useRef<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-[100] bg-[#071018]/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-4xl rounded-3xl bg-[#14212b] border border-cyan-500/20 shadow-2xl text-white overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {isVideo ? (
              <Video className="w-5 h-5 text-cyan-400" />
            ) : (
              <Phone className="w-5 h-5 text-emerald-400" />
            )}
            <div>
              <div className="font-bold">ChatNova</div>
              <div className="text-xs text-slate-400">
                {isVideo ? 'Video Call' : 'Voice Call'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closePanel}
            disabled={busy || webrtcCallService.isInCall()}
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isVideo ? (
          <div className="relative bg-black aspect-video max-h-[65vh] overflow-hidden">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5">
                <div className="w-24 h-24 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-4">
                  <Camera className="w-10 h-10 text-cyan-400" />
                </div>
                <div className="font-semibold">
                  {incomingCall?.caller?.displayName || 'ChatNova Contact'}
                </div>
                <div className="text-sm text-slate-400 mt-2">
                  {statusText[callStatus] || 'Waiting for video...'}
                </div>
              </div>
            )}

            {localStream && (
              <div className="absolute bottom-4 right-4 w-28 sm:w-44 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/40 shadow-xl bg-slate-900">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {!cameraEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 text-xs">
                    Camera off
                  </div>
                )}
              </div>
            )}

            {callStatus === 'connected' && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">
                Connected
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-12 px-5">
            <div className="w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5">
              <Mic className="w-11 h-11 text-emerald-400" />
            </div>

            <h2 className="text-xl font-bold">
              {incomingCall?.caller?.displayName || 'ChatNova Contact'}
            </h2>

            <p className="text-sm text-emerald-400 mt-2">
              {statusText[callStatus] || 'Voice call'}
            </p>
          </div>
        )}

        {incomingCall && (
          <div className="px-5 pt-4 text-center">
            <h2 className="font-bold">
              {incomingCall.caller?.displayName || 'ChatNova Contact'}
            </h2>
            {incomingCall.caller?.customId && (
              <p className="text-xs text-slate-400 mt-1">
                {incomingCall.caller.customId}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {incomingCall ? (
          <div className="grid grid-cols-2 gap-3 p-5">
            <button
              type="button"
              onClick={rejectCall}
              disabled={busy}
              className="py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <PhoneOff className="w-4 h-4" />
              Reject
            </button>

            <button
              type="button"
              onClick={acceptCall}
              disabled={busy}
              className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Phone className="w-4 h-4" />
              {busy ? 'Please wait...' : 'Accept'}
            </button>
          </div>
        ) : webrtcCallService.isInCall() ? (
          <div className="flex items-center justify-center gap-4 p-5">
            <button
              type="button"
              onClick={toggleMic}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                micEnabled ? 'bg-slate-700' : 'bg-rose-600'
              }`}
              title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {micEnabled ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </button>

            {isVideo && (
              <button
                type="button"
                onClick={toggleCamera}
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  cameraEnabled ? 'bg-slate-700' : 'bg-rose-600'
                }`}
                title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
              >
                {cameraEnabled ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <VideoOff className="w-5 h-5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 flex items-center justify-center cursor-pointer"
              title="End call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <div className="p-5">
            <button
              type="button"
              onClick={closePanel}
              className="w-full py-3 rounded-2xl bg-slate-700 hover:bg-slate-600 font-semibold"
            >
              Close
            </button>
          </div>
        )}

        <p className="text-[10px] text-slate-500 text-center pb-4 px-4">
          {isVideo
            ? 'Allow camera and microphone permissions when your browser asks.'
            : 'Allow microphone permission when your browser asks.'}
        </p>
      </div>
    </div>
  );
};

export default CallOverlay;
