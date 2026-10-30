/**
 * Offshore WebSocket & Socket.io Real-time Client
 * Integrates directly with Node.js backend running Socket.io
 */
import { io as socketIO, Socket } from 'socket.io-client';
import { getAuthToken } from './api';

type EventHandler = (payload: any) => void;

class WebSocketClient {
  private socketUrl: string = (import.meta as any).env?.VITE_WS_URL || 'https://chatnova-app-n20j.onrender.com';
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private isConnected: boolean = false;
  private isLiveBackend: boolean = false;
  private currentUserId: string | null = null;
  private currentCustomId: string | null = null;

  constructor() {
    try {
      const envUrl = (import.meta as any).env?.VITE_WS_URL;
      if (envUrl) {
        this.socketUrl = envUrl;
      }
    } catch (e) {}
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      isLiveBackend: this.isLiveBackend,
      url: this.socketUrl,
      gateway: this.isLiveBackend
        ? 'Live Offshore Node.js Relay'
        : 'Connecting to Live Backend...',
      latencyMs: 11,
    };
  }

  public setEndpoint(newUrl: string) {
    if (!newUrl) return;
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

        if (this.socket) {
          this.socket.disconnect();
        }

        // Initialize real Socket.io client with robust polling/websocket support for Render
        this.socket = socketIO(this.socketUrl, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          auth: {
            token,
            userId: this.currentUserId,
            customId: this.currentCustomId,
          },
        });

        this.socket.on('connect', () => {
          this.isConnected = true;
          this.isLiveBackend = true;
          console.log(`[ChatNova Socket.io] Connected successfully to live backend at ${this.socketUrl}`);

          // Register identity immediately on connect
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

        this.socket.on('connect_error', (err) => {
          this.isConnected = false;
          this.isLiveBackend = false;
          console.warn('[ChatNova Socket.io] Live backend connection error:', err);
          this.emit('connection:open', { url: this.socketUrl, isLive: false });
          resolve(false);
        });

        this.socket.on('disconnect', (reason) => {
          this.isConnected = false;
          this.isLiveBackend = false;
          console.warn('[ChatNova Socket.io] Disconnected:', reason);
          this.emit('connection:close', {});
        });
      } catch (err) {
        this.isConnected = false;
        this.isLiveBackend = false;
        this.emit('connection:open', { url: this.socketUrl, isLive: false });
        resolve(false);
      }
    });
  }

  public disconnect() {
    try {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
    } catch (e) {}
    this.isConnected = false;
    this.isLiveBackend = false;
  }

  public on(event: string, handler: EventHandler) {
    if (!event || !handler) return () => {};
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: EventHandler) {
    if (!event || !handler) return;
    this.listeners.get(event)?.delete(handler);
  }

  public emit(event: string, payload: any) {
    if (!event) return;

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
   * Send payload directly via live Socket.io to backend
   */
  public send(event: string, payload: any) {
    if (!event) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, payload);
    } else {
      console.warn('[ChatNova Socket.io] Cannot send message, socket not connected:', event);
    }
  }
}

export const wsService = new WebSocketClient();
