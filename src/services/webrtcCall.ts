
import { wsService } from './websocket';
import {
  setNativeCallSpeaker,
  resetNativeCallAudio
} from './nativeAudio';
import { API_BASE_URL, getAuthToken } from './api';
import {
  playIncomingRingtone,
  stopIncomingRingtone
} from './ringtonePicker';

type CallRole = 'caller' | 'callee';
export type CallType = 'voice' | 'video';

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

interface ActiveCall {
  callId: string;
  conversationId: string;
  role: CallRole;
  type: CallType;
  peer: RTCPeerConnection | null;
  localStream: MediaStream | null;
  pendingCandidates: RTCIceCandidateInit[];
}

class WebRTCCallService {
  private activeCall: ActiveCall | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private initialized = false;
  private selectedAudioOutput = '';

  // TURN server cache: refresh every 30 minutes.
  private iceServersCache: RTCIceServer[] | null = null;
  private iceServersCacheAt = 0;
  private readonly iceServersCacheDuration = 30 * 60 * 1000;

  // Allow temporary network interruptions to recover.
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly recoveryDelay = 15000;

  onIncomingCall: ((data: any) => void) | null = null;
  onCallStatus: ((status: string, data?: any) => void) | null = null;
  onCallError: ((message: string) => void) | null = null;
  onLocalStream: ((stream: MediaStream | null) => void) | null = null;
  onRemoteStream: ((stream: MediaStream | null) => void) | null = null;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

   wsService.on('call:incoming', (data) => {
  void playIncomingRingtone();
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
  void stopIncomingRingtone();
  this.onCallStatus?.('missed', data);
});

    wsService.on('call:error', (data) => {
      this.onCallError?.(data?.message || 'Call failed.');
    });

    wsService.on('call:ringing', (data) => {
      this.onCallStatus?.('ringing', data);
    });
  }

  // Fetch Metered TURN credentials securely through the backend.
  private async getIceServers(): Promise<RTCIceServer[]> {
    if (
      this.iceServersCache &&
      Date.now() - this.iceServersCacheAt < this.iceServersCacheDuration
    ) {
      return this.iceServersCache;
    }

    const token = getAuthToken();

    if (!token) {
      throw new Error('Please log in again to connect calls.');
    }

    const response = await fetch(
      `${API_BASE_URL}/calls/turn-ice-servers`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        credentials: 'include',
        signal: AbortSignal.timeout(12000)
      }
    );

    const result = await response.json().catch(() => ({}));

    if (
      !response.ok ||
      result.success !== true ||
      !Array.isArray(result.iceServers) ||
      result.iceServers.length === 0
    ) {
      throw new Error(
        result.message || 'Unable to load call network settings.'
      );
    }

    this.iceServersCache = result.iceServers as RTCIceServer[];
    this.iceServersCacheAt = Date.now();

    return this.iceServersCache;
  }

  private clearRecoveryTimer(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  private handleConnectionState(peer: RTCPeerConnection): void {
    if (!this.activeCall || this.activeCall.peer !== peer) return;

    const state = peer.connectionState;

    if (state === 'connected') {
      this.clearRecoveryTimer();
      this.onCallStatus?.('connected');
      return;
    }

    if (state === 'disconnected' || state === 'failed') {
      this.onCallStatus?.('reconnecting');
      this.clearRecoveryTimer();

      this.recoveryTimer = setTimeout(() => {
        if (!this.activeCall || this.activeCall.peer !== peer) return;

        const currentState = peer.connectionState;

        if (
          currentState === 'disconnected' ||
          currentState === 'failed'
        ) {
          this.onCallStatus?.('connection-lost');
        }
      }, this.recoveryDelay);
    }
  }

  private createCallId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `call_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }

  private async getCallMedia(type: CallType): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Camera and microphone are not supported by this browser.'
      );
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: type === 'video'
          ? {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 24, max: 30 }
            }
          : false
      });
    } catch (error: any) {
      if (type === 'video') {
        if (error?.name === 'NotAllowedError') {
          throw new Error(
            'Camera or microphone permission denied. Please allow both permissions.'
          );
        }

        if (error?.name === 'NotFoundError') {
          throw new Error(
            'Camera or microphone not found on this device.'
          );
        }

        throw new Error(
          error?.message || 'Unable to access camera and microphone.'
        );
      }

      throw new Error(error?.message || 'Unable to access microphone.');
    }
  }

  private createPeerConnection(
    iceServers: RTCIceServer[]
  ): RTCPeerConnection {
    const peer = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10
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

      this.onRemoteStream?.(stream);

      if (this.activeCall?.type === 'voice') {
        if (!this.remoteAudio) {
          this.remoteAudio = document.createElement('audio');
          this.remoteAudio.autoplay = true;
          this.remoteAudio.setAttribute('playsinline', 'true');
          this.remoteAudio.style.display = 'none';
          document.body.appendChild(this.remoteAudio);
        }

        this.remoteAudio.srcObject = stream;

        if (this.selectedAudioOutput) {
          void this.applyAudioOutput(this.selectedAudioOutput);
        }

        this.remoteAudio.play().catch((error) => {
          console.warn(
            '[ChatNova Call] Audio playback needs user interaction:',
            error
          );
        });
      }
    };

    peer.onconnectionstatechange = () => {
      this.handleConnectionState(peer);
    };

    return peer;
  }

  private async prepareMedia(): Promise<void> {
    if (!this.activeCall) return;

    const type = this.activeCall.type;
    const stream = await this.getCallMedia(type);

    if (!this.activeCall) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    let iceServers: RTCIceServer[];

    try {
      iceServers = await this.getIceServers();
      console.info('[ChatNova Call] Metered TURN servers loaded.');
    } catch (error) {
      console.error(
        '[ChatNova Call] TURN server unavailable; using STUN fallback:',
        error
      );

      // Keep direct connections available if TURN cannot be reached.
      iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];
    }

    if (!this.activeCall) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    // Voice call: earpiece by default.
    // Video call: loudspeaker by default.
    await setNativeCallSpeaker(type === 'video');

    if (!this.activeCall) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const peer = this.createPeerConnection(iceServers);

    this.activeCall.localStream = stream;
    this.activeCall.peer = peer;

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    this.onLocalStream?.(stream);
  }

  async setSpeakerEnabled(enabled: boolean): Promise<boolean> {
    if (!this.activeCall) return false;
    return setNativeCallSpeaker(enabled);
  }

  async startOutgoingCall(
    conversationId: string,
    type: CallType = 'voice'
  ): Promise<void> {
    if (!wsService.isConnected()) {
      throw new Error(
        'ChatNova server is not connected. Please try again.'
      );
    }

    if (this.activeCall) {
      throw new Error('You already have an active call.');
    }

    const callId = this.createCallId();

    this.activeCall = {
      callId,
      conversationId,
      role: 'caller',
      type,
      peer: null,
      localStream: null,
      pendingCandidates: []
    };

    this.onCallStatus?.('calling');

    wsService.emit('call:invite', {
      callId,
      conversationId,
      type
    });
  }

  async acceptIncomingCall(
    callId: string,
    conversationId: string,
    type: CallType = 'voice'
  ): Promise<void> {
    void stopIncomingRingtone();
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
      type,
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
      this.cleanup();
      throw new Error(
        error?.message || 'Could not access your camera or microphone.'
      );
    }
  }

 rejectIncomingCall(callId: string): void {
  void stopIncomingRingtone();
  wsService.emit('call:reject', { callId });
  this.onCallStatus?.('rejected');
}

  async endCall(): Promise<void> {
    void stopIncomingRingtone();
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
      this.onCallError?.(
        error?.message || 'Could not start the call connection.'
      );
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
      this.onCallError?.(
        error?.message || 'Could not answer the call.'
      );
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
      this.onCallError?.(
        error?.message || 'Could not connect the call.'
      );
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
        console.warn(
          '[ChatNova Call] Pending ICE candidate error:',
          error
        );
      }
    }
  }

  private async applyAudioOutput(deviceId: string): Promise<void> {
    if (!this.remoteAudio) return;

    const audio = this.remoteAudio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };

    if (typeof audio.setSinkId !== 'function') {
      console.warn(
        '[ChatNova Call] Audio output selection is not supported on this device.'
      );
      return;
    }

    try {
      await audio.setSinkId(deviceId);
    } catch (error) {
      console.warn(
        '[ChatNova Call] Could not change audio output:',
        error
      );
    }
  }

  async getAudioOutputDevices(): Promise<AudioOutputDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      return devices
        .filter((device) => device.kind === 'audiooutput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Audio output ${index + 1}`
        }));
    } catch (error) {
      console.warn(
        '[ChatNova Call] Could not list audio outputs:',
        error
      );
      return [];
    }
  }

  async setAudioOutput(deviceId: string): Promise<boolean> {
    this.selectedAudioOutput = deviceId;

    if (!this.remoteAudio) return true;

    const audio = this.remoteAudio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };

    if (typeof audio.setSinkId !== 'function') {
      return false;
    }

    try {
      await audio.setSinkId(deviceId);
      return true;
    } catch (error) {
      console.warn(
        '[ChatNova Call] Audio output change failed:',
        error
      );
      return false;
    }
  }

  setRemoteVolume(volume: number): void {
    const safeVolume = Math.max(0, Math.min(1, volume));

    if (this.remoteAudio) {
      this.remoteAudio.volume = safeVolume;
    }
  }

  getRemoteVolume(): number {
    return this.remoteAudio?.volume ?? 1;
  }

  toggleMicrophone(): boolean {
    const tracks = this.activeCall?.localStream?.getAudioTracks() || [];

    if (!tracks.length) return false;

    const nextEnabled = !tracks[0].enabled;

    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    return nextEnabled;
  }

  toggleCamera(): boolean {
    const tracks = this.activeCall?.localStream?.getVideoTracks() || [];

    if (!tracks.length) return false;

    const nextEnabled = !tracks[0].enabled;

    tracks.forEach((track) => {
      track.enabled = nextEnabled;
    });

    return nextEnabled;
  }

  isCameraEnabled(): boolean {
    return this.activeCall?.localStream
      ?.getVideoTracks()
      .some((track) => track.enabled) || false;
  }

  isMicrophoneEnabled(): boolean {
    return this.activeCall?.localStream
      ?.getAudioTracks()
      .some((track) => track.enabled) || false;
  }

  getCallType(): CallType | null {
    return this.activeCall?.type || null;
  }

  private finishLocalCall(status: string, data?: any): void {
    void stopIncomingRingtone();
    if (
      data?.callId &&
      this.activeCall &&
      data.callId !== this.activeCall.callId
    ) {
      return;
    }

    this.cleanup();
    void stopIncomingRingtone();
    this.onCallStatus?.(status, data);
  }

  private cleanup(): void {
    this.clearRecoveryTimer();

    if (this.activeCall?.peer) {
      this.activeCall.peer.ontrack = null;
      this.activeCall.peer.onicecandidate = null;
      this.activeCall.peer.onconnectionstatechange = null;
      this.activeCall.peer.close();
    }

    this.activeCall?.localStream?.getTracks().forEach((track) => {
      track.stop();
    });

    this.onLocalStream?.(null);
    this.onRemoteStream?.(null);

    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
      this.remoteAudio.remove();
      this.remoteAudio = null;
    }

    this.activeCall = null;

    void resetNativeCallAudio();
  }

  isInCall(): boolean {
    return this.activeCall !== null;
  }
}

export const webrtcCallService = new WebRTCCallService();
