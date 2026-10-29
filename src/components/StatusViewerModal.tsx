import React, { useState, useEffect } from 'react';
import { X, Shield, Lock, Send } from 'lucide-react';
import { StatusStory } from '../types';

interface StatusViewerModalProps {
  story?: StatusStory | null;
  onClose: () => void;
  onReply?: (userName: string, text: string) => void;
}

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({ story, onClose, onReply }) => {
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    if (!story) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          onClose();
          return 100;
        }
        return p + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [story, onClose]);

  if (!story) return null;

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    if (onReply) {
      onReply(story.userName || 'User', replyText);
    }
    setReplyText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
      <div className="relative w-full max-w-md h-full sm:h-[680px] bg-black sm:rounded-3xl overflow-hidden flex flex-col justify-between">
        
        {/* Progress bar */}
        <div className="absolute top-3 left-4 right-4 z-20 flex gap-1.5">
          <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* User bar */}
        <div className="absolute top-6 left-4 right-4 z-20 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <img
              src={story.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt={story.userName || 'User'}
              className="w-10 h-10 rounded-full border border-emerald-400 object-cover"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white">{story.userName || 'Unknown'}</span>
                <span className="text-[10px] text-emerald-400 font-mono">{story.customId || '@user'}</span>
              </div>
              <span className="text-[11px] text-white/70">{story.timestamp || 'Just now'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 border border-emerald-500/40 text-[10px] font-mono text-emerald-400">
              <Lock className="w-2.5 h-2.5" /> 24h Expire
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 flex items-center justify-center bg-zinc-950 overflow-hidden">
          {story.mediaUrl ? (
            <img
              src={story.mediaUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-8 text-center bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 w-full h-full flex items-center justify-center">
              <p className="text-xl font-medium text-white max-w-xs">{story.text || 'Encrypted Status Story'}</p>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

          {story.caption && (
            <div className="absolute bottom-20 left-4 right-4 z-10 text-center">
              <p className="inline-block px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-sm font-medium">
                {story.caption}
              </p>
            </div>
          )}
        </div>

        {/* Reply form */}
        <div className="relative z-20 p-4 bg-black/80 border-t border-white/10">
          <form onSubmit={handleSendReply} className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Encrypted reply to ${story.userName || 'user'}...`}
              className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2.5 text-xs text-white placeholder-white/50 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-slate-950 transition cursor-pointer"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-white/50 font-mono">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>End-to-end encrypted story transmission</span>
          </div>
        </div>

      </div>
    </div>
  );
};
