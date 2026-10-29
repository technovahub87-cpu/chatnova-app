import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  Shield,
  Lock,
  Paperclip,
  Mic,
  Send,
  Check,
  CheckCheck,
  Play,
  Pause,
  FileText,
  Image as ImageIcon,
  Clock,
  Trash2,
  Users,
  Info
} from 'lucide-react';
import { Chat, Message, User } from '../types';
import { SafetyNumberModal } from './SafetyNumberModal';
import { GroupInfoModal } from './GroupInfoModal';
import { wsService } from '../services/websocket';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

interface ChatRoomProps {
  chat: Chat;
  currentUser: User;
  messages: Message[];
  onBack: () => void;
  onSendMessage: (msg: Partial<Message>) => void;
  onStartCall: (type: 'voice' | 'video') => void;
  onUpdateChat?: (updatedChat: Chat) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chat,
  currentUser,
  messages,
  onBack,
  onSendMessage,
  onStartCall,
  onUpdateChat,
}) => {
  const { isDark } = useTheme();
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Deterministic chatId generator taaki dono users ke liye hamesha same ID bane
  const targetChatId = (!chat.isGroup && chat.participant && currentUser)
    ? [currentUser.id, chat.participant.id].sort().join('_')
    : chat.id;

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Voice playback state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [voiceProgress, setVoiceProgress] = useState<{ [id: string]: number }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<any>(null);
  const playbackTimerRef = useRef<any>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Join socket room with targetChatId
  useEffect(() => {
    if (targetChatId) {
      wsService.emit('chat:join', targetChatId);
    }
  }, [targetChatId]);

  // Listen to WebSocket typing events
  useEffect(() => {
    const unsub = wsService.on('chat:typing', (data: any) => {
      if (data && data.chatId === targetChatId) {
        setIsTyping(data.isTyping);
        if (data.senderName) setTypingUser(data.senderName);
      }
    });

    return () => unsub();
  }, [targetChatId]);

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !chat) return;

    const newMsg: Partial<Message> = {
      chatId: targetChatId,
      senderId: currentUser?.id || 'usr_me',
      senderName: currentUser?.displayName || 'User',
      type: 'text',
      content: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
    };

    onSendMessage(newMsg);
    setInputText('');
    setShowAttachmentMenu(false);
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    setRecordingSeconds(0);
    clearInterval(recordingTimerRef.current);
  };

  const sendVoiceNote = () => {
    if (!chat) return;
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
    const duration = Math.max(recordingSeconds, 3);

    const waveform: number[] = [];
    for (let i = 0; i < 20; i++) {
      waveform.push(Math.floor(Math.random() * 70) + 25);
    }

    const voiceMsg: Partial<Message> = {
      chatId: targetChatId,
      senderId: currentUser?.id || 'usr_me',
      senderName: currentUser?.displayName || 'User',
      type: 'voice',
      content: `Voice message (${duration}s)`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      voice: {
        duration,
        waveform,
      },
    };

    onSendMessage(voiceMsg);
    setRecordingSeconds(0);
  };

  const togglePlayVoice = (msgId: string, duration: number) => {
    if (playingVoiceId === msgId) {
      clearInterval(playbackTimerRef.current);
      setPlayingVoiceId(null);
    } else {
      clearInterval(playbackTimerRef.current);
      setPlayingVoiceId(msgId);

      playbackTimerRef.current = setInterval(() => {
        setVoiceProgress((prev) => {
          const current = prev[msgId] || 0;
          if (current >= 100) {
            clearInterval(playbackTimerRef.current);
            setPlayingVoiceId(null);
            return { ...prev, [msgId]: 0 };
          }
          return { ...prev, [msgId]: current + (100 / (duration * 10)) * playbackSpeed };
        });
      }, 100);
    }
  };

  const cycleSpeed = () => {
    if (playbackSpeed === 1) setPlaybackSpeed(1.5);
    else if (playbackSpeed === 1.5) setPlaybackSpeed(2);
    else setPlaybackSpeed(1);
  };

  const handleSendMediaAttachment = (type: 'image' | 'file') => {
    if (!chat) return;
    setShowAttachmentMenu(false);
    if (type === 'image') {
      const imgMsg: Partial<Message> = {
        chatId: targetChatId,
        senderId: currentUser?.id || 'usr_me',
        senderName: currentUser?.displayName || 'User',
        type: 'image',
        content: 'Sent an encrypted photo',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sending',
        media: {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
          name: 'encrypted_payload_capture.png',
          size: '1.8 MB',
          encryptedHash: 'sha256-4b227777d4678d45e412347890abcdef',
        },
      };
      onSendMessage(imgMsg);
    } else {
      const docMsg: Partial<Message> = {
        chatId: targetChatId,
        senderId: currentUser?.id || 'usr_me',
        senderName: currentUser?.displayName || 'User',
        type: 'file',
        content: 'offshore_routing_mesh.pdf',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sending',
        media: {
          type: 'file',
          url: '#',
          name: 'offshore_routing_mesh.pdf',
          size: '3.1 MB',
          encryptedHash: 'sha256-a192837465b0c9d8e7f6a5b4c3d2e1f0',
        },
      };
      onSendMessage(docMsg);
    }
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? `0${s}` : s}`;
  };

  const groupSubtitle = chat?.isGroup
    ? (chat.groupMembers || [])
        .map((m) => (m && currentUser && m.id === currentUser.id ? 'You' : m?.displayName || 'Member'))
        .join(', ')
    : null;

  const handleAddGroupMember = (newMember: User) => {
    if (!chat || !chat.isGroup || !onUpdateChat) return;
    const currentMembers = chat.groupMembers || [];
    if (currentMembers.some((m) => m && m.id === newMember.id)) return;

    const updatedMembers = [...currentMembers, newMember];
    const updatedChat: Chat = {
      ...chat,
      groupMembers: updatedMembers,
      lastMessage: {
        id: 'msg_' + Date.now(),
        chatId: targetChatId,
        senderId: currentUser?.id || 'usr_me',
        senderName: currentUser?.displayName || 'User',
        type: 'system',
        content: `${currentUser?.displayName || 'User'} added ${newMember.displayName} to the group.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'read',
      },
    };

    onUpdateChat(updatedChat);
  };

  if (!chat) return null;

  return (
    <div
      className={`flex-1 flex flex-col h-full relative overflow-hidden transition-colors duration-200 ${
        isDark ? 'bg-[#0b141a] text-slate-100' : 'bg-[#efeae2] text-slate-900'
      }`}
    >
      <div
        className={`absolute inset-0 pointer-events-none ${
          isDark
            ? 'opacity-[0.035] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:18px_18px]'
            : 'opacity-[0.06] bg-[radial-gradient(#059669_1.2px,transparent_1.2px)] [background-size:20px_20px]'
        }`}
      />

      {/* TOP CHAT HEADER */}
      <div
        className={`relative z-20 flex items-center justify-between px-3 py-2.5 border-b shadow-xs shrink-0 select-none transition-colors duration-200 ${
          isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className={`md:hidden p-1.5 rounded-full transition cursor-pointer ${
              isDark ? 'hover:bg-slate-700/60 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            className="relative cursor-pointer shrink-0"
            onClick={() => {
              if (chat.isGroup) setShowGroupInfoModal(true);
              else setShowSafetyModal(true);
            }}
          >
            <img
              src={chat.groupIcon || chat.participant?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
              alt={chat.groupName || chat.participant?.displayName || 'Chat'}
              className="w-10 h-10 rounded-full object-cover ring-1 ring-emerald-500/50"
            />
            {chat.isGroup ? (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 border border-white dark:border-[#202c33] flex items-center justify-center text-white">
                <Users className="w-2.5 h-2.5" />
              </span>
            ) : chat.participant?.status === 'online' ? (
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ${
                  isDark ? 'ring-[#202c33]' : 'ring-[#f0f2f5]'
                }`}
              />
            ) : null}
          </div>

          <div
            className="cursor-pointer min-w-0"
            onClick={() => {
              if (chat.isGroup) setShowGroupInfoModal(true);
              else setShowSafetyModal(true);
            }}
          >
            <div className="flex items-center gap-1.5 truncate">
              <h3
                className={`font-semibold text-sm leading-tight truncate ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {chat.isGroup ? chat.groupName : (chat.participant?.displayName || 'Unknown')}
              </h3>
              <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            </div>

            <p
              className={`text-[11px] font-mono flex items-center gap-1 truncate ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {isTyping ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse truncate">
                  {typingUser || 'typing...'}
                </span>
              ) : chat.isGroup ? (
                <span className="truncate text-[10.5px]">
                  {groupSubtitle}
                </span>
              ) : (
                <>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {chat.participant?.customId}
                  </span>
                  <span>•</span>
                  <span>{chat.participant?.lastSeen || 'Online'}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-300 shrink-0">
          <ThemeToggle />

          {!chat.isGroup && (
            <>
              <button
                type="button"
                onClick={() => onStartCall('video')}
                title="Encrypted Video Call"
                className={`p-2 rounded-full transition cursor-pointer ${
                  isDark ? 'hover:bg-slate-700/60 hover:text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Video className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => onStartCall('voice')}
                title="Encrypted Voice Call"
                className={`p-2 rounded-full transition cursor-pointer ${
                  isDark ? 'hover:bg-slate-700/60 hover:text-white' : 'hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Phone className="w-4.5 h-4.5" />
              </button>
            </>
          )}

          {chat.isGroup ? (
            <button
              type="button"
              onClick={() => setShowGroupInfoModal(true)}
              title="View Group Info & Members"
              className={`p-2 rounded-full transition cursor-pointer ${
                isDark ? 'text-emerald-400 hover:bg-slate-700/60' : 'text-emerald-600 hover:bg-slate-200'
              }`}
            >
              <Info className="w-4.5 h-4.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSafetyModal(true)}
              title="View E2EE Safety Number"
              className={`p-2 rounded-full transition cursor-pointer ${
                isDark
                  ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-700/60'
                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-slate-200'
              }`}
            >
              <Lock className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* MESSAGES SCROLL AREA */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 relative z-10">
        <div
          onClick={() => {
            if (chat.isGroup) setShowGroupInfoModal(true);
            else setShowSafetyModal(true);
          }}
          className={`mx-auto max-w-sm p-3 rounded-2xl border text-center cursor-pointer shadow-md transition ${
            isDark
              ? 'bg-[#182229]/95 border-emerald-500/30 hover:border-emerald-400'
              : 'bg-emerald-50/90 border-emerald-300 hover:border-emerald-500'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1">
            <Lock className="w-3.5 h-3.5" />
            <span>{chat.isGroup ? 'Group Encrypted Ratchet' : 'End-to-End Encrypted'}</span>
          </div>
          <p
            className={`text-[11px] leading-relaxed font-sans ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {chat.isGroup
              ? `Messages and files in "${chat.groupName}" are secured with multi-party 256-bit sender keys. Only current members can decrypt them.`
              : 'Messages and calls in this conversation are secured with 256-bit Post-Quantum ratcheted encryption.'}
          </p>
          <span className="inline-block mt-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 underline font-semibold">
            {chat.isGroup ? 'Tap to view group members & ratchet info' : 'Tap to verify safety fingerprint'}
          </span>
        </div>

        {messages.map((msg) => {
          if (!msg) return null;
          const isMe = currentUser && msg.senderId === currentUser.id;
          const isSystem = msg.type === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div
                  className={`px-3 py-1.5 rounded-xl text-center text-xs font-mono max-w-sm border shadow-xs ${
                    isDark
                      ? 'bg-slate-900/80 border-slate-800 text-slate-300'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="font-semibold">{msg.content}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">{msg.timestamp}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`relative max-w-[85%] sm:max-w-md px-3.5 py-2 rounded-2xl shadow-sm text-sm break-words transition-colors ${
                  isMe
                    ? isDark
                      ? 'bg-[#005c4b] text-white rounded-tr-none'
                      : 'bg-[#d9fdd3] text-slate-900 rounded-tr-none border border-emerald-200/60 shadow-xs'
                    : isDark
                    ? 'bg-[#202c33] text-slate-100 rounded-tl-none border border-slate-700/40'
                    : 'bg-[#ffffff] text-slate-900 rounded-tl-none border border-slate-200/80 shadow-xs'
                }`}
              >
                {!isMe && (
                  <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 mb-0.5 flex items-center gap-1">
                    <span>{msg.senderName}</span>
                    {chat.isGroup && (
                      <span className="text-[9.5px] text-slate-400 font-mono font-normal">
                        ({msg.senderId})
                      </span>
                    )}
                  </p>
                )}

                {msg.type === 'text' && (
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}

                {msg.type === 'voice' && (
                  <div className="flex items-center gap-2.5 py-1 min-w-[220px]">
                    <button
                      type="button"
                      onClick={() => togglePlayVoice(msg.id, msg.voice?.duration || 10)}
                      className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0 shadow transition cursor-pointer"
                    >
                      {playingVoiceId === msg.id ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-0.5 h-6">
                        {(msg.voice?.waveform || [40, 60, 80, 50, 70, 90, 40, 60, 80, 50, 70, 90, 40, 60]).map(
                          (h, i) => {
                            const percent = ((i + 1) / 14) * 100;
                            const currentProgress = voiceProgress[msg.id] || 0;
                            const isPlayed = currentProgress >= percent;

                            return (
                              <div
                                key={i}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                  isPlayed
                                    ? 'bg-emerald-500'
                                    : isDark
                                    ? 'bg-slate-500/60'
                                    : 'bg-slate-300'
                                }`}
                                style={{ height: `${Math.max(6, (h / 100) * 24)}px` }}
                              />
                            );
                          }
                        )}
                      </div>

                      <div
                        className={`flex items-center justify-between text-[10px] font-mono ${
                          isMe
                            ? isDark
                              ? 'text-slate-300/80'
                              : 'text-slate-600'
                            : isDark
                            ? 'text-slate-400'
                            : 'text-slate-500'
                        }`}
                      >
                        <span>{formatSecs(msg.voice?.duration || 12)}</span>
                        <button
                          type="button"
                          onClick={cycleSpeed}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            isDark
                              ? 'bg-black/30 hover:bg-black/50 text-emerald-300'
                              : 'bg-slate-200 hover:bg-slate-300 text-emerald-800'
                          }`}
                        >
                          {playbackSpeed}x
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {msg.type === 'image' && msg.media && (
                  <div className="mt-0.5 mb-1.5">
                    <div className="relative rounded-xl overflow-hidden border border-black/10 dark:border-white/10 group">
                      <img
                        src={msg.media.url}
                        alt="Encrypted payload"
                        className="w-full max-h-60 object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Encrypted Media
                      </div>
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      {msg.content}
                    </p>
                  </div>
                )}

                {msg.type === 'file' && msg.media && (
                  <div
                    className={`flex items-center gap-2.5 p-2 rounded-xl my-1 border ${
                      isDark
                        ? 'bg-black/25 border-white/10'
                        : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 truncate">
                      <p
                        className={`text-xs font-semibold truncate ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {msg.media.name}
                      </p>
                      <p
                        className={`text-[10px] font-mono ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {msg.media.size} • Encrypted SHA-256
                      </p>
                    </div>
                  </div>
                )}

                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] font-mono select-none ${
                    isMe
                      ? isDark
                        ? 'text-slate-300/80'
                        : 'text-slate-600'
                      : isDark
                      ? 'text-slate-400'
                      : 'text-slate-500'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {isMe && (
                    <span className="inline-flex">
                      {msg.status === 'sending' && <Clock className="w-3 h-3 animate-spin" />}
                      {msg.status === 'sent' && <Check className="w-3 h-3 text-slate-400" />}
                      {msg.status === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-slate-400" />}
                      {msg.status === 'read' && <CheckCheck className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-300" />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border w-24 ${
              isDark ? 'bg-[#202c33] border-slate-700/50' : 'bg-white border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ATTACHMENT POPUP MENU */}
      {showAttachmentMenu && (
        <div
          className={`absolute bottom-16 left-4 z-30 p-2 rounded-2xl border shadow-2xl flex flex-col gap-1 w-52 animate-in fade-in slide-in-from-bottom-2 ${
            isDark ? 'bg-[#202c33] border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSendMediaAttachment('image')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition text-left cursor-pointer ${
              isDark ? 'hover:bg-slate-700/60 text-white' : 'hover:bg-slate-100 text-slate-900'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold leading-none">Encrypted Photo</p>
              <p className="text-[10px] text-slate-500">Zero metadata / EXIF stripped</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSendMediaAttachment('file')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition text-left cursor-pointer ${
              isDark ? 'hover:bg-slate-700/60 text-white' : 'hover:bg-slate-100 text-slate-900'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold leading-none">Encrypted File</p>
              <p className="text-[10px] text-slate-500">PDF / Keys / Specs</p>
            </div>
          </button>
        </div>
      )}

      {/* BOTTOM INPUT & VOICE RECORDING BAR */}
      <div
        className={`relative z-20 px-3 py-2 border-t shrink-0 transition-colors duration-200 ${
          isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
        }`}
      >
        {isRecording ? (
          <div
            className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-full border ${
              isDark
                ? 'bg-[#111b21] border-emerald-500/40'
                : 'bg-white border-emerald-500/60 shadow-md'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-mono font-bold text-rose-500">
                REC {formatSecs(recordingSeconds)}
              </span>
            </div>

            <div className="flex-1 flex items-center justify-center gap-1 h-4 px-4">
              {[30, 70, 45, 90, 60, 100, 75, 40, 80, 60].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-emerald-500 rounded-full animate-pulse"
                  style={{
                    height: `${(h / 100) * 16}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-1.5 rounded-full hover:bg-rose-500/20 text-rose-500 transition cursor-pointer"
                title="Discard"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={sendVoiceNote}
                className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 flex items-center justify-center shadow-lg transition cursor-pointer"
                title="Send Voice Note"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className={`p-2 rounded-full transition cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Attach File / Media"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={chat.isGroup ? `Message ${chat.groupName}...` : 'Type an encrypted message...'}
                className={`w-full rounded-full px-4 py-2.5 text-sm transition focus:outline-none focus:ring-1 focus:ring-emerald-500 border ${
                  isDark
                    ? 'bg-[#2a3942] border-slate-700/60 text-white placeholder-slate-400'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500 shadow-xs'
                }`}
              />
            </div>

            {inputText.trim() ? (
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 flex items-center justify-center shadow-md transition transform active:scale-95 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                title="Hold or tap to record voice note"
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md transition transform active:scale-95 cursor-pointer shrink-0"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Safety Number & Group Info Modals */}
      {!chat.isGroup && chat.participant && (
        <SafetyNumberModal
          isOpen={showSafetyModal}
          onClose={() => setShowSafetyModal(false)}
          participant={chat.participant}
        />
      )}

      {chat.isGroup && (
        <GroupInfoModal
          chat={chat}
          currentUser={currentUser}
          isOpen={showGroupInfoModal}
          onClose={() => setShowGroupInfoModal(false)}
          onAddMember={handleAddGroupMember}
          onLeaveGroup={() => {
            onBack();
          }}
        />
      )}
    </div>
  );
};
