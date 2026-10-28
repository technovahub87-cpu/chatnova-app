import React, { useState, useRef, useEffect } from 'react';
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
  ChevronRight,
  Camera
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
  onUpdateUser?: (updatedUser: User) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  onLogout,
  onOpenMasterAdmin,
  onUpdateUser,
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'calls' | 'settings'>('chats');

  const [chats, setChats] = useState<Chat[]>([]);
  const [messagesMap, setMessagesMap] = useState<{ [chatId: string]: Message[] }>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(currentUser.avatar);

  const [calls, setCalls] = useState<CallLog[]>(INITIAL_CALLS);
  const [activeCall, setActiveCall] = useState<{
    participant: User;
    type: 'voice' | 'video';
  } | null>(null);

  const [statuses, setStatuses] = useState<StatusStory[]>(INITIAL_STATUSES);
  const [newStatusText, setNewStatusText] = useState('');
  const [showNewStatusModal, setShowNewStatusModal] = useState(false);

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newChatCustomId, setNewChatCustomId] = useState('');
  const [newChatError, setNewChatError] = useState('');

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showLinkedDevicesModal, setShowLinkedDevicesModal] = useState(false);
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAvatarPreview(base64String);
        const updatedUser: User = { ...currentUser, avatar: base64String };
        if (onUpdateUser) {
          onUpdateUser(updatedUser);
        }
      };
      reader.readAsDataURL(file);
    }
  };

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

    // ROBUST USER SEARCH ACROSS ALL LOCALSTORAGE KEYS & MOCK DATA
    let allStoredUsers: User[] = [...INITIAL_USERS];
    try {
      const possibleKeys = ['chatnova_registered_users', 'chatnova_users', 'users', 'registered_users'];
      possibleKeys.forEach((key) => {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              parsed.forEach((u: User) => {
                if (u && u.customId && !allStoredUsers.some((existing) => existing.id === u.id || existing.customId === u.customId)) {
                  allStoredUsers.push(u);
                }
              });
            }
          } catch (innerErr) {
            // ignore parse error for specific keys
          }
        }
      });
    } catch (err) {
      console.error('Error scanning localStorage users', err);
    }

    const foundUser = allStoredUsers.find(
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
      encryptionFingerprint: foundUser.publicKeyFingerprint || generateFingerprint(foundUser.id),
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
      {broadcastNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>MASTER ANNOUNCEMENT: {broadcastNotice}</span>
        </div>
      )}

      {/* LEFT PANE */}
      <div
        className={`w-full md:w-[380px] lg:w-[420px] h-full flex flex-col border-r shrink-0 transition-colors duration-200 ${
          isDark ? 'bg-[#111b21] border-slate-800' : 'bg-[#ffffff] border-slate-200 shadow-sm'
        } ${activeChatId ? 'hidden md:flex' : 'flex'}`}
      >
        <div
          className={`px-4 py-3 flex items-center justify-between border-b select-none transition-colors duration-200 ${
            isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
          }`}
        >
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => {
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
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()} title="Change Profile Photo">
              <img
                src={avatarPreview}
                alt={currentUser.displayName}
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-emerald-500/50"
              />
              <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <Camera className="w-4 h-4 text-white" />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            <div>
              <h1 className={`text-lg font-bold leading-tight flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Chat<span className="text-emerald-500 font-extrabold">Nova</span>
              </h1>
              <p className="text-[9px] font-mono tracking-widest text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                Your Privacy • Our Priority
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <ThemeToggle />

            {currentUser.role === 'master_admin' && (
              <button
                type="button"
                onClick={onOpenMasterAdmin}
                title="Master Admin Console"
                className={`p-2 rounded-full transition cursor-pointer ${
                  isDark ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-700/60' : 'text-emerald-700 hover:text-emerald-800 hover:bg-slate-200/80'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className={`p-2 rounded-full transition cursor-pointer ${
                isDark ? 'text-slate-300 hover:text-white hover:bg-slate-700/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showHeaderMenu && (
              <div
                className={`absolute right-0 top-11 z-40 w-52 rounded-2xl border shadow-2xl py-1 text-xs transition-colors duration-150 ${
                  isDark ? 'bg-[#233138] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800 shadow-xl'
                }`}
              >
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
                      isDark ? 'text-amber-400 hover:bg-slate-700/60' : 'text-amber-600 hover:bg-slate-100'
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

                <div className={`my-1 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`} />

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

        {/* TABS BAR */}
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
                : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-slate-900'
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
                : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-slate-900'
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
                : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-slate-900'
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
                : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>

        {/* SEARCH BAR */}
        {(activeTab === 'chats' || activeTab === 'calls') && (
          <div className={`p-3 border-b transition-colors duration-200 ${isDark ? 'bg-[#111b21] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search encrypted chats, groups, or @custom_id..."
                className={`w-full rounded-xl pl-9 pr-4 py-2 text-xs transition focus:outline-none focus:ring-1 focus:ring-emerald-500 border ${
                  isDark ? 'bg-[#202c33] border border-slate-700/60 text-white placeholder-slate-400' : 'bg-[#f0f2f5] border border-slate-200 text-slate-900 placeholder-slate-500 focus:bg-white'
                }`}
              />
            </div>
          </div>
        )}

        {/* TAB 1: CHATS */}
        {activeTab === 'chats' && (
          <div className={`flex-1 overflow-y-auto divide-y transition-colors duration-200 ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
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
                    isActive ? (isDark ? 'bg-[#2a3942]' : 'bg-[#f0f2f5]') : (isDark ? 'hover:bg-[#202c33]/60' : 'hover:bg-slate-50')
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={chat.groupIcon || chat.participant.avatar}
                      alt={chat.groupName || chat.participant.displayName}
                      className={`w-12 h-12 rounded-full object-cover ring-1 ${isDark ? 'ring-slate-700' : 'ring-slate-200'}`}
                    />
                    {chat.isGroup ? (
                      <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white dark:border-[#111b21] flex items-center justify-center text-white">
                        <Users className="w-2.5 h-2.5" />
                      </span>
                    ) : chat.participant.status === 'online' ? (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111b21]" />
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
                      <span className={`text-[10px] font-mono shrink-0 ml-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {lastMsg?.timestamp || 'Online'}
                      </span>
                    </div>

                    <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
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
              <div className={`p-8 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                No encrypted conversations yet. Click the menu (...) to start a new Custom ID chat or create a group!
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STATUS */}
        {activeTab === 'status' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${isDark ? 'bg-[#202c33] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img src={avatarPreview} alt="" className="w-12 h-12 rounded-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setShowNewStatusModal(true)}
                    className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white dark:ring-[#202c33] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>My Status</h4>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tap to share an encrypted story</p>
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
          </div>
        )}

        {/* TAB 3: CALLS */}
        {activeTab === 'calls' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h3 className="text-xs font-bold font-mono tracking-widest text-emerald-500 uppercase mb-2">Recent Encrypted Calls</h3>
            {calls.map((call) => (
              <div key={call.id} className={`p-3 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-[#202c33] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-3">
                  <img src={call.participantAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <h4 className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{call.participantName}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">{call.timestamp}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCall({ participant: { id: call.participantId, customId: call.participantCustomId, displayName: call.participantName, avatar: call.participantAvatar } as User, type: 'voice' })}
                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition cursor-pointer"
                  >
                    <PhoneCall className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <h3 className="text-xs font-bold font-mono tracking-widest text-emerald-500 uppercase mb-2">Encrypted Account & Privacy</h3>
            <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? 'bg-[#202c33] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center gap-3">
                <img src={avatarPreview} alt="" className="w-14 h-14 rounded-2xl object-cover ring-2 ring-emerald-500" />
                <div>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentUser.displayName}</h4>
                  <p className="text-xs font-mono text-emerald-500">{currentUser.customId}</p>
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Role: {currentUser.role}</p>
                </div>
              </div>

              <div className={`pt-3 border-t space-y-2.5 ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Zero-Log Protocol</span>
                  <span className="font-mono text-emerald-500 font-bold">ACTIVE</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>End-to-End Encryption</span>
                  <span className="font-mono text-emerald-500 font-bold">AES-256-GCM</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-full py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out Securely</span>
            </button>
          </div>
        )}
      </div>

      {/* RIGHT PANE: CHAT ROOM OR SETTINGS / WELCOME PANEL */}
      <div className={`flex-1 h-full flex flex-col ${activeChatId ? 'flex' : 'flex'}`}>
        {selectedChat ? (
          <ChatRoom
            currentUser={currentUser}
            chat={selectedChat}
            messages={messagesMap[selectedChat.id] || []}
            onSendMessage={handleSendMessage}
            onBack={() => setActiveChatId(null)}
            onUpdateChat={handleUpdateChat}
            onStartCall={(type) => setActiveCall({ participant: selectedChat.participant, type })}
          />
        ) : activeTab === 'settings' ? (
          <div className={`flex-1 flex flex-col p-8 overflow-y-auto ${isDark ? 'bg-[#0b141a]' : 'bg-[#f0f2f5]'}`}>
            <h2 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Settings</h2>
            <div className={`max-w-xl w-full p-6 rounded-3xl border space-y-6 ${isDark ? 'bg-[#111b21] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center gap-4">
                <img src={avatarPreview} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-500" />
                <div>
                  <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentUser.displayName}</h3>
                  <p className="text-xs font-mono text-emerald-500">{currentUser.customId}</p>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-700/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">Theme Mode</h4>
                    <p className="text-xs text-slate-400">Switch between dark and light themes</p>
                  </div>
                  <ThemeToggle />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">Linked Devices</h4>
                    <p className="text-xs text-slate-400">Manage companion sessions</p>
                  </div>
                  <button
                    onClick={() => setShowLinkedDevicesModal(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 font-semibold text-xs hover:bg-emerald-500/20 transition cursor-pointer"
                  >
                    Manage
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${isDark ? 'bg-[#0b141a]' : 'bg-[#f0f2f5]'}`}>
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 ring-1 ring-emerald-500/20">
              <Shield className="w-10 h-10" />
            </div>
            <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ChatNova Secure Enclave
            </h2>
            <p className={`text-xs max-w-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              End-to-end encrypted messaging. Select an existing conversation or click the menu (&#8942;) at the top right to start a **New Custom ID Chat**.
            </p>
            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Start New Custom ID Chat</span>
            </button>
          </div>
        )}
      </div>

      {/* MODAL: NEW CUSTOM ID CHAT */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl transition-all ${
            isDark ? 'bg-[#111b21] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">New Custom ID Chat</h3>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Enter recipient's @custom_id to connect securely
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNewChatModal(false);
                  setNewChatError('');
                  setNewChatCustomId('');
                }}
                className={`p-2 rounded-full transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewChat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-1.5">
                  Recipient Custom ID
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-sm">@</span>
                  <input
                    type="text"
                    value={newChatCustomId}
                    onChange={(e) => {
                      setNewChatCustomId(e.target.value);
                      setNewChatError('');
                    }}
                    placeholder="e.g. ritesh_84"
                    className={`w-full rounded-2xl pl-8 pr-4 py-2.5 text-sm font-mono border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                      isDark ? 'bg-[#202c33] border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    autoFocus
                  />
                </div>
                {newChatError && (
                  <p className="mt-2 text-xs text-rose-500 font-mono flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>{newChatError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewChatModal(false);
                    setNewChatError('');
                    setNewChatCustomId('');
                  }}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  Start Secure Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE GROUP */}
      {showCreateGroupModal && (
        <CreateGroupModal
          currentUser={currentUser}
          onClose={() => setShowCreateGroupModal(false)}
          onCreateGroup={handleCreateGroup}
        />
      )}

      {/* MODAL: LINKED DEVICES WITH SAFETY WRAPPER */}
      {showLinkedDevicesModal && (
        <LinkedDevicesModal onClose={() => setShowLinkedDevicesModal(false)} />
      )}

      {/* ACTIVE CALL MODAL */}
      {activeCall && (
        <CallModal
          currentUser={currentUser}
          participant={activeCall.participant}
          type={activeCall.type}
          onEndCall={() => setActiveCall(null)}
        />
      )}
    </div>
  );
};
