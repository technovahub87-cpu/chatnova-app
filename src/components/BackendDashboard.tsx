
import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Users,
  AlertCircle
} from 'lucide-react';

import { User, Chat, Message } from '../types';
import { ChatRoom } from './ChatRoom';
import { useBackendChat } from '../hooks/useBackendChat';
import { createBackendDirectChat } from '../services/chatBackend';
import { mapBackendConversation } from '../services/chatMapper';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

interface BackendDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onOpenMasterAdmin: () => void;
  onUpdateUser?: (updatedUser: User) => void;
}

export const BackendDashboard: React.FC<BackendDashboardProps> = ({
  currentUser,
  onLogout,
  onOpenMasterAdmin
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

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCustomId, setNewCustomId] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [localError, setLocalError] = useState('');

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
      const rawConversation =
        payload.conversation || payload;

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

      setActiveChatId(newChat.id);
      setNewCustomId('');
      setShowNewChat(false);
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

  const handleCall = (type: 'voice' | 'video') => {
    window.alert(
      `${type === 'voice' ? 'Voice' : 'Video'} calling will be connected after the secure calling system is implemented.`
    );
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

  return (
    <div
      className={`h-dvh w-dvw flex overflow-hidden ${
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

          <div className="flex items-center gap-2">
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

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => {
              setShowNewChat(true);
              setLocalError('');
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm py-3"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

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
              <p className="text-xs text-slate-400 mt-1">
                Start a new conversation using a ChatNova ID.
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
                  <img
                    src={avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover"
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
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
            {(currentUser.displayName || 'U').charAt(0).toUpperCase()}
          </div>

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
            onBack={() => setActiveChatId(null)}
            onUpdateChat={(updatedChat: Chat) => {
              setChats((previous) =>
                previous.map((chat) =>
                  chat.id === updatedChat.id ? updatedChat : chat
                )
              );
            }}
            onStartCall={handleCall}
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
    </div>
  );
};

export default BackendDashboard;
