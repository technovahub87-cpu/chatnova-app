export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type MessageType = 'text' | 'voice' | 'image' | 'file' | 'system';

export interface VoiceData {
  duration: number; // in seconds
  waveform: number[];
  audioUrl?: string;
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'file';
  url: string;
  name: string;
  size: string;
  encryptedHash: string;
  mimeType?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string;
  timestamp: string;
  status: MessageStatus;
  voice?: VoiceData;
  media?: MediaAttachment;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  reactions?: { [emoji: string]: string[] }; // emoji -> array of userIds
  isDisappearing?: boolean;
}

export interface User {
  id: string;
  customId: string; // e.g. @alex_sec
  displayName: string;
  avatar: string;
  bio: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen: string;
  publicKeyFingerprint: string;
  isBanned?: boolean;
  role: 'user' | 'admin' | 'master_admin';
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface Chat {
  id: string;
  participant: User;
  isGroup: boolean;
  groupName?: string;
  groupIcon?: string;
  groupAdminId?: string;
  groupDescription?: string;
  groupMembers?: User[];
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived?: boolean;
  encryptionFingerprint: string;
}

export interface CallLog {
  id: string;
  participant: User;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  timestamp: string;
  duration?: string;
}

export interface StatusStory {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  customId: string;
  mediaUrl?: string;
  caption?: string;
  text?: string;
  timestamp: string;
  isViewed: boolean;
  viewsCount?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  targetUser: string;
  actor: string;
  ipAddress: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
}

export interface ServerNode {
  id: string;
  location: string;
  endpoint: string;
  latencyMs: number;
  status: 'healthy' | 'degraded' | 'offline';
  activeTunnels: number;
}

export interface LinkedDevice {
  id: string;
  name: string;
  type: 'desktop' | 'laptop' | 'tablet' | 'browser';
  os: string;
  browser?: string;
  location: string;
  ipAddress: string;
  linkedAt: string;
  lastActive: string;
  isCurrentDevice?: boolean;
  fingerprint: string;
}
