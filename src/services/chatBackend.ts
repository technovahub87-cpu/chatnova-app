
import {
  conversationAPI,
  messageAPI,
  ConversationRecord,
  MessageRecord
} from './api';

import {
  mapBackendConversation,
  mapBackendMessage
} from './chatMapper';

import { Chat, Message, User } from '../types';

export interface ChatLoadResult {
  success: boolean;
  chats: Chat[];
  message?: string;
}

export interface MessageLoadResult {
  success: boolean;
  messages: Message[];
  hasMore: boolean;
  nextBefore: string | null;
  message?: string;
}

// Load all conversations belonging to the logged-in user.
export const loadBackendChats = async (
  currentUser: User
): Promise<ChatLoadResult> => {
  const response = await conversationAPI.getMyConversations();

  if (!response.success || !response.data) {
    return {
      success: false,
      chats: [],
      message: response.message || 'Unable to load conversations.'
    };
  }

  const payload: any = response.data;

  const records: ConversationRecord[] =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload.conversations)
        ? payload.conversations
        : [];

  return {
    success: true,
    chats: records.map((conversation) =>
      mapBackendConversation(conversation, currentUser)
    )
  };
};

// Load messages for a selected MongoDB conversation.
export const loadBackendMessages = async (
  conversationId: string,
  currentUser: User,
  limit = 50,
  before?: string
): Promise<MessageLoadResult> => {
  const response = await messageAPI.getMessages(
    conversationId,
    { limit, before }
  );

  if (!response.success || !response.data) {
    return {
      success: false,
      messages: [],
      hasMore: false,
      nextBefore: null,
      message: response.message || 'Unable to load messages.'
    };
  }

  const payload: any = response.data;

  const records: MessageRecord[] =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload.messages)
        ? payload.messages
        : [];

  return {
    success: true,
    messages: records.map((record) =>
      mapBackendMessage(record, currentUser.id)
    ),
    hasMore: Boolean(payload.hasMore),
    nextBefore: payload.nextBefore || null
  };
};

// Create a direct conversation using a real ChatNova Custom ID.
export const createBackendDirectChat = async (
  customId: string
) => {
  return conversationAPI.createDirect(customId);
};

// Create a group conversation through the protected backend.
export const createBackendGroupChat = async (
  groupName: string,
  customIds: string[],
  groupDescription = ''
) => {
  return conversationAPI.createGroup({
    groupName,
    customIds,
    groupDescription
  });
};

// Send a text message through the authenticated REST API.
export const sendBackendTextMessage = async (
  conversationId: string,
  content: string
) => {
  return messageAPI.sendTextMessage(
    conversationId,
    content
  );
};
