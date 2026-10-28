import { User, Chat, CallLog, StatusStory, AuditLog, ServerNode, LinkedDevice } from '../types';

export const INITIAL_USERS: User[] = [];

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

export const INITIAL_LINKED_DEVICES: LinkedDevice[] = [];
