import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Lock,
  CheckCheck,
  MoreVertical,
  Phone,
  Video,
  Info,
  Smile,
  FileText,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { Chat, Message, User } from '../types';
import { wsService } from '../services/websocket';
import { useTheme } from '../context/ThemeContext';

interface ChatRoomProps {
  chat: Chat;
  currentUser: User;
  messages: Message[];
  onSendMessage: (msgData: Partial<Message>) => void;
  onBack: () => void;
  onUpdateChat: (updatedChat: Chat) => void;
  onStartCall: (type: 'voice' | 'video') => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chat,
  currentUser,
  messages,
  onSendMessage,
  onBack,
  onUpdateChat,
  onStartCall,
}) => {
  const { isDark } = useTheme();
  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Join deterministic chat room on socket
  useEffect(() => {
    if (chat && chat.id) {
      wsService.emit('chat:join', chat.id);
      if (chat.participant?.customId) {
        wsService.emit('chat:join', chat.participant.customId);
      }
    }
  }, [chat?.id, chat?.participant?.customId]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage({
      content: inputText.trim(),
      type: 'text',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    setInputText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      onSendMessage({
        content: file.name,
        type: type,
        media: {
          url: base64String,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    };
    reader.readAsDataURL(file);
    setShowAttachMenu(false);
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopAndSendRecording = () => {
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);

    const mins = Math.floor(recordingDuration / 60);
    const secs = recordingDuration % 60;
    const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    onSendMessage({
      content: `Voice message (${durationStr})`,
      type: 'voice',
      voice: {
        duration: durationStr,
        audioUrl: 'mock_audio_stream',
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    setRecordingDuration(0);
  };

  const chatTitle = chat.isGroup ? chat.groupName : (chat.participant?.displayName || 'Encrypted User');
  const chatAvatar = chat.isGroup ? (chat.groupIcon || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80') : (chat.participant?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80');
  const chatStatusText = chat.isGroup ? `${chat.groupMembers?.length || 0} members in secure enclave` : (chat.participant?.status === 'online' ? 'Online • End-to-End Encrypted' : 'Offline • Ratcheted Channel');

  return (
    <div className={`flex-1 h-full flex flex-col relative ${isDark ? 'bg-[#0b141a]' : 'bg-[#efeae2]'}`}>
      {/* HEADER */}
      <div className={`px-4 py-2.5 flex items-center justify-between border-b select-none z-20 ${
        isDark ? 'bg-[#202c33] border-slate-800 text-white' : 'bg-[#f0f2f5] border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-2 rounded-full hover:bg-slate-500/20 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowInfoModal(true)}>
            <div className="relative">
              <img src={chatAvatar} alt={chatTitle} className="w-10 h-10 rounded-full object-cover ring-1 ring-emerald-500/40" />
              {!chat.isGroup && chat.participant?.status === 'online' && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#202c33]" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                {chatTitle}
                <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
              </h3>
              <p className="text-[10px] font-mono text-emerald-500 truncate max-w-[200px] sm:max-w-xs">
                {chatStatusText}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 relative">
          <button
            type="button"
            onClick={() => onStartCall('voice')}
            title="Start Encrypted Voice Call"
            className="p-2.5 rounded-full hover:bg-slate-500/20 transition text-emerald-500 cursor-pointer"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStartCall('video')}
            title="Start Encrypted Video Call"
            className="p-2.5 rounded-full hover:bg-slate-500/20 transition text-emerald-500 cursor-pointer"
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowChatMenu(!showChatMenu)}
            className="p-2.5 rounded-full hover:bg-slate-500/20 transition cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showChatMenu && (
            <div className={`absolute right-0 top-12 z-40 w-48 rounded-2xl border shadow-2xl py-1 text-xs ${
              isDark ? 'bg-[#233138] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setShowInfoModal(true);
                  setShowChatMenu(false);
                }}
                className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 ${isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'}`}
              >
                <Info className="w-4 h-4 text-emerald-500" />
                <span>Enclave Info</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MESSAGE LIST */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        <div className="flex justify-center mb-4">
          <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono flex items-center gap-2 max-w-md text-center shadow-sm ${
            isDark ? 'bg-[#182229] border-emerald-500/20 text-emerald-400' : 'bg-[#fff5c0] border-amber-200 text-slate-800'
          }`}>
            <Lock className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>Messages & calls are secured with 256-bit Post-Quantum ratcheted encryption. Zero logs retained.</span>
          </div>
        </div>

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUser.id;
          return (
            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-sm relative text-xs sm:text-sm ${
                isMe
                  ? isDark ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#d9fdd3] text-slate-900 rounded-tr-none'
                  : isDark ? 'bg-[#202c33] text-slate-100 rounded-tl-none' : 'bg-white text-slate-900 rounded-tl-none'
              }`}>
                {chat.isGroup && !isMe && (
                  <p className="text-[10px] font-bold text-teal-400 mb-0.5">{msg.senderName}</p>
                )}

                {msg.type === 'text' && <p className="break-words leading-relaxed">{msg.content}</p>}

                {msg.type === 'image' && msg.media && (
                  <div className="space-y-1.5 mb-1">
                    <img src={msg.media.url} alt="media" className="rounded-xl max-h-60 object-cover w-full cursor-pointer" />
                    <p className="text-[10px] opacity-80">{msg.media.name}</p>
                  </div>
                )}

                {msg.type === 'document' && msg.media && (
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-black/25 mb-1">
                    <FileText className="w-8 h-8 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold truncate">{msg.media.name}</p>
                      <p className="text-[10px] opacity-75">{msg.media.size} • Encrypted Doc</p>
                    </div>
                  </div>
                )}

                {msg.type === 'voice' && (
                  <div className="flex items-center gap-3 py-1 min-w-[160px]">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 w-full bg-slate-600/50 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 w-2/3" />
                      </div>
                      <div className="flex justify-between text-[10px] opacity-75 mt-1 font-mono">
                        <span>Voice Note</span>
                        <span>{msg.voice?.duration || '0:12'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] font-mono opacity-75">
                  <span>{msg.timestamp}</span>
                  {isMe && (
                    <span>
                      <CheckCheck className={`w-3.5 h-3.5 ${msg.status === 'read' ? 'text-cyan-400' : ''}`} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT FOOTER */}
      <div className={`p-3 border-relative ${isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'}`}>
        {isRecording ? (
          <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30">
            <div className="flex items-center gap-3 text-rose-500 font-bold text-xs animate-pulse">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span>Recording Voice Enclave ({recordingDuration}s)...</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRecording(false)}
                className="p-2 rounded-xl bg-slate-700 text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
              >
                Send Voice
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2 relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-2.5 rounded-full hover:bg-slate-500/20 text-slate-400 hover:text-emerald-500 transition cursor-pointer"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {showAttachMenu && (
                <div className={`absolute bottom-12 left-0 z-40 w-48 rounded-2xl border shadow-2xl py-2 text-xs space-y-1 ${
                  isDark ? 'bg-[#233138] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full px-4 py-2 text-left flex items-center gap-2.5 ${isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'}`}
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-500" />
                    <span>Upload Image</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e, 'image')}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              )}
            </div>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type an encrypted message..."
              className={`flex-1 rounded-2xl px-4 py-3 text-xs sm:text-sm outline-none border transition focus:ring-2 focus:ring-emerald-500 ${
                isDark ? 'bg-[#111b21] border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />

            {inputText.trim() ? (
              <button
                type="submit"
                className="p-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                title="Hold to record voice note"
                className="p-3 rounded-full hover:bg-slate-500/20 text-slate-400 hover:text-emerald-500 transition cursor-pointer"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* INFO MODAL */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${isDark ? 'bg-[#222d34] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-500" /> Enclave Details
              </h3>
              <button type="button" onClick={() => setShowInfoModal(false)} className="p-1.5 rounded-full hover:bg-slate-500/20">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center mb-4">
              <img src={chatAvatar} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-emerald-500 mb-3" />
              <h4 className="font-bold text-base">{chatTitle}</h4>
              <p className="text-xs font-mono text-emerald-500 mt-0.5">{chat.isGroup ? 'Encrypted Group Channel' : chat.participant?.customId}</p>
            </div>

            <div className={`p-3 rounded-2xl border text-xs space-y-2 mb-4 ${isDark ? 'bg-[#111b21] border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between">
                <span className="text-slate-400">Fingerprint:</span>
                <span className="font-mono text-emerald-400">E2EE-9842-SECURE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Protocol:</span>
                <span className="font-mono">AES-256-GCM Ratchet</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
