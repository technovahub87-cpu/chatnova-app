import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Search,
  MessageSquare,
  CircleDot,
  Phone,
  Settings,
  MoreVertical,
  Check,
  CheckCheck,
  Plus,
  PhoneCall,
  Video,
  ExternalLink,
  ShieldAlert,
  Key,
  Eye,
  LogOut,
  Sliders,
  Bell,
  Trash2,
  FileText,
  UserPlus,
  Users,
  X,
  Sparkles,
  Laptop,
  QrCode,
  ChevronRight
} from 'lucide-react';
import { User, Chat, Message, CallLog, StatusStory } from '../types';
import {
  INITIAL_CHATS,
  INITIAL_MESSAGES,
  INITIAL_CALLS,
  INITIAL_STATUSES,
  INITIAL_USERS,
} from '../data/mockData';
import { ChatRoom } from './ChatRoom';
import { CallModal } from './CallModal';
import { StatusViewerModal } from './StatusViewerModal';
import { CreateGroupModal } from './CreateGroupModal';
import { LinkedDevicesModal } from './LinkedDevicesModal';
import { wsService } from '../services/websocket';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import { generateFingerprint } from '../services/crypto';

interface DashboardProps {
  currentUser: User;
  onLogout: () => void;
  onOpenMasterAdmin: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  onLogout,
  onOpenMasterAdmin,
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'calls' | 'settings'>('chats');

  // Pre-seed with a group chat if none exists yet
  const [chats, setChats] = useState<Chat[]>(() => {
    const existingGroup = INITIAL_CHATS.find((c) => c.isGroup);
    if (existingGroup) return INITIAL_CHATS;

    const sampleGroup: Chat = {
      id: 'group_relay_squad',
      participant: {
        id: 'group_relay_squad_root',
        customId: '@group_relay_squad',
        displayName: 'Quantum Relay Squad',
        avatar: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200&auto=format&fit=crop&q=80',
        bio: 'Offshore mesh audit team',
        status: 'online',
        lastSeen: '4 members',
        publicKeyFingerprint: generateFingerprint(),
        role: 'user',
        twoFactorEnabled: true,
        createdAt: '2026-03-01',
      },
      isGroup: true,
      groupName: 'Quantum Relay Squad',
      groupIcon: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200&auto=format&fit=crop&q=80',
      groupAdminId: currentUser.id,
      groupDescription: 'Multi-party encrypted mesh coordination & zero-knowledge audit channel.',
      groupMembers: [currentUser, INITIAL_USERS[1], INITIAL_USERS[2], INITIAL_USERS[3]],
      unreadCount: 1,
      isPinned: true,
      isMuted: false,
      encryptionFingerprint: '4491 8802 1109 3381 7720 5410',
      lastMessage: {
        id: 'msg_group_init',
        chatId: 'group_relay_squad',
        senderId: INITIAL_USERS[1].id,
        senderName: INITIAL_USERS[1].displayName,
        type: 'text',
        content: 'All nodes in the Zurich enclave passed the zero-leak benchmark. Ready for rotation.',
        timestamp: '08:44 AM',
        status: 'delivered',
      },
    };

    return [sampleGroup, ...INITIAL_CHATS];
  });

  const [messagesMap, setMessagesMap] = useState<{ [chatId: string]: Message[] }>(() => {
    return {
      ...INITIAL_MESSAGES,
      group_relay_squad: [
        {
          id: 'm_g1',
          chatId: 'group_relay_squad',
          senderId: currentUser.id,
          senderName: currentUser.displayName,
          type: 'system',
          content: 'You created group "Quantum Relay Squad" with 4 members. Multi-party sender keys active.',
          timestamp: '08:30 AM',
          status: 'read',
        },
        {
          id: 'm_g2',
          chatId: 'group_relay_squad',
          senderId: INITIAL_USERS[2].id,
          senderName: INITIAL_USERS[2].displayName,
          type: 'text',
          content: 'Marcus online. Air-gapped testbench linked to offshore relay.',
          timestamp: '08:35 AM',
          status: 'read',
        },
        {
          id: 'm_g3',
          chatId: 'group_relay_squad',
          senderId: INITIAL_USERS[1].id,
          senderName: INITIAL_USERS[1].displayName,
          type: 'text',
          content: 'All nodes in the Zurich enclave passed the zero-leak benchmark. Ready for rotation.',
          timestamp: '08:44 AM',
          status: 'delivered',
        },
      ],
    };
  });

  const [activeChatId, setActiveChatId] = useState<string | null>('group_relay_squad');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Calls state
  const [calls, setCalls] = useState<CallLog[]>(INITIAL_CALLS);
  const [activeCall, setActiveCall] = useState<{
    participant: User;
    type: 'voice' | 'video';
  } | null>(null);

  // Status stories state
  const [statuses, setStatuses] = useState<StatusStory[]>(INITIAL_STATUSES);
  const [selectedStory, setSelectedStory] = useState<StatusStory | null>(null);
  const [newStatusText, setNewStatusText] = useState('');
  const [showNewStatusModal, setShowNewStatusModal] = useState(false);

  // New Chat & New Group modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newChatCustomId, setNewChatCustomId] = useState('');
  const [newChatError, setNewChatError] = useState('');

  // Top header menu dropdown
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showLinkedDevicesModal, setShowLinkedDevicesModal] = useState(false);

  // Global broadcast toast from WebSocket
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null);

  // Setup WebSocket listeners
  useEffect(() => {
    const unsubMsg = wsService.on('chat:new_message', (newMsg: Message) => {
      setMessagesMap((prev) => {
        const currentList = prev[newMsg.chatId] || [];
        return {
          ...prev,
          [newMsg.chatId]: [...currentList, newMsg],
        };
      });

      setChats((prev) =>
        prev.map((c) => {
          if (c.id === newMsg.chatId) {
            return {
              ...c,
              lastMessage: newMsg,
              unreadCount: activeChatId === newMsg.chatId ? 0 : c.unreadCount + 1,
            };
          }
          return c;
        })
      );
    });

    const unsubStatus = wsService.on('chat:message_status', (data: any) => {
      setMessagesMap((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((cId) => {
          updated[cId] = updated[cId].map((m) =>
            m.id === data.messageId ? { ...m, status: data.status } : m
          );
        });
        return updated;
      });
    });

    const unsubBroadcast = wsService.on('admin:broadcast', (data: any) => {
      setBroadcastNotice(data.message);
      setTimeout(() => setBroadcastNotice(null), 7000);
    });

    return () => {
      unsubMsg();
      unsubStatus();
      unsubBroadcast();
    };
  }, [activeChatId]);

  const handleSendMessage = (msgData: Partial<Message>) => {
    if (!activeChatId) return;

    const fullMsg: Message = {
      id: 'msg_' + Date.now(),
      chatId: activeChatId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      type: msgData.type || 'text',
      content: msgData.content || '',
      timestamp: msgData.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      voice: msgData.voice,
      media: msgData.media,
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), fullMsg],
    }));

    setChats((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, lastMessage: fullMsg } : c))
    );

    const currentChat = chats.find((c) => c.id === activeChatId);
    wsService.send('chat:send_message', {
      chatId: activeChatId,
      recipientId: currentChat?.participant.id,
      recipientName: currentChat?.participant.displayName,
      isGroup: currentChat?.isGroup,
      groupName: currentChat?.groupName,
      groupMembers: currentChat?.groupMembers,
      message: fullMsg,
    });
  };

  const handleCreateNewChat = (e: React.FormEvent) => {
    e.preventDefault();
    setNewChatError('');
    const formattedId = newChatCustomId.trim().startsWith('@')
      ? newChatCustomId.trim()
      : `@${newChatCustomId.trim()}`;

    const foundUser = INITIAL_USERS.find(
      (u) => u.customId.toLowerCase() === formattedId.toLowerCase()
    );

    if (!foundUser) {
      setNewChatError(`Identity ${formattedId} not found on zero-log directory.`);
      return;
    }

    if (foundUser.id === currentUser.id) {
      setNewChatError('You cannot start a chat with yourself.');
      return;
    }

    const existing = chats.find((c) => !c.isGroup && c.participant.id === foundUser.id);
    if (existing) {
      setActiveChatId(existing.id);
      setShowNewChatModal(false);
      setNewChatCustomId('');
      setActiveTab('chats');
      return;
    }

    const newChat: Chat = {
      id: 'chat_' + foundUser.id,
      participant: foundUser,
      isGroup: false,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      encryptionFingerprint: foundUser.publicKeyFingerprint,
    };

    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setShowNewChatModal(false);
    setNewChatCustomId('');
    setActiveTab('chats');
  };

  const handleCreateGroup = (newGroupChat: Chat) => {
    setChats([newGroupChat, ...chats]);
    setActiveChatId(newGroupChat.id);
    if (newGroupChat.lastMessage) {
      setMessagesMap((prev) => ({
        ...prev,
        [newGroupChat.id]: [newGroupChat.lastMessage!],
      }));
    }
    setActiveTab('chats');
  };

  const handleUpdateChat = (updatedChat: Chat) => {
    setChats((prev) => prev.map((c) => (c.id === updatedChat.id ? updatedChat : c)));
    if (updatedChat.lastMessage) {
      setMessagesMap((prev) => ({
        ...prev,
        [updatedChat.id]: [...(prev[updatedChat.id] || []), updatedChat.lastMessage!],
      }));
    }
  };

  const handlePostStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusText.trim()) return;

    const newStory: StatusStory = {
      id: 'story_' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.displayName,
      customId: currentUser.customId,
      userAvatar: currentUser.avatar,
      text: newStatusText.trim(),
      timestamp: 'Just now',
      isViewed: false,
      viewsCount: 0,
    };

    setStatuses([newStory, ...statuses]);
    setNewStatusText('');
    setShowNewStatusModal(false);
  };

  const filteredChats = chats.filter((c) => {
    const title = c.isGroup ? c.groupName : c.participant.displayName;
    const subtitle = c.isGroup ? c.groupMembers?.map((m) => m.displayName).join(' ') : c.participant.customId;
    const lastContent = c.lastMessage?.content || '';

    return (
      (title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (subtitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      lastContent.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const selectedChat = chats.find((c) => c.id === activeChatId);

  return (
    <div
      className={`relative h-dvh w-dvw flex overflow-hidden font-sans transition-colors duration-300 ${
        isDark ? 'bg-[#0b141a] text-slate-100' : 'bg-[#f0f2f5] text-slate-900'
      }`}
    >
      {/* Global Broadcast Notification Toast */}
      {broadcastNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>MASTER ANNOUNCEMENT: {broadcastNotice}</span>
        </div>
      )}

      {/* LEFT PANE / MAIN DASHBOARD (Chats list / tabs) */}
      <div
        className={`w-full md:w-[380px] lg:w-[420px] h-full flex flex-col border-r shrink-0 transition-colors duration-200 ${
          isDark
            ? 'bg-[#111b21] border-slate-800'
            : 'bg-[#ffffff] border-slate-200 shadow-sm'
        } ${activeChatId ? 'hidden md:flex' : 'flex'}`}
      >
        {/* TOP WHATSAPP-STYLE HEADER */}
        <div
          className={`px-4 py-3 flex items-center justify-between border-b select-none transition-colors duration-200 ${
            isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
          }`}
        >
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => {
              // Secret stealth backdoor: 5 rapid clicks on logo opens master admin for authorized operators
              (window as any).__chatnova_logo_taps = ((window as any).__chatnova_logo_taps || 0) + 1;
              clearTimeout((window as any).__chatnova_logo_timer);
              if ((window as any).__chatnova_logo_taps >= 5) {
                (window as any).__chatnova_logo_taps = 0;
                onOpenMasterAdmin();
              } else {
                (window as any).__chatnova_logo_timer = setTimeout(() => {
                  (window as any).__chatnova_logo_taps = 0;
                }, 2200);
              }
            }}
            title="ChatNova Enclave"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-900/20">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1
                className={`text-lg font-bold leading-tight flex items-center gap-1.5 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Chat<span className="text-emerald-500 font-extrabold">Nova</span>
              </h1>
              <p className="text-[9px] font-mono tracking-widest text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                Your Privacy • Our Priority
              </p>
            </div>
          </div>

          {/* Header Action Icons: Theme Toggle, Master Admin (Strict RBAC), Menu */}
          <div className="flex items-center gap-1.5 relative">
            <ThemeToggle />

            {/* STRICT RBAC: Master Admin button is completely hidden from normal users */}
            {currentUser.role === 'master_admin' && (
              <button
                type="button"
                onClick={onOpenMasterAdmin}
                title="Master Admin Console (/master-admin)"
                className={`p-2 rounded-full transition cursor-pointer ${
                  isDark
                    ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-700/60'
                    : 'text-emerald-700 hover:text-emerald-800 hover:bg-slate-200/80'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className={`p-2 rounded-full transition cursor-pointer ${
                isDark
                  ? 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Dropdown Menu */}
            {showHeaderMenu && (
              <div
                className={`absolute right-0 top-11 z-40 w-52 rounded-2xl border shadow-2xl py-1 text-xs transition-colors duration-150 ${
                  isDark
                    ? 'bg-[#233138] border-slate-700 text-slate-100'
                    : 'bg-white border-slate-200 text-slate-800 shadow-xl'
                }`}
              >
                {/* Create Group Option (Requested) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroupModal(true);
                    setShowHeaderMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 transition cursor-pointer ${
                    isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold">New Encrypted Group</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowNewChatModal(true);
                    setShowHeaderMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 transition cursor-pointer ${
                    isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'
                  }`}
                >
                  <UserPlus className="w-4 h-4 text-emerald-500" />
                  <span>New Custom ID Chat</span>
                </button>

                {/* Linked Devices Option (WhatsApp style) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkedDevicesModal(true);
                    setShowHeaderMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 transition cursor-pointer ${
                    isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'
                  }`}
                >
                  <Laptop className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold">Linked Devices</span>
                </button>

                {currentUser.role === 'master_admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMasterAdmin();
                      setShowHeaderMenu(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left font-mono font-bold flex items-center gap-2.5 transition cursor-pointer ${
                      isDark
                        ? 'text-amber-400 hover:bg-slate-700/60'
                        : 'text-amber-600 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Master Admin Portal</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('settings');
                    setShowHeaderMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 transition cursor-pointer ${
                    isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'
                  }`}
                >
                  <Settings className="w-4 h-4 text-teal-500" />
                  <span>Privacy Settings</span>
                </button>

                <div
                  className={`my-1 border-t ${
                    isDark ? 'border-slate-700' : 'border-slate-200'
                  }`}
                />

                <button
                  type="button"
                  onClick={onLogout}
                  className={`w-full px-4 py-2.5 text-left text-rose-500 flex items-center gap-2.5 transition cursor-pointer ${
                    isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out ({currentUser.customId})</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TOP TABS BAR (Chats, Status, Calls, Settings) */}
        <div
          className={`grid grid-cols-4 text-xs font-semibold border-b select-none transition-colors duration-200 ${
            isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('chats')}
            className={`py-3 flex flex-col items-center gap-1 border-b-2 transition cursor-pointer ${
              activeTab === 'chats'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-4 h-4" />
              {chats.some((c) => c.unreadCount > 0) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </div>
            <span>Chats</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3 flex flex-col items-center gap-1 border-b-2 transition cursor-pointer ${
              activeTab === 'status'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CircleDot className="w-4 h-4" />
            <span>Status</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className={`py-3 flex flex-col items-center gap-1 border-b-2 transition cursor-pointer ${
              activeTab === 'calls'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Calls</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-3 flex flex-col items-center gap-1 border-b-2 transition cursor-pointer ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>

        {/* SEARCH BAR (for Chats and Contacts) */}
        {(activeTab === 'chats' || activeTab === 'calls') && (
          <div
            className={`p-3 border-b transition-colors duration-200 ${
              isDark ? 'bg-[#111b21] border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search encrypted chats, groups, or @custom_id..."
                className={`w-full rounded-xl pl-9 pr-4 py-2 text-xs transition focus:outline-none focus:ring-1 focus:ring-emerald-500 border ${
                  isDark
                    ? 'bg-[#202c33] border border-slate-700/60 text-white placeholder-slate-400'
                    : 'bg-[#f0f2f5] border border-slate-200 text-slate-900 placeholder-slate-500 focus:bg-white'
                }`}
              />
            </div>
          </div>
        )}

        {/* TAB 1: CHATS LIST */}
        {activeTab === 'chats' && (
          <div
            className={`flex-1 overflow-y-auto divide-y transition-colors duration-200 ${
              isDark ? 'divide-slate-800/60' : 'divide-slate-100'
            }`}
          >
            {filteredChats.map((chat) => {
              const isActive = chat.id === activeChatId;
              const lastMsg = chat.lastMessage;
              const isSentByMe = lastMsg?.senderId === currentUser.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setChats((prev) =>
                      prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
                    );
                  }}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition select-none ${
                    isActive
                      ? isDark
                        ? 'bg-[#2a3942]'
                        : 'bg-[#f0f2f5]'
                      : isDark
                      ? 'hover:bg-[#202c33]/60'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Contact / Group Avatar */}
                  <div className="relative shrink-0">
                    <img
                      src={chat.groupIcon || chat.participant.avatar}
                      alt={chat.groupName || chat.participant.displayName}
                      className={`w-12 h-12 rounded-full object-cover ring-1 ${
                        isDark ? 'ring-slate-700' : 'ring-slate-200'
                      }`}
                    />
                    {chat.isGroup ? (
                      <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white dark:border-[#111b21] flex items-center justify-center text-white">
                        <Users className="w-2.5 h-2.5" />
                      </span>
                    ) : chat.participant.status === 'online' ? (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111b21]" />
                    ) : null}
                  </div>

                  {/* Contact / Group Info & Message Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`font-semibold text-sm truncate ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {chat.isGroup ? chat.groupName : chat.participant.displayName}
                        </span>
                        {chat.isGroup ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-[9.5px] text-emerald-600 dark:text-emerald-400 font-mono font-bold shrink-0">
                            GROUP
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold shrink-0">
                            {chat.participant.customId}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-mono shrink-0 ml-2 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {lastMsg?.timestamp || 'Online'}
                      </span>
                    </div>

                    <div
                      className={`flex items-center justify-between text-xs ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1 truncate text-[12px]">
                        {isSentByMe && lastMsg && (
                          <span className="inline-flex shrink-0">
                            {lastMsg.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </span>
                        )}
                        <span className="truncate">
                          {lastMsg ? (
                            chat.isGroup && !isSentByMe ? (
                              <span className="font-semibold text-teal-600 dark:text-teal-400">
                                {lastMsg.senderName}: {lastMsg.content}
                              </span>
                            ) : (
                              lastMsg.content
                            )
                          ) : (
                            'Encrypted channel ready.'
                          )}
                        </span>
                      </div>

                      {chat.unreadCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white dark:text-slate-950 font-bold text-[10px] shrink-0 font-mono">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredChats.length === 0 && (
              <div
                className={`p-8 text-center text-xs ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                No encrypted conversations match your query.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STATUS STORIES */}
        {activeTab === 'status' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div
              className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                isDark ? 'bg-[#202c33] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={currentUser.avatar}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewStatusModal(true)}
                    className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-[#202c33] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    My Status
                  </h4>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Tap to share an encrypted story
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNewStatusModal(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white dark:text-slate-950 text-xs font-bold transition font-mono cursor-pointer"
              >
                Add Status
              </button>
            </div>

            <div>
              <h5 className="text-[11px] uppercase tracking-wider font-mono text-emerald-600 dark:text-emerald-400 font-bold mb-2 px-1">
                Recent Updates (24h Auto-Expire)
              </h5>
              <div className="space-y-1">
                {statuses.map((story) => (
                  <div
                    key={story.id}
                    onClick={() => setSelectedStory(story)}
                    className={`flex items-center gap-3 p-2.5 rounded-2xl transition cursor-pointer ${
                      isDark ? 'hover:bg-[#202c33]' : 'hover:bg-slate-100 bg-white border border-slate-100 shadow-xs'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full p-0.5 ring-2 ring-emerald-500">
                      <img
                        src={story.userAvatar}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {story.userName}
                        </p>
                        <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {story.timestamp}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate font-medium">
                        {story.customId}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CALLS LOGS */}
        {activeTab === 'calls' && (
          <div
            className={`flex-1 overflow-y-auto divide-y transition-colors ${
              isDark ? 'divide-slate-800/60' : 'divide-slate-100'
            }`}
          >
            {calls.map((call) => (
              <div
                key={call.id}
                className={`flex items-center justify-between px-4 py-3 transition ${
                  isDark ? 'hover:bg-[#202c33]/60' : 'hover:bg-slate-50 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={call.participant.avatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {call.participant.displayName}
                    </h4>
                    <p className={`text-[11px] font-mono flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span className={call.direction === 'missed' ? 'text-rose-500 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                        {call.direction === 'incoming' && '↙ Incoming'}
                        {call.direction === 'outgoing' && '↗ Outgoing'}
                        {call.direction === 'missed' && '✕ Missed'}
                      </span>
                      <span>•</span>
                      <span>{call.timestamp}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCall({ participant: call.participant, type: 'voice' })}
                    className={`p-2 rounded-full transition cursor-pointer ${
                      isDark ? 'hover:bg-slate-700/60 text-emerald-400' : 'hover:bg-slate-100 text-emerald-600'
                    }`}
                    title="Voice Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCall({ participant: call.participant, type: 'video' })}
                    className={`p-2 rounded-full transition cursor-pointer ${
                      isDark ? 'hover:bg-slate-700/60 text-teal-400' : 'hover:bg-slate-100 text-teal-600'
                    }`}
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: SETTINGS & PRIVACY HUB */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div
              className={`p-4 rounded-2xl border flex items-center gap-3 transition-colors ${
                isDark ? 'bg-[#202c33] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <img
                src={currentUser.avatar}
                alt=""
                className="w-14 h-14 rounded-full object-cover ring-2 ring-emerald-500"
              />
              <div className="flex-1 min-w-0">
                <h4 className={`font-bold text-base truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.displayName}
                </h4>
                <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {currentUser.customId}
                </p>
                <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {currentUser.bio}
                </p>
              </div>
            </div>

            <ThemeToggle variant="row" />

            <div
              className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                isDark
                  ? 'bg-[#14232f] border-emerald-500/30'
                  : 'bg-emerald-50/70 border-emerald-200 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <Lock className="w-4 h-4" />
                <span>Zero-Knowledge Encryption Vault</span>
              </div>
              <div>
                <p className={`text-[10px] uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Public Key Fingerprint
                </p>
                <p className={`text-xs font-mono font-bold mt-0.5 break-all ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {currentUser.publicKeyFingerprint}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(true)}
                className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                  isDark
                    ? 'bg-[#202c33] hover:bg-[#28373f] border-slate-800'
                    : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Create Encrypted Group
                    </p>
                    <p className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Multi-recipient E2EE ratchet
                    </p>
                  </div>
                </div>
                <Plus className="w-4 h-4 text-emerald-500" />
              </button>

              {/* Linked Devices Option in Settings Tab */}
              <button
                type="button"
                onClick={() => setShowLinkedDevicesModal(true)}
                className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                  isDark
                    ? 'bg-[#202c33] hover:bg-[#28373f] border-slate-800'
                    : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-500 flex items-center justify-center">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Linked Devices
                    </p>
                    <p className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Link Web, Desktop, & Tablets via QR code
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {currentUser.role === 'master_admin' && (
                <button
                  type="button"
                  onClick={onOpenMasterAdmin}
                  className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    isDark
                      ? 'bg-[#202c33] hover:bg-[#28373f] border-slate-800'
                      : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Master Admin Portal
                      </p>
                      <p className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Route: /master-admin (HSM Protected)
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                className="w-full p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      Wipe Ephemeral Session
                    </p>
                    <p className="text-[10px] text-rose-500/80">
                      Log out and clear memory cache
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* FLOATING ACTION BUTTONS (FAB) FOR NEW CHAT & GROUP */}
        {activeTab === 'chats' && (
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-30">
            {/* Create Group Button */}
            <button
              type="button"
              onClick={() => setShowCreateGroupModal(true)}
              className="w-11 h-11 rounded-2xl bg-[#202c33] hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg transition transform active:scale-95 cursor-pointer ml-auto"
              title="Create Encrypted Group"
            >
              <Users className="w-5 h-5" />
            </button>

            {/* Direct Chat Button */}
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="w-14 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 flex items-center justify-center shadow-xl transition transform active:scale-95 cursor-pointer"
              title="Start New Encrypted Chat"
            >
              <UserPlus className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* RIGHT PANE: ACTIVE CHAT ROOM (OR WELCOME DESKTOP EMPTY STATE) */}
      <div className={`flex-1 h-full flex flex-col ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
        {selectedChat ? (
          <ChatRoom
            chat={selectedChat}
            currentUser={currentUser}
            messages={messagesMap[selectedChat.id] || []}
            onBack={() => setActiveChatId(null)}
            onSendMessage={handleSendMessage}
            onStartCall={(type) =>
              setActiveCall({ participant: selectedChat.participant, type })
            }
            onUpdateChat={handleUpdateChat}
          />
        ) : (
          <div
            className={`flex-1 flex flex-col items-center justify-center p-8 text-center select-none transition-colors duration-200 ${
              isDark ? 'bg-[#0b141a]' : 'bg-[#f0f2f5]'
            }`}
          >
            <div
              className={`w-24 h-24 rounded-3xl border-2 flex items-center justify-center mb-6 shadow-xl ${
                isDark
                  ? 'bg-gradient-to-br from-[#11242e] to-[#0a171f] border-emerald-500/40'
                  : 'bg-white border-emerald-400/60 shadow-emerald-900/10'
              }`}
            >
              <Shield className="w-12 h-12 text-emerald-500" />
            </div>
            <h2
              className={`text-2xl font-bold mb-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Chat<span className="text-emerald-500 font-extrabold">Nova</span> Web & Enclave
            </h2>
            <p className="text-xs font-mono uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold mb-3">
              Your Privacy • Our Priority
            </p>
            <p
              className={`text-xs max-w-sm leading-relaxed mb-6 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Select a conversation, direct channel, or group from the left pane. All transmissions are protected by 256-bit Post-Quantum ratchets.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer font-mono shadow-md border border-slate-700"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Create Group</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs transition flex items-center gap-2 cursor-pointer font-mono shadow-md"
              >
                <UserPlus className="w-4 h-4" />
                <span>Direct Custom ID</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        currentUser={currentUser}
        onClose={() => setShowCreateGroupModal(false)}
        onCreateGroup={handleCreateGroup}
      />

      {/* NEW CHAT WITH CUSTOM ID MODAL */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl transition-colors ${
              isDark ? 'bg-[#111b21] border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b mb-4 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-500" />
                <h3
                  className={`font-bold text-base ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Start New Encrypted Chat
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNewChatModal(false);
                  setNewChatError('');
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newChatError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                {newChatError}
              </div>
            )}

            <form onSubmit={handleCreateNewChat} className="space-y-4">
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Recipient Custom Username / ID
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    value={newChatCustomId.replace(/^@/, '')}
                    onChange={(e) =>
                      setNewChatCustomId(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                      )
                    }
                    placeholder="elena_prime or marcus_vance"
                    className={`w-full rounded-xl pl-8 pr-4 py-2.5 text-xs font-mono transition focus:outline-none focus:ring-2 focus:ring-emerald-500 border ${
                      isDark
                        ? 'bg-[#0b141a] border-slate-700 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                    }`}
                    required
                  />
                </div>
              </div>

              <div>
                <span
                  className={`text-[11px] font-mono block mb-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Available Test Identities:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {INITIAL_USERS.filter((u) => u.id !== currentUser.id && !u.isBanned).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setNewChatCustomId(u.customId)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition cursor-pointer ${
                        isDark
                          ? 'bg-slate-900 border-slate-800 text-emerald-300 hover:border-emerald-500/50'
                          : 'bg-slate-100 border-slate-200 text-emerald-800 hover:border-emerald-500'
                      }`}
                    >
                      {u.customId}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs transition cursor-pointer shadow"
              >
                Open Encrypted Channel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NEW STATUS STORY MODAL */}
      {showNewStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-sm border rounded-3xl p-6 shadow-2xl transition-colors ${
              isDark ? 'bg-[#111b21] border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <h3
              className={`font-bold text-base mb-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Publish 24h Encrypted Story
            </h3>
            <p
              className={`text-xs mb-4 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Your status will be broadcast to approved contacts and self-destruct in 24 hours.
            </p>

            <form onSubmit={handlePostStatus} className="space-y-4">
              <textarea
                rows={3}
                value={newStatusText}
                onChange={(e) => setNewStatusText(e.target.value)}
                placeholder="What's happening? (Encrypted update)..."
                className={`w-full rounded-xl p-3 text-xs transition focus:outline-none focus:ring-2 focus:ring-emerald-500 border ${
                  isDark
                    ? 'bg-[#0b141a] border-slate-700 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                }`}
                required
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewStatusModal(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white dark:text-slate-950 text-xs font-bold cursor-pointer shadow"
                >
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CALL MODAL */}
      {activeCall && (
        <CallModal
          participant={activeCall.participant}
          type={activeCall.type}
          isOpen={true}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* STATUS STORY VIEWER MODAL */}
      {selectedStory && (
        <StatusViewerModal
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
          onReply={(userName, text) => {
            const contactChat = chats.find((c) => c.participant.displayName === userName);
            if (contactChat) {
              setActiveChatId(contactChat.id);
              handleSendMessage({
                content: `Replying to status: "${text}"`,
              });
            }
          }}
        />
      )}

      {/* LINKED DEVICES MODAL */}
      <LinkedDevicesModal
        isOpen={showLinkedDevicesModal}
        onClose={() => setShowLinkedDevicesModal(false)}
        currentUser={currentUser}
      />
    </div>
  );
};
