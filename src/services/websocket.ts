import { io, Socket } from 'socket.io-client';

class WebSocketService {
  public socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(userData?: { userId?: string; customId?: string }) {
    if (this.socket && this.socket.connected) {
      return;
    }

    const BACKEND_URL = 'https://chatnova-app-n20j.onrender.com';

    this.socket = io(BACKEND_URL, {
      auth: userData,
      query: userData,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[ChatNova WS] Connected successfully with ID:', this.socket?.id);
      if (userData) {
        this.socket?.emit('auth:init', userData);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[ChatNova WS] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[ChatNova WS] Connection error:', err.message);
    });

    // Global event dispatcher for registered listeners
    this.socket.onAny((event, ...args) => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach((cb) => {
          try {
            cb(...args);
          } catch (err) {
            console.error(`Error in listener for event ${event}:`, err);
          }
        });
      }
    });
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    if (this.socket) {
      this.socket.on(event, callback as any);
    }

    return () => {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(callback);
      }
      if (this.socket) {
        this.socket.off(event, callback as any);
      }
    };
  }

  emit(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[ChatNova WS] Socket not connected. Attempting to queue/send:', event);
      // Try connecting if not connected
      this.connect();
      setTimeout(() => {
        this.socket?.emit(event, data);
      }, 1000);
    }
  }

  send(event: string, data: any) {
    this.emit(event, data);
  }
}

export const wsService = new WebSocketService();

// Attach globally for debugging in F12 console
if (typeof window !== 'undefined') {
  (window as any).wsService = wsService;
}
