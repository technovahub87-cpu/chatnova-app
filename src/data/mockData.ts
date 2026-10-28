import { User, Chat, CallLog, StatusStory, AuditLog, ServerNode, LinkedDevice } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user_1',
    customId: '@narendra_56',
    displayName: 'Narendra Sharma',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    bio: 'ChatNova Admin • Secure Enclave',
    status: 'online',
    lastSeen: 'Online',
    publicKeyFingerprint: 'E2EE-9842-X791-ALPHA',
    role: 'master_admin',
    twoFactorEnabled: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user_2',
    customId: '@ritesh_84',
    displayName: 'Ritesh Kumar',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    bio: 'Encrypted Communicator',
    status: 'online',
    lastSeen: 'Online',
    publicKeyFingerprint: 'E2EE-4421-B882-BETA',
    role: 'user',
    twoFactorEnabled: true,
    createdAt: '2026-02-15',
  }
];

export const INITIAL_CHATS: Chat[] = [];

export const INITIAL_MESSAGES: { [chatId: string]: import('../types').Message[] } = {};

export const INITIAL_CALLS: CallLog[] = [];

export const INITIAL_STATUSES: StatusStory[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const SERVER_NODES: ServerNode[] = [
  {
    id: 'node_ch',
    location: 'Zürich, Switzerland',
    endpoint: 'wss://relay-ch.chatnova.network/v2',
    latencyMs: 14,
    status: 'healthy',
    activeTunnels: 1,
  },
  {
    id: 'node_is',
    location: 'Reykjavik, Iceland',
    endpoint: 'wss://relay-is.chatnova.network/v2',
    latencyMs: 22,
    status: 'healthy',
    activeTunnels: 1,
  },
];

export const INITIAL_LINKED_DEVICES: LinkedDevice[] = [
  {
    id: 'dev_default_1',
    name: 'MacBook Pro 14" (Apple M3)',
    type: 'laptop',
    os: 'macOS Sonoma 14.6',
    browser: 'Safari 17.5',
    location: 'Zürich, Switzerland',
    ipAddress: '194.230.150.12',
    linkedAt: '2 days ago',
    lastActive: 'Active now',
    fingerprint: 'E2EE-DEV-9912-MACB',
  }
];
