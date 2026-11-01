import { io, Socket } from 'socket.io-client';

class WebSocketService {
  public socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(userData?: { userId?: string; customId?: string }) {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const BACKEND_URL = 'https://chatnova-app-n20j.onrender.com';

    this.socket = io(BACKEND_URL, {
      auth: userData,
      query: userData,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('[ChatNova WS] Connected successfully! ID:', this.socket?.id);
      if (userData) {
        this.socket?.emit('auth:init', userData);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[ChatNova WS] Disconnected:', reason);
    });

    // Global listener dispatcher
    this.socket.onAny((event, ...args) => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach((cb) => cb(...args));
      }
    });

    return this.socket;
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
      this.listeners.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback as any);
      }
    };
  }

  emit(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      this.connect();
      setTimeout(() => {
        this.socket?.emit(event, data);
      }, 800);
    }
  }

  send(event: string, data: any) {
    this.emit(event, data);
  }
}

export const wsService = new WebSocketService();

// Force bind globally so F12 console can check it directly
if (typeof window !== 'undefined') {
  (window as any).wsService = wsService;
  (window as any).checkSocket = () => {
    return wsService.socket ? wsService.socket.connected : false;
  };
}
