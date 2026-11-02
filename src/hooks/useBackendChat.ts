
import { useCallback, useEffect, useState } from 'react';
import { Chat, Message, User } from '../types';
import {
  loadBackendChats,
  loadBackendMessages,
  sendBackendTextMessage
} from '../services/chatBackend';
import { wsService } from '../services/websocket';
import { mapBackendMessage } from '../services/chatMapper';

export const useBackendChat = (currentUser: User) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messagesMap, setMessagesMap] = useState<
    Record<string, Message[]>
  >({});
  const [loadingChats, setLoadingChats] = useState(true);
  const [backendError, setBackendError] = useState('');

  const refreshChats = useCallback(async () => {
    setLoadingChats(true);

    const result = await loadBackendChats(currentUser);

    if (result.success) {
      setChats(result.chats);
      setBackendError('');
    } else {
      setBackendError(
        result.message || 'Unable to load your conversations.'
      );
    }

    setLoadingChats(false);
  }, [currentUser]);

  const refreshMessages = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return;

      const result = await loadBackendMessages(
        conversationId,
        currentUser
      );

      if (!result.success) {
        setBackendError(
          result.message || 'Unable to load messages.'
        );
        return;
      }

      setMessagesMap((previous) => ({
        ...previous,
        [conversationId]: result.messages
      }));
    },
    [currentUser]
  );

  const sendText = useCallback(
    async (conversationId: string, content: string) => {
      const cleanContent = content.trim();

      if (!conversationId || !cleanContent) {
        return {
          success: false,
          message: 'Conversation and message are required.'
        };
      }

      const result = await sendBackendTextMessage(
        conversationId,
        cleanContent
      );

      if (!result.success || !result.data) {
        return {
          success: false,
          message: result.message || 'Message could not be sent.'
        };
      }

      const payload: any = result.data;
      const rawMessage = payload.message || payload;

      const newMessage = mapBackendMessage(
        rawMessage,
        currentUser.id
      );

      setMessagesMap((previous) => {
        const existing = previous[conversationId] || [];

        if (existing.some((item) => item.id === newMessage.id)) {
          return previous;
        }

        return {
          ...previous,
          [conversationId]: [...existing, newMessage]
        };
      });

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === conversationId
            ? { ...chat, lastMessage: newMessage }
            : chat
        )
      );

      return {
        success: true,
        message: 'Message sent.'
      };
    },
    [currentUser]
  );

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  useEffect(() => {
    const unsubscribe = wsService.on(
      'chat:new_message',
      (rawMessage: any) => {
        if (!rawMessage?.chatId) return;

        const conversationId = String(rawMessage.chatId);

        const newMessage = mapBackendMessage(
          rawMessage,
          currentUser.id
        );

        setMessagesMap((previous) => {
          const existing = previous[conversationId] || [];

          if (existing.some((item) => item.id === newMessage.id)) {
            return previous;
          }

          return {
            ...previous,
            [conversationId]: [...existing, newMessage]
          };
        });

        setChats((previous) =>
          previous.map((chat) =>
            chat.id === conversationId
              ? { ...chat, lastMessage: newMessage }
              : chat
          )
        );
      }
    );

    return unsubscribe;
  }, [currentUser.id]);

  return {
    chats,
    setChats,
    messagesMap,
    setMessagesMap,
    loadingChats,
    backendError,
    refreshChats,
    refreshMessages,
    sendText
  };
};
