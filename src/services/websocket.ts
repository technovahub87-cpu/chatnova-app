import { io as socketIO, Socket } from 'socket.io-client';
import { getAuthToken } from './api';

type EventHandler = (payload: any) => void;

class WebSocketClient {
  private socketUrl: string = 'https://chatnova-app-n20j.onrender.com';
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private isConnected: boolean = false;

  public getStatus() {
    return { connected: this.isConnected, url: this.socketUrl };
  }

  public connect(authData?: { userId: string; customId: string }): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const token = getAuthToken();
        if (this.socket) {
          this.socket.disconnect();
        }

        this.socket = socketIO(this.socketUrl, {
          transports: ['polling', 'websocket'],
          reconnection: true,
          auth: { token, ...(authData || {}) },
        });

        this.socket.on('connect', () => {
          this.isConnected = true;
          if (authData) {
            this.socket?.emit('auth:init', authData);
          }
          resolve(true);
        });

        const events = ['chat:new_message', 'chat:message_status', 'chat:typing'];
        events.forEach((ev) => {
          this.socket?.on(ev, (data) => {
            this.notifyListeners(ev, data);
          });
        });

        this.socket.on('connect_error', () => {
          this.isConnected = false;
          resolve(false);
        });
      } catch (err) {
        this.isConnected = false;
        resolve(false);
      }
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
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

  private notifyListeners(event: string, payload: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(payload);
        } catch (err) {}
      });
    }
  }

  public emit(event: string, payload: any) {
    if (!event) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, payload);
    }
    this.notifyListeners(event, payload);
  }

  public send(event: string, payload: any) {
    this.emit(event, payload);
  }
}

export const wsService = new WebSocketClient();
