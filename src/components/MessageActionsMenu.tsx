
import React, { useState } from 'react';
import {
  MoreVertical,
  Reply,
  Forward,
  Trash2,
  X
} from 'lucide-react';

interface MessageActionsMenuProps {
  isMe: boolean;
  isDark: boolean;
  onReply: () => void;
  onForward: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

export const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({
  isMe,
  isDark,
  onReply,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone
}) => {
  const [open, setOpen] = useState(false);

  const menuClass = `absolute right-0 top-8 z-50 w-48 rounded-xl border shadow-2xl py-1 ${
    isDark
      ? 'bg-[#233138] border-slate-700 text-white'
      : 'bg-white border-slate-200 text-slate-800'
  }`;

  const itemClass = `w-full px-3 py-2.5 text-left text-xs flex items-center gap-2.5 ${
    isDark ? 'hover:bg-slate-700/70' : 'hover:bg-slate-100'
  }`;

  const runAction = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        title="Message actions"
        aria-label="Message actions"
        className="p-1 rounded-md hover:bg-black/10 transition"
      >
        {open ? (
          <X className="w-3.5 h-3.5" />
        ) : (
          <MoreVertical className="w-3.5 h-3.5" />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close message actions"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div className={menuClass}>
            <button
              type="button"
              className={itemClass}
              onClick={() => runAction(onReply)}
            >
              <Reply className="w-4 h-4 text-emerald-500" />
              Reply
            </button>

            <button
              type="button"
              className={itemClass}
              onClick={() => runAction(onForward)}
            >
              <Forward className="w-4 h-4 text-sky-500" />
              Forward
            </button>

            <div className="my-1 border-t border-slate-500/20" />

            <button
              type="button"
              className={itemClass}
              onClick={() => runAction(onDeleteForMe)}
            >
              <Trash2 className="w-4 h-4 text-amber-500" />
              Delete for me
            </button>

            {isMe && (
              <button
                type="button"
                className={itemClass}
                onClick={() => runAction(onDeleteForEveryone)}
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                Delete for everyone
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
