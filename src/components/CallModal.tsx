import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Shield, Lock } from 'lucide-react';
import { User } from '../types';

interface CallModalProps {
  participant?: User | null;
  type: 'voice' | 'video';
  isOpen: boolean;
  onClose: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({ participant, type, isOpen, onClose }) => {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(type === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callState, setCallState] = useState<'connecting' | 'ringing' | 'connected'>('connecting');

  useEffect(() => {
    if (!isOpen) {
      setSeconds(0);
      setCallState('connecting');
      return;
    }

    const ringTimer = setTimeout(() => {
      setCallState('ringing');
    }, 1000);

    const connectTimer = setTimeout(() => {
      setCallState('connected');
    }, 2800);

    return () => {
      clearTimeout(ringTimer);
      clearTimeout(connectTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    let interval: any;
    if (isOpen && callState === 'connected') {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, callState]);

  if (!isOpen || !participant) return null;

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm h-[580px] bg-gradient-to-b from-[#11242e] via-[#0b141a] to-[#050a0e] rounded-3xl border border-emerald-500/30 overflow-hidden flex flex-col justify-between p-6 shadow-2xl">
        
        {/* Top security tag */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>SRTP 256-Bit Encrypted</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Zurich Relay</span>
        </div>

        {/* Center avatar & info */}
        <div className="flex flex-col items-center my-auto text-center">
          <div className="relative mb-5">
            {callState === 'ringing' && (
              <div className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-ping" />
            )}
            <div className="w-28 h-28 rounded-full ring-4 ring-emerald-500/40 p-1 overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <img
                src={participant.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={participant.displayName || 'User'}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0b141a] flex items-center justify-center shadow">
              <Shield className="w-3 h-3 text-white" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mb-0.5">{participant.displayName || 'Unknown Contact'}</h3>
          <p className="text-xs text-emerald-400 font-mono mb-2">{participant.customId || '@user'}</p>

          <p className="text-xs font-mono tracking-wider text-slate-400">
            {callState === 'connecting' && 'Establishing cryptographic handshake...'}
            {callState === 'ringing' && 'Ringing offshore secure enclave...'}
            {callState === 'connected' && (
              <span className="text-emerald-400 font-bold text-sm tracking-widest">
                {formatTime(seconds)}
              </span>
            )}
          </p>

          {/* Video simulation preview if video call */}
          {isVideoOn && callState === 'connected' && (
            <div className="mt-4 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-[11px] text-slate-300 flex items-center gap-2 font-mono">
              <Video className="w-3.5 h-3.5 text-teal-400" />
              <span>Camera Stream Active (H.265 / Secure Mesh)</span>
            </div>
          )}
        </div>

        {/* Bottom Call Controls */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer ${
              isMuted ? 'bg-rose-500/80 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer ${
              isVideoOn ? 'bg-emerald-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer ${
              isSpeakerOn ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-900 text-slate-500'
            }`}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-950/60 transition transform active:scale-95 cursor-pointer"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
