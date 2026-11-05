
import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Users,
  AlertCircle,
  Settings,
  CircleDot,
  Phone,
  UserCircle
} from 'lucide-react';

import { User, Chat, Message } from '../types';
import { ChatRoom } from './ChatRoom';
import { ProfileSettings } from './ProfileSettings';
import { StatusCenter } from './StatusCenter';
import { CallHistory } from './CallHistory';
import { useBackendChat } from '../hooks/useBackendChat';
import {
  createBackendDirectChat,
  createBackendGroupChat
} from '../services/chatBackend';
import { conversationAPI } from '../services/api';
import {
  mapBackendConversation,
  resolveAvatarUrl
} from '../services/chatMapper';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import { CallOverlay } from './CallOverlay';

interface BackendDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onOpenMasterAdmin: () => void;
  onUpdateUser?: (updatedUser: User) => void;
}

interface AvatarImageProps {
  avatar?: string;
  name?: string;
  className: string;
  fallbackClassName: string;
}

type MainTab = 'chats' | 'status' | 'calls' | 'settings';

const AvatarImage: React.FC<AvatarImageProps> = ({
  avatar,
  name,
  className,
  fallbackClassName
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatar]);

  const imageUrl = avatar ? resolveAvatarUrl(avatar) : '';

  if (!imageUrl || imageFailed) {
    return (
      <div className={fallbackClassName}>
        {(name || 'U').trim().charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name || 'Profile'}
      className={className}
      onError={() => setImageFailed(true)}
    />
  );
};

export const BackendDashboard: React.FC<BackendDashboardProps> = ({
  currentUser,
  onLogout,
  onOpenMasterAdmin,
  onUpdateUser
}) => {
  const { isDark } = useTheme();

  const {
    chats,
    setChats,
    messagesMap,
    loadingChats,
    backendError,
    refreshChats,
    refreshMessages,
    sendText
  } = useBackendChat(currentUser);

  const [activeTab, setActiveTab] = useState<MainTab>('chats');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [newCustomId, setNewCustomId] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  const [creatingChat, setCreatingChat] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  const [callRequest, setCallRequest] = useState<{
    id: string;
    type: 'voice' | 'video';
    conversationId: string;
  } | null>(null);

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  const activeMessages = activeChatId
    ? messagesMap[activeChatId] || []
    : [];

  useEffect(() => {
    if (activeChatId) {
      refreshMessages(activeChatId);
    }
  }, [activeChatId, refreshMessages]);

  const changeTab = (tab: MainTab) => {
    setActiveTab(tab);
    setActiveChatId(null);
    setShowNewChat(false);
    setShowNewGroup(false);
    setLocalError('');

    if (tab === 'settings') {
      setShowProfile(true);
    }
  };

  const handleCreateChat = async (event: React.FormEvent) => {
    event.preventDefault();

    const customId = newCustomId.trim().startsWith('@')
      ? newCustomId.trim()
      : `@${newCustomId.trim()}`;

    if (!customId || customId === '@') {
      setLocalError('Enter a valid ChatNova ID.');
      return;
    }

    if (customId.toLowerCase() === currentUser.customId.toLowerCase()) {
      setLocalError('You cannot start a conversation with yourself.');
      return;
    }

    setCreatingChat(true);
    setLocalError('');

    try {
      const result = await createBackendDirectChat(customId);

      if (!result.success || !result.data) {
        setLocalError(
          result.message || 'Could not create conversation.'
        );
        return;
      }

      const payload: any = result.data;
      const rawConversation = payload.conversation || payload;

      const newChat = mapBackendConversation(
        rawConversation,
        currentUser
      );

      setChats((previous) => {
        const exists = previous.some(
          (chat) => chat.id === newChat.id
        );

        return exists
          ? previous.map((chat) =>
              chat.id === newChat.id ? newChat : chat
            )
          : [newChat, ...previous];
      });

      setActiveTab('chats');
      setActiveChatId(newChat.id);
      setNewCustomId('');
      setShowNewChat(false);
    } catch {
      setLocalError('Unable to connect to ChatNova server.');
    } finally {
      setCreatingChat(false);
    }
  };

  const handleCreateGroup = async (event: React.FormEvent) => {
    event.preventDefault();

    const groupName = newGroupName.trim();

    const customIds = [
      ...new Set(
        newGroupMembers
          .split(/[,\n;]+/)
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) =>
            value.startsWith('@') ? value : `@${value}`
          )
          .map((value) => value.toLowerCase())
      )
    ];

    if (!groupName) {
      setLocalError('Enter a group name.');
      return;
    }

    if (groupName.length > 80) {
      setLocalError('Group name cannot exceed 80 characters.');
      return;
    }

    if (customIds.length === 0) {
      setLocalError('Enter at least one other member ChatNova ID.');
      return;
    }

    if (customIds.includes(currentUser.customId.toLowerCase())) {
      setLocalError(
        'Your own account is added automatically. Enter other members only.'
      );
      return;
    }

    setCreatingChat(true);
    setLocalError('');

    try {
      const result = await createBackendGroupChat(
        groupName,
        customIds,
        newGroupDescription.trim()
      );

      if (!result.success || !result.data) {
        setLocalError(
          result.message || 'Could not create group.'
        );
        return;
      }

      const payload: any = result.data;
      const rawConversation = payload.conversation || payload;

      const newChat = mapBackendConversation(
        rawConversation,
        currentUser
      );

      setChats((previous) => [
        newChat,
        ...previous.filter((chat) => chat.id !== newChat.id)
      ]);

      setActiveTab('chats');
      setActiveChatId(newChat.id);

      setNewGroupName('');
      setNewGroupMembers('');
      setNewGroupDescription('');
      setShowNewGroup(false);
    } catch {
      setLocalError('Unable to connect to ChatNova server.');
    } finally {
      setCreatingChat(false);
    }
  };

  const handleSendMessage = async (
    messageData: Partial<Message>
  ) => {
    if (!activeChatId || messageData.type !== 'text') {
      return;
    }

    const result = await sendText(
      activeChatId,
      messageData.content || ''
    );

    if (!result.success) {
      window.alert(result.message || 'Message could not be sent.');
    }
  };
  
    const handleLeaveGroup = async (conversationId: string) => {
    if (!window.confirm('Kya aap sach mein is group ko leave karna chahte hain?')) {
      return;
    }

    const result = await conversationAPI.leaveGroup(conversationId);

    if (!result.success) {
      window.alert(result.message || 'Group leave nahi ho paya.');
      return;
    }

    setChats((previous) =>
      previous.filter((chat) => chat.id !== conversationId)
    );

    setActiveChatId(null);
    window.alert('Aap successfully group se leave ho gaye hain.');
  };
  const handleCall = (type: 'voice' | 'video') => {
    if (!activeChatId) {
      window.alert('Please open a conversation first.');
      return;
    }

    setCallRequest({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type,
      conversationId: activeChatId
    });
  };

  const handleHistoryCall = (
    type: 'voice' | 'video',
    conversationId: string
  ) => {
    if (!conversationId) {
      window.alert('This conversation is no longer available.');
      return;
    }

    setCallRequest({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type,
      conversationId
    });
  };

  const filteredChats = chats.filter((chat) => {
    const title = chat.isGroup
      ? chat.groupName || 'Group'
      : chat.participant?.displayName || 'ChatNova User';

    const customId = chat.isGroup
      ? ''
      : chat.participant?.customId || '';

    const lastMessage = chat.lastMessage?.content || '';
    const query = searchQuery.toLowerCase();

    return (
      title.toLowerCase().includes(query) ||
      customId.toLowerCase().includes(query) ||
      lastMessage.toLowerCase().includes(query)
    );
  });

  const tabClass = (tab: MainTab) =>
    `flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-semibold border-b-2 transition ${
      activeTab === tab
        ? 'border-emerald-500 text-emerald-500'
        : isDark
          ? 'border-transparent text-slate-400 hover:text-white'
          : 'border-transparent text-slate-500 hover:text-slate-900'
    }`;

  return (
    <div
      className={`h-dvh w-dvw flex overflow-hidden box-border pt-[max(env(safe-area-inset-top),40px)] md:pt-0 ${
        isDark
          ? 'bg-[#0b141a] text-white'
          : 'bg-[#f0f2f5] text-slate-900'
      }`}
    >
      <aside
        className={`w-full md:w-[370px] lg:w-[410px] shrink-0 flex flex-col border-r ${
          isDark
            ? 'bg-[#111b21] border-slate-800'
            : 'bg-white border-slate-200'
        } ${activeChatId ? 'hidden md:flex' : 'flex'}`}
      >
        <header
          className={`p-4 border-b flex items-center justify-between ${
            isDark
              ? 'bg-[#202c33] border-slate-800'
              : 'bg-[#f0f2f5] border-slate-200'
          }`}
        >
          <div>
            <h1 className="text-xl font-extrabold">
              Chat<span className="text-emerald-500">Nova</span>
            </h1>
            <p className="text-[10px] text-emerald-500 tracking-widest">
              SECURE MESSAGING
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              title="Profile Settings"
              className="p-1 rounded-full hover:bg-slate-500/20"
            >
              <AvatarImage
                avatar={currentUser.avatar}
                name={currentUser.displayName}
                className="w-8 h-8 rounded-full object-cover"
                fallbackClassName="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold"
              />
            </button>

            <ThemeToggle />

            {currentUser.role === 'master_admin' && (
              <button
                type="button"
                onClick={onOpenMasterAdmin}
                title="Master Admin"
                className="p-2 rounded-full text-emerald-500 hover:bg-slate-500/20"
              >
                <ShieldAlert className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={refreshChats}
              title="Refresh conversations"
              className="p-2 rounded-full hover:bg-slate-500/20"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onLogout}
              title="Logout"
              className="p-2 rounded-full hover:bg-rose-500/10 text-rose-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <button
          type="button"
          onClick={() => setShowProfile(true)}
          className={`mx-3 mt-3 p-3 rounded-xl border flex items-center gap-3 text-left transition ${
            isDark
              ? 'bg-[#202c33] border-slate-700 hover:bg-slate-700/60'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <AvatarImage
            avatar={currentUser.avatar}
            name={currentUser.displayName}
            className="w-11 h-11 rounded-full object-cover"
            fallbackClassName="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg"
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {currentUser.displayName}
            </p>
            <p className="text-[10px] text-emerald-500">
              {currentUser.customId}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Open profile settings
            </p>
          </div>

          <Settings className="w-4 h-4 text-slate-400" />
        </button>

        <div
          className={`mt-3 grid grid-cols-4 border-b ${
            isDark
              ? 'bg-[#202c33] border-slate-800'
              : 'bg-[#f0f2f5] border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => changeTab('chats')}
            className={tabClass('chats')}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chats</span>
          </button>

          <button
            type="button"
            onClick={() => changeTab('status')}
            className={tabClass('status')}
          >
            <CircleDot className="w-4 h-4" />
            <span>Status</span>
          </button>

          <button
            type="button"
            onClick={() => changeTab('calls')}
            className={tabClass('calls')}
          >
            <Phone className="w-4 h-4" />
            <span>Calls</span>
          </button>

          <button
            type="button"
            onClick={() => changeTab('settings')}
            className={tabClass('settings')}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>

        {activeTab === 'chats' && (
          <>
            <div className="p-3">
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  isDark ? 'bg-[#202c33]' : 'bg-slate-100'
                }`}
              >
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search conversations..."
                  className="bg-transparent outline-none w-full text-sm"
                />
              </div>
            </div>

            <div className="px-3 pb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewChat(true);
                  setShowNewGroup(false);
                  setLocalError('');
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-3"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowNewGroup(true);
                  setShowNewChat(false);
                  setLocalError('');
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs py-3"
              >
                <Users className="w-4 h-4" />
                Create Group
              </button>
            </div>

            {showNewGroup && (
              <form
                onSubmit={handleCreateGroup}
                className={`mx-3 mb-3 p-3 rounded-xl border ${
                  isDark
                    ? 'bg-[#202c33] border-slate-700'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <label className="block text-xs font-semibold mb-2">
                  Group name
                </label>

                <input
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  maxLength={80}
                  placeholder="e.g. Family Group"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none mb-3 ${
                    isDark
                      ? 'bg-[#111b21] border-slate-700'
                      : 'bg-white border-slate-300'
                  }`}
                />

                <label className="block text-xs font-semibold mb-2">
                  Member ChatNova IDs
                </label>

                <textarea
                  value={newGroupMembers}
                  onChange={(event) => setNewGroupMembers(event.target.value)}
                  rows={3}
                  placeholder="@vandana, @friend1"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y mb-1 ${
                    isDark
                      ? 'bg-[#111b21] border-slate-700'
                      : 'bg-white border-slate-300'
                  }`}
                />

                <p className="text-[10px] text-slate-400 mb-3">
                  Enter member IDs separated by commas or new lines.
                  Your account is added automatically.
                </p>

                <label className="block text-xs font-semibold mb-2">
                  Description (optional)
                </label>

                <input
                  value={newGroupDescription}
                  onChange={(event) => setNewGroupDescription(event.target.value)}
                  maxLength={500}
                  placeholder="About this group"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none mb-3 ${
                    isDark
                      ? 'bg-[#111b21] border-slate-700'
                      : 'bg-white border-slate-300'
                  }`}
                />

                {localError && (
                  <p className="text-xs text-rose-500 mb-2">
                    {localError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewGroup(false);
                      setLocalError('');
                    }}
                    className="flex-1 rounded-lg py-2 text-xs border border-slate-500/30"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={creatingChat}
                    className="flex-1 rounded-lg py-2 text-xs bg-sky-600 text-white disabled:opacity-50"
                  >
                    {creatingChat ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </form>
            )}

            {showNewChat && (
              <form
                onSubmit={handleCreateChat}
                className={`mx-3 mb-3 p-3 rounded-xl border ${
                  isDark
                    ? 'bg-[#202c33] border-slate-700'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <label className="block text-xs font-semibold mb-2">
                  Enter ChatNova Custom ID
                </label>

                <input
                  value={newCustomId}
                  onChange={(event) => setNewCustomId(event.target.value)}
                  placeholder="@username"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                    isDark
                      ? 'bg-[#111b21] border-slate-700'
                      : 'bg-white border-slate-300'
                  }`}
                />

                {localError && (
                  <p className="text-xs text-rose-500 mt-2">
                    {localError}
                  </p>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewChat(false);
                      setLocalError('');
                    }}
                    className="flex-1 rounded-lg py-2 text-xs border border-slate-500/30"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={creatingChat}
                    className="flex-1 rounded-lg py-2 text-xs bg-emerald-600 text-white disabled:opacity-50"
                  >
                    {creatingChat ? 'Creating...' : 'Start Chat'}
                  </button>
                </div>
              </form>
            )}

            {localError && !showNewGroup && !showNewChat && (
              <div className="mx-3 mb-3 text-xs text-rose-500">
                {localError}
              </div>
            )}

            {backendError && (
              <div className="mx-3 mb-3 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{backendError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {loadingChats ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  Loading your conversations...
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                  <p className="font-semibold text-sm">
                    No conversations yet
                  </p>
                  <p className="text-xs text-slate-400">
                    Start a new chat or create a group.
                  </p>
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const title = chat.isGroup
                    ? chat.groupName || 'Group'
                    : chat.participant?.displayName || 'ChatNova User';

                  const avatar = chat.isGroup
                    ? chat.groupIcon
                    : chat.participant?.avatar;

                  return (
                    <button
                      type="button"
                      key={chat.id}
                      onClick={() => setActiveChatId(chat.id)}
                      className={`w-full flex items-center gap-3 text-left px-4 py-3 border-b transition ${
                        isDark
                          ? 'border-slate-800 hover:bg-[#202c33]'
                          : 'border-slate-100 hover:bg-slate-50'
                      } ${
                        activeChatId === chat.id
                          ? isDark
                            ? 'bg-[#202c33]'
                            : 'bg-emerald-50'
                          : ''
                      }`}
                    >
                      <AvatarImage
                        avatar={avatar}
                        name={title}
                        className="w-12 h-12 rounded-full object-cover"
                        fallbackClassName="w-12 h-12 shrink-0 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2">
                          <span className="font-semibold text-sm truncate">
                            {title}
                          </span>

                          <span className="text-[10px] text-slate-400">
                            {chat.lastMessage?.timestamp || ''}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 truncate mt-1">
                          {chat.lastMessage?.content ||
                            (chat.isGroup
                              ? 'Group conversation'
                              : chat.participant?.customId || 'ChatNova')}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <footer
              className={`p-3 border-t flex items-center gap-3 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <AvatarImage
                avatar={currentUser.avatar}
                name={currentUser.displayName}
                className="w-9 h-9 rounded-full object-cover"
                fallbackClassName="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold"
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {currentUser.displayName}
                </p>
                <p className="text-[10px] text-emerald-500">
                  {currentUser.customId}
                </p>
              </div>

              <Users className="w-4 h-4 text-slate-400" />
            </footer>
          </>
        )}

        {activeTab === 'status' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <StatusCenter currentUser={currentUser} />
          </div>
        )}

        {activeTab === 'calls' && (
          <CallHistory
            isDark={isDark}
            onCall={handleHistoryCall}
          />
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col items-center text-center py-10">
              <UserCircle className="w-12 h-12 text-emerald-500 mb-3" />
              <h2 className="font-bold text-lg">Settings</h2>
              <p className="text-sm text-slate-400 mt-2 mb-5">
                Manage your profile and account settings.
              </p>
              <button
                type="button"
                onClick={() => setShowProfile(true)}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Open Profile Settings
              </button>
            </div>
          </div>
        )}
      </aside>

      <main
        className={`flex-1 min-w-0 h-full ${
          activeChatId ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activeChat ? (
          <ChatRoom
            chat={activeChat}
            currentUser={currentUser}
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            onLeaveGroup={handleLeaveGroup}
            onBack={() => setActiveChatId(null)}
            onUpdateChat={(updatedChat: Chat) => {
              setChats((previous) =>
                previous.map((chat) =>
                  chat.id === updatedChat.id ? updatedChat : chat
                )
              );
            }}
            onStartCall={handleCall}
            availableChats={chats}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-5">
              <MessageSquare className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold">
              Welcome to ChatNova
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-sm">
              Select a conversation or start a new one to begin messaging.
            </p>
          </div>
        )}
      </main>

      <CallOverlay
        request={callRequest}
        onRequestHandled={() => setCallRequest(null)}
      />

      {showProfile && (
        <ProfileSettings
          currentUser={currentUser}
          onClose={() => setShowProfile(false)}
          onUpdateUser={(updatedUser) => {
            onUpdateUser?.(updatedUser);
          }}
        />
      )}
    </div>
  );
};

export default BackendDashboard;
