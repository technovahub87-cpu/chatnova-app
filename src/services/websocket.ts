/**
 * Offshore WebSocket & Socket.io Real-time Client
 * Integrates directly with Node.js backend running Socket.io,
 * with seamless zero-downtime offline fallback simulation.
 */
import { io as socketIO, Socket } from 'socket.io-client';
import { getAuthToken } from './api';

type EventHandler = (payload: any) => void;

class WebSocketClient {
  private socketUrl: string = (import.meta as any).env?.VITE_WS_URL || 'http://localhost:5000';
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private isConnected: boolean = false;
  private isLiveBackend: boolean = false;
  private currentUserId: string | null = null;
  private currentCustomId: string | null = null;

  constructor() {
    const envUrl = (import.meta as any).env?.VITE_WS_URL;
    if (envUrl) {
      this.socketUrl = envUrl;
    }
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      isLiveBackend: this.isLiveBackend,
      url: this.socketUrl,
      gateway: this.isLiveBackend
        ? 'Live Offshore Node.js Relay'
        : 'Zurich Offshore Relay Enclave (Simulated & Local)',
      latencyMs: this.isLiveBackend ? 11 : 14,
    };
  }

  public setEndpoint(newUrl: string) {
    this.socketUrl = newUrl;
    this.disconnect();
    this.connect();
    this.emit('system:endpoint_updated', { url: newUrl });
  }

  public connect(authData?: { userId: string; customId: string }): Promise<boolean> {
    if (authData) {
      this.currentUserId = authData.userId;
      this.currentCustomId = authData.customId;
    }

    return new Promise((resolve) => {
      try {
        const token = getAuthToken();

        // Initialize real Socket.io client
        this.socket = socketIO(this.socketUrl, {
          transports: ['websocket', 'polling'],
          timeout: 4000,
          reconnectionAttempts: 2,
          auth: {
            token,
            userId: this.currentUserId,
            customId: this.currentCustomId,
          },
        });

        this.socket.on('connect', () => {
          this.isConnected = true;
          this.isLiveBackend = true;
          console.log(`[ChatNova Socket.io] Connected to live backend at ${this.socketUrl}`);

          // Register identity
          if (this.currentUserId) {
            this.socket?.emit('auth:init', {
              userId: this.currentUserId,
              customId: this.currentCustomId,
            });
          }

          this.emit('connection:open', { url: this.socketUrl, isLive: true });
          resolve(true);
        });

        // Forward live backend events to internal listeners
        const forwardEvents = [
          'chat:new_message',
          'chat:message_acknowledged',
          'chat:message_status',
          'chat:read_receipt',
          'chat:typing',
          'user:presence_update',
          'admin:broadcast',
          'admin:user_status_changed',
          'auth:force_disconnect',
        ];

        forwardEvents.forEach((ev) => {
          this.socket?.on(ev, (data) => {
            this.emit(ev, data);
          });
        });

        this.socket.on('connect_error', () => {
          // Live server not reachable -> Fall back to local enclave simulation
          this.isLiveBackend = false;
          this.isConnected = true;
          console.log('[ChatNova Socket.io] Live backend not detected. Operating in zero-log enclave simulation mode.');
          this.emit('connection:open', { url: this.socketUrl, isLive: false });
          resolve(true);
        });

        this.socket.on('disconnect', () => {
          this.isConnected = false;
          this.emit('connection:close', {});
        });
      } catch (err) {
        this.isLiveBackend = false;
        this.isConnected = true;
        this.emit('connection:open', { url: this.socketUrl, isLive: false });
        resolve(true);
      }
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.isLiveBackend = false;
  }

  public on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  public emit(event: string, payload: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(payload);
        } catch (err) {
          console.error(`Error in WS listener for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Send payload via live Socket.io or trigger local simulation
   */
  public send(event: string, payload: any) {
    if (this.isLiveBackend && this.socket && this.socket.connected) {
      // Emit to live Node.js / Socket.io server
      this.socket.emit(event, payload);
    } else {
      // Local fallback simulation (for standalone mode / local testing)
      this.simulateRemoteResponse(event, payload);
    }
  }

  private simulateRemoteResponse(event: string, payload: any) {
    if (event === 'chat:send_message') {
      const message = payload.message;

      // Single tick -> Delivered tick after 600ms
      setTimeout(() => {
        this.emit('chat:message_status', {
          messageId: message.id,
          status: 'delivered',
        });
      }, 600);

      // Delivered tick -> Read blue tick after 1200ms
      setTimeout(() => {
        this.emit('chat:message_status', {
          messageId: message.id,
          status: 'read',
        });
      }, 1200);

      // If it's a 1-on-1 chat or group chat, simulate contacts replying
      const isGroup = Boolean(payload.isGroup);
      const groupName = payload.groupName;

      setTimeout(() => {
        const replyingName = isGroup
          ? payload.groupMembers?.[1]?.displayName || 'Elena Rostova'
          : payload.recipientName || 'Elena Rostova';

        this.emit('chat:typing', {
          chatId: payload.chatId,
          isTyping: true,
          senderName: replyingName,
        });

        setTimeout(() => {
          this.emit('chat:typing', {
            chatId: payload.chatId,
            isTyping: false,
          });

          const directReplies = [
            'Understood. Verified through our Zurich enclave. Safe to proceed.',
            'Got your transmission! 256-bit key exchange hash verified 🔒',
            'All clean here. The offshore zero-log gateway confirmed the payload.',
            'Affirmative. Perfect privacy protocol adherence.',
          ];

          const groupReplies = [
            `Acknowledged by group ${groupName || 'Squad'}. Ratchet keys synced 🛡️`,
            'All members online in this secure enclave. Standing by.',
            'Group transmission integrity verified. End-to-end verified across all nodes.',
          ];

          const replyPool = isGroup ? groupReplies : directReplies;
          const text = replyPool[Math.floor(Math.random() * replyPool.length)];

          const autoReply = {
            id: 'msg_' + Date.now(),
            chatId: payload.chatId,
            senderId: isGroup ? 'user_elena' : payload.recipientId || 'user_elena',
            senderName: replyingName,
            type: 'text',
            content: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'read',
          };

          this.emit('chat:new_message', autoReply);
        }, 1800);
      }, 1400);
    }
  }
}

export const wsService = new WebSocketClient();
