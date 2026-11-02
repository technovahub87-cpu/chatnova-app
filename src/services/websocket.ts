
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  public socket: Socket | null = null;

  private listeners: Map<string, Set<(...args: any[]) => void>> =
    new Map();

  private currentToken: string | null = null;

  connect(token?: string): Socket | null {
    if (!token) {
      console.warn('[ChatNova WS] Authentication token is missing.');
      return null;
    }

    if (
      this.socket &&
      this.socket.connected &&
      this.currentToken === token
    ) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentToken = token;

    const BACKEND_URL = 'https://chatnova-app-n20j.onrender.com';

    this.socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 15000
    });

    this.socket.on('connect', () => {
      console.log('[ChatNova WS] Connected:', this.socket?.id);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[ChatNova WS] Connection rejected:', error.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[ChatNova WS] Disconnected:', reason);
    });

    this.socket.onAny((event, ...args) => {
      const callbacks = this.listeners.get(event);

      if (callbacks) {
        callbacks.forEach((callback) => {
          try {
            callback(...args);
          } catch (error) {
            console.error(`[ChatNova WS] Listener error (${event}):`, error);
          }
        });
      }
    });

    return this.socket;
  }

  on(
    event: string,
    callback: (...args: any[]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)?.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);

      if (this.listeners.get(event)?.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit(event: string, data?: any): void {
    if (!this.socket || !this.socket.connected) {
      console.warn(`[ChatNova WS] Socket is not connected: ${event}`);
      return;
    }

    this.socket.emit(event, data);
  }

  // Join a conversation using its real MongoDB ID.
  joinConversation(conversationId: string): void {
    if (!conversationId) return;

    this.emit('chat:join', { conversationId });
  }

  // Leave a conversation.
  leaveConversation(conversationId: string): void {
    if (!conversationId) return;

    this.emit('chat:leave', { conversationId });
  }

  // Send typing state for a conversation.
  sendTyping(conversationId: string, isTyping: boolean): void {
    if (!conversationId) return;

    this.emit('chat:typing', {
      conversationId,
      isTyping
    });
  }

  send(event: string, data: any): void {
    this.emit(event, data);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentToken = null;
    this.listeners.clear();
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }
}

export const wsService = new WebSocketService();

if (typeof window !== 'undefined') {
  (window as any).wsService = wsService;
  (window as any).checkSocket = () => wsService.isConnected();
}
