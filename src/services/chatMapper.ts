
import {
  Chat,
  Message,
  User
} from '../types';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

const getId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || '');
};

export const mapBackendUser = (raw: any): User => {
  return {
    id: getId(raw),
    customId: raw?.customId || '@user',
    displayName: raw?.displayName || raw?.name || 'ChatNova User',
    avatar: raw?.avatar || DEFAULT_AVATAR,
    bio: raw?.bio || '',
    status: raw?.status || 'offline',
    lastSeen: raw?.lastSeen || 'Recently',
    publicKeyFingerprint: raw?.publicKeyFingerprint || '',
    role: raw?.role || 'user',
    twoFactorEnabled: Boolean(
      raw?.twoFactorEnabled || raw?.authenticatorEnabled
    ),
    createdAt: raw?.createdAt
      ? new Date(raw.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    isBanned: Boolean(raw?.isBanned)
  };
};

export const mapBackendMessage = (
  raw: any,
  currentUserId: string
): Message => {
  const senderId = getId(raw?.sender);

  const rawType = raw?.type || 'text';

  const messageType =
    rawType === 'voice' ||
    rawType === 'image' ||
    rawType === 'system'
      ? rawType
      : rawType === 'file'
        ? 'file'
        : 'text';

  return {
    id: getId(raw) || `message_${Date.now()}`,
    chatId: String(raw?.chatId || ''),
    senderId,
    senderName:
      raw?.senderName ||
      raw?.sender?.displayName ||
      'ChatNova User',
    type: messageType,
    content: raw?.content || '',
    timestamp: raw?.createdAt
      ? new Date(raw.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '',
    status:
      senderId === currentUserId
        ? raw?.status || 'sent'
        : 'delivered',
    voice: raw?.voice,
    media: raw?.media
      ? {
          type: raw.media.type === 'image' ? 'image' : 'file',
          url: raw.media.url || '',
          name: raw.media.name || 'Attachment',
          size: raw.media.size || '',
          encryptedHash: raw.media.encryptedHash || ''
        }
      : undefined
  };
};

export const mapBackendConversation = (
  raw: any,
  currentUser: User
): Chat => {
  const participants = Array.isArray(raw?.participants)
    ? raw.participants
    : [];

  const otherParticipant = participants.find(
    (participant: any) =>
      getId(participant) !== currentUser.id
  );

  const participant = otherParticipant
    ? mapBackendUser(otherParticipant)
    : currentUser;

  const isGroup = raw?.type === 'group';

  const lastMessage = raw?.lastMessage
    ? mapBackendMessage(raw.lastMessage, currentUser.id)
    : undefined;

  const groupMembers = isGroup
    ? participants.map(mapBackendUser)
    : undefined;

  return {
    id: getId(raw),
    participant,
    isGroup,
    groupName: raw?.groupName || '',
    groupIcon: raw?.groupIcon || '',
    groupDescription: raw?.groupDescription || '',
    groupAdminId: getId(raw?.createdBy),
    groupMembers,
    lastMessage,
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
    encryptionFingerprint:
      participant.publicKeyFingerprint || ''
  };
};
