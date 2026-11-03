
import { wsService } from './websocket';

type CallRole = 'caller' | 'callee';

interface ActiveCall {
  callId: string;
  conversationId: string;
  role: CallRole;
  peer: RTCPeerConnection | null;
  localStream: MediaStream | null;
  pendingCandidates: RTCIceCandidateInit[];
}

class WebRTCCallService {
  private activeCall: ActiveCall | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private initialized = false;

  onIncomingCall: ((data: any) => void) | null = null;
  onCallStatus: ((status: string, data?: any) => void) | null = null;
  onCallError: ((message: string) => void) | null = null;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    wsService.on('call:incoming', (data) => {
      this.onIncomingCall?.(data);
    });

    wsService.on('call:accepted', async (data) => {
      if (!this.activeCall || data.callId !== this.activeCall.callId) return;

      this.onCallStatus?.('connected', data);

      if (this.activeCall.role === 'caller') {
        await this.createOffer();
      }
    });

    wsService.on('call:offer', async (data) => {
      await this.receiveOffer(data);
    });

    wsService.on('call:answer', async (data) => {
      await this.receiveAnswer(data);
    });

    wsService.on('call:ice-candidate', async (data) => {
      await this.receiveCandidate(data);
    });

    wsService.on('call:rejected', (data) => {
      this.finishLocalCall('rejected', data);
    });

    wsService.on('call:ended', (data) => {
      this.finishLocalCall('ended', data);
    });

    wsService.on('call:timeout', (data) => {
      this.finishLocalCall('timeout', data);
    });

    wsService.on('call:missed', (data) => {
      this.onCallStatus?.('missed', data);
    });

    wsService.on('call:error', (data) => {
      this.onCallError?.(data?.message || 'Call failed.');
    });

    wsService.on('call:ringing', (data) => {
      this.onCallStatus?.('ringing', data);
    });
  }

  private createCallId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `call_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }

  private async getMicrophone(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported by this browser.');
    }

    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  }

  private createPeerConnection(): RTCPeerConnection {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peer.onicecandidate = (event) => {
      if (!event.candidate || !this.activeCall) return;

      wsService.emit('call:ice-candidate', {
        callId: this.activeCall.callId,
        signal: event.candidate.toJSON()
      });
    };

    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      if (!this.remoteAudio) {
        this.remoteAudio = document.createElement('audio');
        this.remoteAudio.autoplay = true;
        this.remoteAudio.setAttribute('playsinline', 'true');
        this.remoteAudio.style.display = 'none';
        document.body.appendChild(this.remoteAudio);
      }

      this.remoteAudio.srcObject = stream;
      this.remoteAudio.play().catch((error) => {
        console.warn('[ChatNova Call] Audio playback needs user interaction:', error);
      });
    };

    peer.onconnectionstatechange = () => {
      if (!this.activeCall || this.activeCall.peer !== peer) return;

      if (peer.connectionState === 'connected') {
        this.onCallStatus?.('connected');
      }

      if (
        peer.connectionState === 'failed' ||
        peer.connectionState === 'disconnected'
      ) {
        this.onCallStatus?.('connection-lost');
      }
    };

    return peer;
  }

  private async prepareMedia(): Promise<void> {
    if (!this.activeCall) return;

    const stream = await this.getMicrophone();
    if (!this.activeCall) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const peer = this.createPeerConnection();

    this.activeCall.localStream = stream;
    this.activeCall.peer = peer;

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });
  }

  async startOutgoingCall(conversationId: string): Promise<void> {
    if (!wsService.isConnected()) {
      throw new Error('ChatNova server is not connected. Please try again.');
    }

    if (this.activeCall) {
      throw new Error('You already have an active call.');
    }

    const callId = this.createCallId();

    this.activeCall = {
      callId,
      conversationId,
      role: 'caller',
      peer: null,
      localStream: null,
      pendingCandidates: []
    };

    this.onCallStatus?.('calling');

    wsService.emit('call:invite', {
      callId,
      conversationId
    });
  }

  async acceptIncomingCall(callId: string, conversationId: string): Promise<void> {
    if (!wsService.isConnected()) {
      throw new Error('ChatNova server is not connected.');
    }

    if (this.activeCall) {
      throw new Error('You already have an active call.');
    }

    this.activeCall = {
      callId,
      conversationId,
      role: 'callee',
      peer: null,
      localStream: null,
      pendingCandidates: []
    };

    try {
      await this.prepareMedia();

      if (!this.activeCall) return;

      wsService.emit('call:accept', { callId });
      this.onCallStatus?.('connecting');
    } catch (error: any) {
      this.activeCall = null;
      throw new Error(error?.message || 'Could not access your microphone.');
    }
  }

  rejectIncomingCall(callId: string): void {
    wsService.emit('call:reject', { callId });
    this.onCallStatus?.('rejected');
  }

  async endCall(): Promise<void> {
    if (!this.activeCall) return;

    const callId = this.activeCall.callId;
    wsService.emit('call:end', { callId });
    this.cleanup();
    this.onCallStatus?.('ended');
  }

  private async createOffer(): Promise<void> {
    if (!this.activeCall) return;

    try {
      await this.prepareMedia();

      if (!this.activeCall?.peer) return;

      const offer = await this.activeCall.peer.createOffer();
      await this.activeCall.peer.setLocalDescription(offer);

      wsService.emit('call:offer', {
        callId: this.activeCall.callId,
        signal: {
          type: offer.type,
          sdp: offer.sdp
        }
      });
    } catch (error: any) {
      this.onCallError?.(error?.message || 'Could not start the voice connection.');
      await this.endCall();
    }
  }

  private async receiveOffer(data: any): Promise<void> {
    if (
      !this.activeCall ||
      this.activeCall.role !== 'callee' ||
      data.callId !== this.activeCall.callId ||
      !this.activeCall.peer
    ) {
      return;
    }

    try {
      await this.activeCall.peer.setRemoteDescription(
        new RTCSessionDescription(data.signal)
      );

      await this.applyPendingCandidates();

      const answer = await this.activeCall.peer.createAnswer();
      await this.activeCall.peer.setLocalDescription(answer);

      wsService.emit('call:answer', {
        callId: this.activeCall.callId,
        signal: {
          type: answer.type,
          sdp: answer.sdp
        }
      });
    } catch (error: any) {
      this.onCallError?.(error?.message || 'Could not answer the voice call.');
      await this.endCall();
    }
  }

  private async receiveAnswer(data: any): Promise<void> {
    if (
      !this.activeCall ||
      this.activeCall.role !== 'caller' ||
      data.callId !== this.activeCall.callId ||
      !this.activeCall.peer
    ) {
      return;
    }

    try {
      await this.activeCall.peer.setRemoteDescription(
        new RTCSessionDescription(data.signal)
      );

      await this.applyPendingCandidates();
    } catch (error: any) {
      this.onCallError?.(error?.message || 'Could not connect the voice call.');
      await this.endCall();
    }
  }

  private async receiveCandidate(data: any): Promise<void> {
    if (!this.activeCall || data.callId !== this.activeCall.callId) return;

    const candidate = data.signal as RTCIceCandidateInit;

    if (!this.activeCall.peer?.remoteDescription) {
      this.activeCall.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.activeCall.peer.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch (error) {
      console.warn('[ChatNova Call] ICE candidate error:', error);
    }
  }

  private async applyPendingCandidates(): Promise<void> {
    if (!this.activeCall?.peer?.remoteDescription) return;

    const candidates = [...this.activeCall.pendingCandidates];
    this.activeCall.pendingCandidates = [];

    for (const candidate of candidates) {
      try {
        await this.activeCall.peer.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (error) {
        console.warn('[ChatNova Call] Pending ICE candidate error:', error);
      }
    }
  }

  private finishLocalCall(status: string, data?: any): void {
    if (
      data?.callId &&
      this.activeCall &&
      data.callId !== this.activeCall.callId
    ) {
      return;
    }

    this.cleanup();
    this.onCallStatus?.(status, data);
  }

  private cleanup(): void {
    if (this.activeCall?.peer) {
      this.activeCall.peer.ontrack = null;
      this.activeCall.peer.onicecandidate = null;
      this.activeCall.peer.close();
    }

    this.activeCall?.localStream?.getTracks().forEach((track) => {
      track.stop();
    });

    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
      this.remoteAudio.remove();
      this.remoteAudio = null;
    }

    this.activeCall = null;
  }

  isInCall(): boolean {
    return this.activeCall !== null;
  }
}

export const webrtcCallService = new WebRTCCallService();
