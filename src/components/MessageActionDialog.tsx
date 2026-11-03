import React from 'react';
import { Reply, Forward, Trash2, X } from 'lucide-react';

interface MessageActionDialogProps {
  isDark: boolean;
  messageText: string;
  mode: 'reply' | 'forward' | 'delete';
  onClose: () => void;
  onReply?: (text: string) => void;
  onForward?: () => void;
  onDeleteForMe?: () => void;
  onDeleteForEveryone?: () => void;
}

export const MessageActionDialog: React.FC<MessageActionDialogProps> = ({
  isDark,
  messageText,
  mode,
  onClose,
  onReply,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone
}) => {
  const [replyText, setReplyText] = React.useState('');

  const panel = isDark
    ? 'bg-[#202c33] text-white border-slate-700'
    : 'bg-white text-slate-900 border-slate-200';

  const button = isDark
    ? 'bg-slate-700 hover:bg-slate-600'
    : 'bg-slate-100 hover:bg-slate-200';

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${panel}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            {mode === 'reply' && <Reply className="w-4 h-4 text-emerald-500" />}
            {mode === 'forward' && <Forward className="w-4 h-4 text-sky-500" />}
            {mode === 'delete' && <Trash2 className="w-4 h-4 text-rose-500" />}
            {mode === 'reply' ? 'Reply to message' : mode === 'forward' ? 'Forward message' : 'Delete message'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-500/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`rounded-xl p-3 mb-4 text-xs break-words ${button}`}>
          {messageText || 'Media message'}
        </div>

        {mode === 'reply' && (
          <>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write your reply..."
              rows={3}
              className={`w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                isDark
                  ? 'bg-[#111b21] border-slate-700 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <button
              disabled={!replyText.trim()}
              onClick={() => onReply?.(replyText.trim())}
              className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold"
            >
              Send Reply
            </button>
          </>
        )}

        {mode === 'forward' && (
          <button
            onClick={onForward}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            Choose Chat to Forward
          </button>
        )}

        {mode === 'delete' && (
          <div className="space-y-2">
            <button
              onClick={onDeleteForMe}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold"
            >
              Delete for me
            </button>
            <button
              onClick={onDeleteForEveryone}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold"
            >
              Delete for everyone
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageActionDialog;
