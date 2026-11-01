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
  ShieldAlert,
  LogOut,
  UserPlus,
  Users,
  X,
  Laptop,
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

  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const saved = localStorage.getItem('chatnova_user_chats_' + currentUser.id);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_CHATS;
  });

  const [messagesMap, setMessagesMap] = useState<{ [chatId: string]: Message[] }>(() => {
    try {
      const saved = localStorage.getItem('chatnova_user_msgs_' + currentUser.id);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_MESSAGES;
  });

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(currentUser?.avatar || '');

  const [calls] = useState<CallLog[]>(INITIAL_CALLS);
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

  useEffect(() => {
    try {
      localStorage.setItem('chatnova_user_chats_' + currentUser.id, JSON.stringify(chats));
    } catch (e) {}
  }, [chats, currentUser.id]);

  useEffect(() => {
    try {
      localStorage.setItem('chatnova_user_msgs_' + currentUser.id, JSON.stringify(messagesMap));
    } catch (e) {}
  }, [messagesMap, currentUser.id]);

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
    const unsubMsg = wsService.on('chat:new_message', (newMsg: any) => {
      if (!newMsg) return;
      
      let cId = newMsg.chatId;
      if (!cId && newMsg.senderId && currentUser?.id) {
        cId = [newMsg.senderId, currentUser.id].sort().join('_');
      }
      if (!cId) cId = 'chat_default';

      setMessagesMap((prev) => {
        const currentList = prev[cId] || [];
        if (currentList.some((m) => m.id === newMsg.id)) return prev;
        return {
          ...prev,
          [cId]: [...currentList, { ...newMsg, chatId: cId, status: 'delivered' }],
        };
      });

      setChats((prev) => {
        const exists = prev.find((c) => c.id === cId);
        if (exists) {
          return prev.map((c) =>
            c.id === cId
              ? {
                  ...c,
                  lastMessage: { ...newMsg, chatId: cId },
                  unreadCount: activeChatId === cId ? 0 : (c.unreadCount || 0) + 1,
                }
              : c
          );
        } else {
          const senderUser: User = {
            id: newMsg.senderId || 'usr_unknown',
            customId: newMsg.senderCustomId || '@user',
            displayName: newMsg.senderName || 'User',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            status: 'online',
          };
          const newChatEntry: Chat = {
            id: cId,
            participant: senderUser,
            isGroup: false,
            unreadCount: activeChatId === cId ? 0 : 1,
            isPinned: false,
            isMuted: false,
            lastMessage: { ...newMsg, chatId: cId },
            encryptionFingerprint: generateFingerprint(senderUser.id),
          };
          return [newChatEntry, ...prev];
        }
      });
    });

    const unsubStatus = wsService.on('chat:message_status', (data: any) => {
      if (!data || !data.messageId) return;
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
      if (data && data.message) {
        setBroadcastNotice(data.message);
        setTimeout(() => setBroadcastNotice(null), 7000);
      }
    });

    return () => {
      unsubMsg();
      unsubStatus();
      unsubBroadcast();
    };
  }, [activeChatId, currentUser.id]);

  const handleSendMessage = (msgData: Partial<Message>) => {
    if (!activeChatId) return;

    const currentChat = chats.find((c) => c.id === activeChatId);
    const targetRecipientId = currentChat?.participant?.id || currentChat?.participant?.customId;

    const fullMsg: Message = {
      id: msgData.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      chatId: activeChatId,
      senderId: currentUser?.id || 'usr_me',
      senderName: currentUser?.displayName || 'User',
      type: msgData.type || 'text',
      content: msgData.content || '',
      timestamp: msgData.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'delivered',
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

    wsService.send('chat:send_message', {
      chatId: activeChatId,
      recipientId: targetRecipientId,
      senderId: currentUser?.id,
      senderCustomId: currentUser?.customId,
      senderName: currentUser?.displayName,
      content: fullMsg.content,
      type: fullMsg.type,
      tempId: fullMsg.id,
      voice: fullMsg.voice,
      media: fullMsg.media,
    });
  };

  const handleCreateNewChat = (e: React.FormEvent) => {
    e.preventDefault();
    setNewChatError('');
    const rawInput = newChatCustomId.trim().toLowerCase();
    const formattedId = rawInput.startsWith('@') ? rawInput : `@${rawInput}`;

    if (currentUser?.customId && formattedId === currentUser.customId.toLowerCase()) {
      setNewChatError('You cannot start a chat with yourself.');
      return;
    }

    let allStoredUsers: User[] = [...INITIAL_USERS];
    try {
      const savedUsersJson = localStorage.getItem('chatnova_all_users');
      if (savedUsersJson) {
        const parsed = JSON.parse(savedUsersJson);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any) => {
            if (u && u.customId && !allStoredUsers.some((ex) => ex.customId.toLowerCase() === u.customId.toLowerCase())) {
              allStoredUsers.push(u);
            }
          });
        }
      }
    } catch (err) {}

    let foundUser = allStoredUsers.find(
      (u) => u.customId.toLowerCase() === formattedId
    );

    if (!foundUser) {
      foundUser = {
        id: 'user_' + formattedId.replace('@', ''),
        customId: formattedId,
        displayName: formattedId.replace('@', '').toUpperCase(),
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        bio: 'ChatNova Secure Enclave User',
        status: 'online',
        lastSeen: 'Online',
        publicKeyFingerprint: generateFingerprint(),
        role: 'user',
        twoFactorEnabled: true,
      };

      try {
        allStoredUsers.push
