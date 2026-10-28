import React, { useState } from 'react';
import {
  Users,
  Shield,
  X,
  Lock,
  UserPlus,
  LogOut,
  Bell,
  BellOff,
  CheckCircle2,
  Crown,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import { Chat, User } from '../types';
import { useTheme } from '../context/ThemeContext';
import { INITIAL_USERS } from '../data/mockData';

interface GroupInfoModalProps {
  chat: Chat;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onAddMember?: (newMember: User) => void;
  onLeaveGroup?: () => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  chat,
  currentUser,
  isOpen,
  onClose,
  onAddMember,
  onLeaveGroup,
}) => {
  const { isDark } = useTheme();
  const [isMuted, setIsMuted] = useState(chat.isMuted || false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  if (!isOpen || !chat.isGroup) return null;

  const members = chat.groupMembers || [currentUser];
  const groupAdminId = chat.groupAdminId || currentUser.id;

  const availableToAdd = INITIAL_USERS.filter(
    (u) => !members.some((m) => m.id === u.id) && !u.isBanned
  );

  const handleCopy = () => {
    navigator.clipboard?.writeText(chat.encryptionFingerprint);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-md max-h-[85vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isDark
            ? 'bg-[#111b21] border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}
      >
        {/* TOP BAR */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between select-none ${
            isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-sm">Group Information</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-full transition cursor-pointer ${
              isDark
                ? 'hover:bg-slate-700/60 text-slate-400 hover:text-white'
                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Group Header Card */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3">
              <img
                src={chat.groupIcon || chat.participant.avatar}
                alt={chat.groupName}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-emerald-500/40 shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                <Shield className="w-3.5 h-3.5" />
              </div>
            </div>

            <h2 className="text-lg font-bold leading-tight">{chat.groupName}</h2>
            <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
              Group • {members.length} Participants
            </p>
            <p
              className={`text-xs mt-2 max-w-xs leading-relaxed ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {chat.groupDescription || 'Encrypted group conversation.'}
            </p>
          </div>

          {/* Quick Settings Row */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between ${
              isDark ? 'bg-[#202c33] border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isMuted ? (
                <BellOff className="w-4 h-4 text-amber-500" />
              ) : (
                <Bell className="w-4 h-4 text-emerald-500" />
              )}
              <div>
                <p className="text-xs font-semibold">Mute Group Notifications</p>
                <p className="text-[10px] text-slate-500 font-mono">Silence audio alerts</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`px-3 py-1 rounded-xl text-xs font-mono font-semibold transition cursor-pointer ${
                isMuted
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                  : 'bg-emerald-600/20 text-emerald-600 border border-emerald-500/40'
              }`}
            >
              {isMuted ? 'Muted' : 'Active'}
            </button>
          </div>

          {/* E2EE Group Encryption Info */}
          <div
            className={`p-4 rounded-2xl border space-y-2.5 ${
              isDark ? 'bg-[#14232f] border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Multi-Party Ratchet E2EE
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[10px] text-slate-500 hover:text-emerald-500 flex items-center gap-1 font-mono cursor-pointer"
              >
                {copiedFingerprint ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copiedFingerprint ? 'Copied' : 'Copy Key'}
              </button>
            </div>
            <p
              className={`text-[11px] leading-relaxed ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              All transmissions in this group are protected by decentralized post-quantum sender keys. Only authorized members have decryption privileges.
            </p>
            <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 break-all bg-black/10 dark:bg-black/30 p-2 rounded-xl">
              {chat.encryptionFingerprint}
            </p>
          </div>

          {/* Group Members List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Participants ({members.length})
              </h4>

              {availableToAdd.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
              )}
            </div>

            {/* Add Member Dropdown Panel */}
            {showAddMember && (
              <div
                className={`p-3 rounded-2xl border mb-3 space-y-2 ${
                  isDark ? 'bg-[#202c33] border-slate-700' : 'bg-slate-100 border-slate-300'
                }`}
              >
                <p className="text-[11px] font-semibold text-slate-500 font-mono">
                  Select Contact to Add:
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {availableToAdd.map((cand) => (
                    <div
                      key={cand.id}
                      onClick={() => {
                        onAddMember?.(cand);
                        setShowAddMember(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer ${
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={cand.avatar}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-xs font-semibold">{cand.displayName}</p>
                          <p className="text-[10px] text-emerald-500 font-mono">{cand.customId}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 font-mono">
                        + Add
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Members items */}
            <div
              className={`rounded-2xl border divide-y overflow-hidden ${
                isDark ? 'border-slate-800 divide-slate-800/60 bg-[#101c26]' : 'border-slate-200 divide-slate-100 bg-white'
              }`}
            >
              {members.map((member) => {
                const isYou = member.id === currentUser.id;
                const isAdmin = member.id === groupAdminId;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={member.avatar}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-700"
                        />
                        {member.status === 'online' && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#101c26]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-xs leading-none">
                            {member.displayName} {isYou && <span className="text-slate-400 font-normal">(You)</span>}
                          </p>
                          {isAdmin && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-mono font-bold text-[9px]">
                              <Crown className="w-2.5 h-2.5" /> Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                          {member.customId}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500">
                      {member.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Group Action */}
          <button
            type="button"
            onClick={() => {
              onLeaveGroup?.();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Encrypted Group</span>
          </button>
        </div>
      </div>
    </div>
  );
};
