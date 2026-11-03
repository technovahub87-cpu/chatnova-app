
import {
  Chat,
  Message,
  User
} from '../types';

import { API_BASE_URL } from './api';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

export const resolveAvatarUrl = (avatar?: string): string => {
  if (!avatar) return DEFAULT_AVATAR;

  if (
    avatar.startsWith('https://') ||
    avatar.startsWith('http://') ||
    avatar.startsWith('data:')
  ) {
    return avatar;
  }

  const backendOrigin = API_BASE_URL.replace(/\/api\/?$/, '');
  const path = avatar.startsWith('/') ? avatar : `/${avatar}`;

  return `${backendOrigin}${path}`;
};

const getId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || '');
};

export const mapBackendMessage = (
  raw: any,
  currentUserId: string
): Message => {
  const senderId = getId(raw?.sender);
  const rawType = raw?.type || 'text';

  const messageType: Message['type'] =
    rawType === 'voice' ||
    rawType === 'image' ||
    rawType === 'video' ||
    rawType === 'gif' ||
    rawType === 'sticker' ||
    rawType === 'system'
      ? rawType
      : rawType === 'file' || rawType === 'document'
        ? 'file'
        : 'text';

  const mediaType: NonNullable<Message['media']>['type'] =
    raw?.media?.type === 'image' ||
    raw?.media?.type === 'video' ||
    raw?.media?.type === 'gif' ||
    raw?.media?.type === 'sticker'
      ? raw.media.type
      : 'file';

  const replySource = raw?.replyTo;
  const forwardedSource = raw?.forwardedFrom;

  const replyMessageId = String(
    replySource?.messageId ||
    replySource?.id ||
    getId(replySource?.message) ||
    ''
  );

  const forwardedMessageId = String(
    forwardedSource?.messageId ||
    forwardedSource?.id ||
    ''
  );

  const hasRealReply = Boolean(replyMessageId);
  const hasRealForward =
    Boolean(forwardedSource?.isForwarded || forwardedMessageId);

  return {
    id: getId(raw) || `message_${Date.now()}`,
    chatId: String(raw?.chatId || raw?.conversation || ''),
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
    status: raw?.status || 'sent',
    voice: raw?.voice
      ? {
          duration: Number(raw.voice.duration || 0),
          waveform: Array.isArray(raw.voice.waveform)
            ? raw.voice.waveform
            : [],
          audioUrl: raw.voice.audioUrl || raw.voice.url || ''
        }
      : undefined,
    media: raw?.media
      ? {
          type: mediaType,
          url: raw.media.url || '',
          name: raw.media.name || 'Attachment',
          size: raw.media.size || '',
          mimeType: raw.media.mimeType || '',
          encryptedHash: raw.media.encryptedHash || '',
          duration: Number(raw.media.duration || 0)
        }
      : undefined,
    replyTo: hasRealReply
      ? {
          id: replyMessageId,
          senderName:
            replySource.senderName ||
            replySource.originalSenderName ||
            'ChatNova User',
          content:
            replySource.content ||
            replySource.originalContent ||
            replySource.mediaName ||
            '',
          type: replySource.type,
          mediaUrl: replySource.mediaUrl || ''
        }
      : undefined,
    forwardedFrom: hasRealForward
      ? {
          messageId: forwardedMessageId,
          senderName:
            forwardedSource.senderName ||
            forwardedSource.originalSenderName ||
            'ChatNova User'
        }
      : undefined,
    deletedForEveryone: Boolean(raw?.deletedForEveryone),
    reactions: raw?.reactions || undefined,
    isDisappearing: Boolean(raw?.isDisappearing)
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

export const mapBackendUser = (raw: any): User => {
  return {
    id: getId(raw),
    customId: raw?.customId || '@user',
    displayName: raw?.displayName || raw?.name || 'ChatNova User',
    avatar: resolveAvatarUrl(raw?.avatar),
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
