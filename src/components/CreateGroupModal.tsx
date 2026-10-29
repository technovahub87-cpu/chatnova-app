import React, { useState } from 'react';
import {
  Users,
  Shield,
  X,
  Check,
  Search,
  Lock,
  ArrowRight,
  Sparkles,
  Camera
} from 'lucide-react';
import { User, Chat } from '../types';
import { INITIAL_USERS } from '../data/mockData';
import { useTheme } from '../context/ThemeContext';
import { generateFingerprint } from '../services/crypto';

interface CreateGroupModalProps {
  isOpen: boolean;
  currentUser?: User | null;
  onClose: () => void;
  onCreateGroup: (newGroupChat: Chat) => void;
}

const DEFAULT_GROUP_ICONS = [
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&auto=format&fit=crop&q=80',
];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onCreateGroup,
}) => {
  const { isDark } = useTheme();
  const [step, setStep] = useState<'select_members' | 'group_details'>('select_members');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(DEFAULT_GROUP_ICONS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !currentUser) return null;

  // Candidate members (exclude current user)
  const candidateUsers = INITIAL_USERS.filter(
    (u) => u && u.id !== currentUser.id && !u.isBanned
  ).filter(
    (u) =>
      (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.customId && u.customId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleSelectUser = (id: string) => {
    if (!id) return;
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter((item) => item !== id));
    } else {
      setSelectedUserIds([...selectedUserIds, id]);
    }
  };

  const handleNextToDetails = () => {
    if (selectedUserIds.length === 0) {
      setErrorMsg('Please select at least 1 member for the group.');
      return;
    }
    setErrorMsg('');
    setStep('group_details');
  };

  const handleFinishCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setErrorMsg('Please enter a group subject / name.');
      return;
    }

    const selectedMembers = INITIAL_USERS.filter((u) => u && selectedUserIds.includes(u.id));
    const allMembers = [currentUser, ...selectedMembers];
    const cleanGroupName = groupName.trim();

    const newGroupChat: Chat = {
      id: 'group_' + Date.now(),
      participant: {
        id: 'group_root',
        customId: `@group_${cleanGroupName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        displayName: cleanGroupName,
        avatar: selectedIcon,
        bio: groupDescription.trim() || 'Encrypted group channel',
        status: 'online',
        lastSeen: `${allMembers.length} members`,
        publicKeyFingerprint: generateFingerprint(),
        role: 'user',
        twoFactorEnabled: true,
        createdAt: new Date().toISOString(),
      },
      isGroup: true,
      groupName: cleanGroupName,
      groupIcon: selectedIcon,
      groupAdminId: currentUser.id,
      groupDescription: groupDescription.trim() || 'ChatNova End-to-End Encrypted Group Session',
      groupMembers: allMembers,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      encryptionFingerprint: generateFingerprint(),
      lastMessage: {
        id: 'msg_' + Date.now(),
        chatId: 'group_' + Date.now(),
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        type: 'system',
        content: `You created group "${cleanGroupName}" with ${allMembers.length} members. 256-bit Group Ratchet is active.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read',
      },
    };

    onCreateGroup(newGroupChat);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isDark
            ? 'bg-[#111b21] border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}
      >
        {/* MODAL HEADER */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between select-none ${
            isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">
                {step === 'select_members' ? 'Add Group Participants' : 'New Group Details'}
              </h3>
              <p
                className={`text-[11px] font-mono ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {step === 'select_members'
                  ? `${selectedUserIds.length} members selected`
                  : 'Set group subject & encrypted badge'}
              </p>
            </div>
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

        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: SELECT PARTICIPANTS */}
        {step === 'select_members' && (
          <div className="p-4 flex flex-col gap-3 max-h-[70vh]">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contact by name or @custom_id..."
                className={`w-full rounded-xl pl-9 pr-4 py-2 text-xs transition focus:outline-none focus:ring-1 focus:ring-emerald-500 border ${
                  isDark
                    ? 'bg-[#202c33] border-slate-700 text-white placeholder-slate-400'
                    : 'bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-500 focus:bg-white'
                }`}
              />
            </div>

            {/* Selected Pills horizontal row */}
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 py-1">
                {selectedUserIds.map((id) => {
                  const u = INITIAL_USERS.find((x) => x && x.id === id);
                  if (!u) return null;
                  return (
                    <span
                      key={id}
                      onClick={() => toggleSelectUser(id)}
                      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full text-[11px] font-mono cursor-pointer transition ${
                        isDark
                          ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 hover:bg-rose-950/60'
                          : 'bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-rose-50'
                      }`}
                    >
                      <img src={u.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                      <span>{u.customId}</span>
                      <X className="w-3 h-3 text-slate-400" />
                    </span>
                  );
                })}
              </div>
            )}

            {/* Candidate List */}
            <div
              className={`flex-1 overflow-y-auto divide-y rounded-2xl border max-h-60 ${
                isDark ? 'border-slate-800 divide-slate-800/60' : 'border-slate-200 divide-slate-100'
              }`}
            >
              {candidateUsers.map((user) => {
                if (!user) return null;
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleSelectUser(user.id)}
                    className={`flex items-center justify-between px-3.5 py-2.5 transition cursor-pointer select-none ${
                      isSelected
                        ? isDark
                          ? 'bg-emerald-950/30'
                          : 'bg-emerald-50/80'
                        : isDark
                        ? 'hover:bg-[#202c33]/50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={user.avatar}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-700"
                      />
                      <div>
                        <p className="font-semibold text-xs leading-none mb-0.5">
                          {user.displayName}
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                          {user.customId}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : isDark
                          ? 'border-slate-700 bg-slate-900'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom button */}
            <button
              type="button"
              onClick={handleNextToDetails}
              className="mt-2 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow"
            >
              <span>Next: Group Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: GROUP NAME & AVATAR */}
        {step === 'group_details' && (
          <form onSubmit={handleFinishCreate} className="p-4 space-y-4">
            {/* Avatar Selector */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <img
                  src={selectedIcon}
                  alt="Group Badge"
                  className="w-18 h-18 rounded-2xl object-cover ring-4 ring-emerald-500/40 shadow-md"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Choose Group Enclave Badge:
              </span>
              <div className="flex gap-2">
                {DEFAULT_GROUP_ICONS.map((icon, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIcon(icon)}
                    className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                      selectedIcon === icon ? 'border-emerald-500 scale-105' : 'border-transparent opacity-60'
                    }`}
                  >
                    <img src={icon} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Group Subject / Name */}
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Group Name / Subject
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Zurich Cryptography Core"
                className={`w-full rounded-xl px-4 py-2.5 text-xs transition focus:outline-none focus:ring-1 focus:ring-emerald-500 border ${
                  isDark
                    ? 'bg-[#202c33] border-slate-700 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                }`}
                required
                autoFocus
              />
            </div>

            {/* Group Mission / Description */}
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Group Mission / Topic (Optional)
              </label>
              <input
                type="text"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="e.g. Offshore nodes coordination & mesh audits"
                className={`w-full rounded-xl px-4 py-2 text-xs transition focus:outline-none focus:ring-1 focus:ring-emerald-500 border ${
                  isDark
                    ? 'bg-[#202c33] border-slate-700 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                }`}
              />
            </div>

            {/* Security Badge */}
            <div
              className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-mono ${
                isDark ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Multi-party ratchet keypair will be generated for all {selectedUserIds.length + 1} members.</span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('select_members')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow"
              >
                Create Group
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
