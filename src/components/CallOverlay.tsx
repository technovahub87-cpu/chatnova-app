
import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, AlertCircle, X } from 'lucide-react';
import { webrtcCallService } from '../services/webrtcCall';

interface CallRequest {
  id: string;
  type: 'voice' | 'video';
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

  const handledRequestRef = useRef<string | null>(null);

  useEffect(() => {
    webrtcCallService.initialize();

    webrtcCallService.onIncomingCall = (data) => {
      setIncomingCall(data);
      setCallStatus('incoming');
      setError('');
    };

    webrtcCallService.onCallStatus = (status) => {
      setCallStatus(status);

      if (
        status === 'ended' ||
        status === 'rejected' ||
        status === 'timeout' ||
        status === 'missed'
      ) {
        setIncomingCall(null);
        setBusy(false);
      }
    };

    webrtcCallService.onCallError = (message) => {
      setError(message);
      setBusy(false);
    };

    return () => {
      webrtcCallService.onIncomingCall = null;
      webrtcCallService.onCallStatus = null;
      webrtcCallService.onCallError = null;
    };
  }, []);

  useEffect(() => {
    if (!request || handledRequestRef.current === request.id) return;

    handledRequestRef.current = request.id;
    onRequestHandled();

    if (request.type !== 'voice') {
      setError('Video calling will be added after voice calling is tested.');
      setCallStatus('error');
      return;
    }

    setError('');
    setIncomingCall(null);
    setCallStatus('calling');
    setBusy(true);

    webrtcCallService.startOutgoingCall(request.conversationId)
      .catch((err: any) => {
        setError(err?.message || 'Unable to start the call.');
        setCallStatus('error');
        setBusy(false);
      });
  }, [request, onRequestHandled]);

  const acceptCall = async () => {
    if (!incomingCall) return;

    setBusy(true);
    setError('');

    try {
      await webrtcCallService.acceptIncomingCall(
        incomingCall.callId,
        incomingCall.conversationId
      );

      setIncomingCall(null);
      setCallStatus('connecting');
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
    setBusy(true);
    await webrtcCallService.endCall();
    setIncomingCall(null);
    setCallStatus('ended');
    setBusy(false);
  };

  const closePanel = () => {
    setIncomingCall(null);
    setCallStatus('');
    setError('');
    setBusy(false);
    handledRequestRef.current = null;
  };

  const statusText: Record<string, string> = {
    incoming: 'Incoming voice call',
    calling: 'Calling...',
    ringing: 'Ringing...',
    connecting: 'Connecting securely...',
    connected: 'Voice call connected',
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

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#17232b] border border-emerald-500/20 shadow-2xl text-white p-6">
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-400" />
            <span className="font-bold">ChatNova Voice</span>
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

        <div className="flex flex-col items-center text-center py-5">
          <div className="w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5">
            <Mic className="w-11 h-11 text-emerald-400" />
          </div>

          <h2 className="text-xl font-bold">
            {incomingCall?.caller?.displayName || 'ChatNova Contact'}
          </h2>

          <p className="text-sm text-emerald-400 mt-2">
            {statusText[callStatus] || 'Voice call'}
          </p>

          {incomingCall?.caller?.customId && (
            <p className="text-xs text-slate-400 mt-1">
              {incomingCall.caller.customId}
            </p>
          )}

          {error && (
            <div className="mt-5 w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {callStatus === 'connected' && (
            <p className="text-xs text-slate-400 mt-4">
              Your microphone is active.
            </p>
          )}
        </div>

        {incomingCall ? (
          <div className="grid grid-cols-2 gap-3 mt-5">
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
          <button
            type="button"
            onClick={endCall}
            disabled={busy}
            className="w-full mt-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <PhoneOff className="w-5 h-5" />
            {busy ? 'Ending...' : 'End Call'}
          </button>
        ) : (
          <button
            type="button"
            onClick={closePanel}
            className="w-full mt-5 py-3 rounded-2xl bg-slate-700 hover:bg-slate-600 font-semibold"
          >
            Close
          </button>
        )}

        <p className="text-[10px] text-slate-500 text-center mt-5">
          Allow microphone permission when your browser asks.
        </p>
      </div>
    </div>
  );
};

export default CallOverlay;
