import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Send, Paperclip, Mic, Lock, CheckCheck,
  MoreVertical, Phone, Video, Info, FileText, Image as ImageIcon,
  X, Square, Loader2, Film, Smile, Copy, Check
} from 'lucide-react';
import { markConversationMessagesRead } from '../services/readReceipts';
import { Chat, Message, User } from '../types';
import { wsService } from '../services/websocket';
import { useTheme } from '../context/ThemeContext';
import { uploadVoiceMessage } from '../services/voiceMessages';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { uploadVideoMessage } from '../services/videoMessages';
import { VideoMessagePlayer } from './VideoMessagePlayer';
import { uploadAttachment } from '../services/attachmentMessages';
import { AttachmentMessage } from './AttachmentMessage';
import { GifStickerPicker } from './GifStickerPicker';
import { sendGifStickerMessage } from '../services/gifStickerMessages';
import { performMessageAction } from '../services/messageActions';

interface ChatRoomProps {
  chat: Chat;
  currentUser: User;
  messages: Message[];
  onSendMessage: (msgData: Partial<Message>) => void;
  onBack: () => void;
  onUpdateChat: (updatedChat: Chat) => void;
  onStartCall: (type: 'voice' | 'video') => void;
    onLeaveGroup: (conversationId: string) => void;
  availableChats?: Chat[];
}

const EMOJIS = [
  '😀','😃','😄','😁','😆','😅','😂','🤣',
  '😊','😇','🙂','🙃','😉','😍','🥰','😘',
  '😗','😋','😛','😜','🤪','😎','🤩','🥳',
  '😏','😔','😢','😭','😡','🤬','🤔','🤗',
  '🤫','🤭','🫡','🤝','🙏','👏','👍','👎',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍',
  '💔','💕','💞','💖','💗','💓','💯','🔥',
  '✨','⭐','🌟','🎉','🎊','🎁','🎂','🏆',
  '⚽','🏏','🎮','🎵','🎶','🚀','🌈','☀️',
  '🌹','🌻','🌺','🍕','🍔','🍟','🍫','☕'
];

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

const ALLOWED_DOCUMENT_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'ppt', 'pptx', 'txt', 'csv', 'zip',
  'rar', 'rtf', 'odt', 'ods'
];

const isEmojiOnly = (value: string): boolean => {
  const content = value.trim();
  if (!content) return false;

  return /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F|\u200D|\u20E3|\s)+$/u.test(content);
};

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chat, currentUser, messages, onSendMessage,
   onBack, onUpdateChat, onStartCall, onLeaveGroup, availableChats = []
}) => {
  const { isDark } = useTheme();

  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifStickerPicker, setShowGifStickerPicker] = useState(false);
  const [isSendingGifSticker, setIsSendingGifSticker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
const [forwardSearch, setForwardSearch] = useState('');
const [isForwarding, setIsForwarding] = useState(false);

  const recordingTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const recordingDurationRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!chat?.id) return;
    wsService.joinConversation(chat.id);
    return () => wsService.leaveConversation(chat.id);
  }, [chat?.id]);
useEffect(() => {
  if (!chat?.id || chat.isGroup) return;

  markConversationMessagesRead(chat.id);
}, [chat?.id, messages.length]);
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      cancelRecordingRef.current = true;

      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleCopyMessage = async (messageId: string, content: string) => {
    if (!content?.trim()) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!successful) {
          throw new Error('Clipboard copy was not successful.');
        }
      }

      setCopiedMessageId(messageId);

      window.setTimeout(() => {
        setCopiedMessageId(previous =>
          previous === messageId ? null : previous
        );
      }, 1800);
    } catch {
      window.alert('Copy nahi ho paya. Browser clipboard permission check karein.');
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText(previous => previous + emoji);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const content = inputText.trim();
    if (!content) return;

    onSendMessage({
      content,
      type: 'text',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    });

    setInputText('');
    setShowEmojiPicker(false);
        setShowGifStickerPicker(false);
  };

  const handleGifStickerSelect = async (
    url: string,
    type: 'gif' | 'sticker'
  ) => {
    if (isSendingGifSticker) return;

    setIsSendingGifSticker(true);

    try {
      await sendGifStickerMessage(chat.id, url, type);
      setShowGifStickerPicker(false);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'GIF or sticker could not be sent.'
      );
    } finally {
      setIsSendingGifSticker(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'document'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);

    if (file.size === 0) {
      window.alert('Selected file is empty.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      window.alert('Attachment must be smaller than 25 MB.');
      e.target.value = '';
      return;
    }

    if (type === 'image' && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      window.alert('Please select JPG, PNG, GIF or WEBP image.');
      e.target.value = '';
      return;
    }

    if (type === 'document') {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';

      if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension)) {
        window.alert(
          'Supported files: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP and RTF.'
        );
        e.target.value = '';
        return;
      }
    }

    if (isUploadingAttachment) {
      e.target.value = '';
      return;
    }

    setIsUploadingAttachment(true);

    try {
      await uploadAttachment(chat.id, file);
      window.alert(
        type === 'image'
          ? 'Image sent successfully.'
          : 'File sent successfully.'
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Attachment could not be sent. Please try again.'
      );
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleVideoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);

    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

    if (!allowedTypes.includes(file.type)) {
      window.alert('Please select an MP4, WebM or MOV video.');
      e.target.value = '';
      return;
    }

    if (file.size === 0) {
      window.alert('The selected video is empty.');
      e.target.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      window.alert('Video must be smaller than 50 MB.');
      e.target.value = '';
      return;
    }

    if (isUploadingVideo) {
      e.target.value = '';
      return;
    }

    setIsUploadingVideo(true);

    try {
      await uploadVideoMessage(chat.id, file);
      window.alert('Video sent successfully.');
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Video could not be sent. Please try again.'
      );
    } finally {
      setIsUploadingVideo(false);
      e.target.value = '';
    }
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const releaseMicrophone = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  };

  const startRecording = async () => {
    if (
      isRecording ||
      isUploadingVoice ||
      isUploadingVideo ||
      isUploadingAttachment ||
      isSendingGifSticker
    ) return;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Microphone recording requires HTTPS and a supported browser.'
        );
      }

      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Your browser does not support voice recording.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      recordingDurationRef.current = 0;
      setRecordingDuration(0);

      let mimeType = '';

      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];

      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopRecordingTimer();
        releaseMicrophone();
        setIsRecording(false);
        window.alert('Recording failed. Please try again.');
      };

      recorder.onstop = async () => {
        stopRecordingTimer();

        const cancelled = cancelRecordingRef.current;
        const chunks = [...audioChunksRef.current];
        const duration = recordingDurationRef.current;
        const recordedType = recorder.mimeType || 'audio/webm';

        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        releaseMicrophone();
        setIsRecording(false);

        if (cancelled) {
          setRecordingDuration(0);
          return;
        }

        const audioBlob = new Blob(chunks, { type: recordedType });

        if (duration < 1 || audioBlob.size === 0) {
          setRecordingDuration(0);
          window.alert('Please record at least one second of audio.');
          return;
        }

        if (audioBlob.size > 10 * 1024 * 1024) {
          setRecordingDuration(0);
          window.alert('Voice message must be smaller than 10 MB.');
          return;
        }

        setIsUploadingVoice(true);

        try {
          await uploadVoiceMessage(chat.id, audioBlob, duration);
          setRecordingDuration(0);
        } catch (error) {
          window.alert(
            error instanceof Error
              ? error.message
              : 'Voice message could not be sent.'
          );
        } finally {
          setIsUploadingVoice(false);
        }
      };

      recorder.start(250);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(recordingDurationRef.current);

        if (recordingDurationRef.current >= 300) {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 1000);

    } catch (error) {
      releaseMicrophone();

      window.alert(
        error instanceof Error
          ? error.message
          : 'Unable to access microphone. Please allow microphone permission.'
      );
    }
  };

  const stopAndSendRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder?.state === 'recording') {
      cancelRecordingRef.current = false;
      recorder.stop();
    }
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;
    stopRecordingTimer();

    const recorder = mediaRecorderRef.current;

    if (recorder?.state === 'recording') {
      recorder.stop();
    } else {
      releaseMicrophone();
      setIsRecording(false);
      setRecordingDuration(0);
    }
  };
  
  const handleMessageAction = async (msg: Message, action: 'reply' | 'forward' | 'delete_for_me' | 'delete_for_everyone') => {
    const messageId = String(msg.id || '');
    if (!messageId) { window.alert('Message ID nahi mila. Please refresh karke dobara try karein.'); return; }
    try {
      if (action === 'reply') {
        const replyText = window.prompt('Apna reply likhein:');
        if (!replyText?.trim()) return;
        await performMessageAction(chat.id, messageId, { action: 'reply', content: replyText.trim() });
        return;
      }
      if (action === 'forward') {
  if (!availableChats.some(item => item.id !== chat.id)) {
    window.alert('Forward karne ke liye koi doosri chat available nahi hai.');
    return;
  }

  setForwardSearch('');
  setForwardMessage(msg);
  return;
}
      if (action === 'delete_for_me') {
        if (!window.confirm('Kya aap is message ko sirf apni chat se delete karna chahte hain?')) return;
      } else if (!window.confirm('Kya aap is message ko sabhi ke liye delete karna chahte hain?')) return;
      await performMessageAction(chat.id, messageId, { action });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Message action complete nahi ho paya.');
    }
  };
const handleForwardToChat = async (target: Chat) => {
  if (!forwardMessage || isForwarding) return;

  const messageId = String(forwardMessage.id || '');

  if (!messageId) {
    window.alert('Message ID nahi mila. Please refresh karein.');
    return;
  }

  setIsForwarding(true);

  try {
    await performMessageAction(chat.id, messageId, {
      action: 'forward',
      targetConversationId: target.id
    });

    setForwardMessage(null);
    setForwardSearch('');

    window.alert('Message successfully forward ho gaya.');
  } catch (error) {
    window.alert(
      error instanceof Error
        ? error.message
        : 'Message forward nahi ho paya.'
    );
  } finally {
    setIsForwarding(false);
  }
};
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${String(remaining).padStart(2, '0')}`;
  };
  const formatLastSeen = (value?: string) => {
  if (!value) return 'Recently';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find(part => part.type === type)?.value || '';

  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')} ${get('dayPeriod').toLowerCase()}`;
};

  const chatTitle = chat.isGroup
    ? chat.groupName
    : (chat.participant?.displayName || 'ChatNova User');

  const chatAvatar = chat.isGroup
    ? (
        chat.groupIcon ||
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80'
      )
    : (
        chat.participant?.avatar ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
      );

  const chatStatusText = chat.isGroup
    ? `${chat.groupMembers?.length || 0} members in conversation`
    : (
        chat.participant?.status === 'online'
          ? 'Online • ChatNova'
          : 'ChatNova Conversation'
      );

  return (
    <div className={`flex-1 h-full flex flex-col relative ${
      isDark ? 'bg-[#0b141a]' : 'bg-[#efeae2]'
    }`}>
      <div className={`px-4 py-2.5 flex items-center justify-between border-b select-none z-20 ${
        isDark
          ? 'bg-[#202c33] border-slate-800 text-white'
          : 'bg-[#f0f2f5] border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="md:hidden p-2 rounded-full hover:bg-slate-500/20 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setShowInfoModal(true)}
          >
            <div className="relative">
              <img
                src={chatAvatar}
                alt={chatTitle}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-emerald-500/40"
              />

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
  {chat.isGroup
    ? `${chat.groupMembers?.length || 0} members in conversation`
    : chat.participant?.status === 'online'
      ? 'Online'
      : `Last seen: ${formatLastSeen(chat.participant?.lastSeen)}`}
</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 relative">
          <button
            type="button"
            onClick={() => onStartCall('voice')}
            title="Voice call"
            className="p-2.5 rounded-full hover:bg-slate-500/20 transition text-emerald-500 cursor-pointer"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onStartCall('video')}
            title="Video call"
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
              isDark
                ? 'bg-[#233138] border-slate-700 text-slate-100'
                : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setShowInfoModal(true);
                  setShowChatMenu(false);
                }}
                className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 ${
                  isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'
                }`}
              >
                <Info className="w-4 h-4 text-emerald-500" />
                <span>Conversation Info</span>
              </button>
            </div>
          )}
        </div>
      </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        <div className="flex justify-center mb-4">
          <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono flex items-center gap-2 max-w-md text-center shadow-sm ${
            isDark
              ? 'bg-[#182229] border-emerald-500/20 text-emerald-400'
              : 'bg-[#fff5c0] border-amber-200 text-slate-800'
          }`}>
            <Lock className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>
              ChatNova secure conversation. Messages are sent through the authenticated backend.
            </span>
          </div>
        </div>

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUser.id;
          const emojiOnlyMessage =
            msg.type === 'text' && isEmojiOnly(msg.content || '');
          const messageKey = String(msg.id || idx);
          const canCopy = msg.type === 'text' && Boolean(msg.content?.trim());
          const isCopied = copiedMessageId === messageKey;

          // Custom Sticker Studio images are stored as protected attachments.
          // GIPHY stickers are external HTTPS URLs and can load normally.
          const isUploadedCustomSticker =
            msg.type === 'sticker' &&
            Boolean(msg.media?.url) &&
            (
              msg.media.url.includes('/attachment') ||
              msg.media.name?.startsWith('chatnova-sticker-')
            );

          return (
            <div
              key={msg.id || idx}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] sm:max-w-[65%] rounded-2xl ${
                emojiOnlyMessage ? 'px-2 py-1' : 'px-3.5 py-2'
              } shadow-sm relative ${
                emojiOnlyMessage ? '' : 'text-xs sm:text-sm'
              } ${
                isMe
                  ? isDark
                    ? 'bg-[#005c4b] text-white rounded-tr-none'
                    : 'bg-[#d9fdd3] text-slate-900 rounded-tr-none'
                  : isDark
                    ? 'bg-[#202c33] text-slate-100 rounded-tl-none'
                    : 'bg-white text-slate-900 rounded-tl-none'
              }`}>
                {msg.forwardedFrom && <p className="text-[10px] italic opacity-70 mb-1">↪ Forwarded</p>}
                {msg.replyTo && <div className={`mb-2 px-2 py-1.5 rounded-lg border-l-2 border-emerald-500 text-[10px] ${isDark ? 'bg-black/20' : 'bg-black/5'}`}><p className="font-bold text-emerald-500">Replying to {msg.replyTo.senderName || 'message'}</p><p className="opacity-80 line-clamp-2">{msg.replyTo.content || 'Attachment'}</p></div>}
                {msg.deletedForEveryone && <p className="italic opacity-60">This message was deleted.</p>}
                {!msg.deletedForEveryone && chat.isGroup && !isMe && (
                  <p className="text-[10px] font-bold text-teal-400 mb-0.5">
                    {msg.senderName}
                  </p>
                )}

                {!msg.deletedForEveryone && msg.type === 'text' && (
                  <p className={`break-words ${
                    emojiOnlyMessage
                      ? 'text-5xl sm:text-6xl leading-tight py-1'
                      : 'leading-relaxed'
                  }`}>
                    {msg.content}
                  </p>
                )}

                {!msg.deletedForEveryone && msg.type === 'image' && msg.media && (
                  <AttachmentMessage media={msg.media} type="image" />
                )}

                {!msg.deletedForEveryone && msg.type === 'video' && msg.media && (
                  <div className="space-y-1.5 mb-1">
                    <VideoMessagePlayer
                      videoUrl={msg.media.url}
                      name={msg.media.name}
                    />
                    <p className="text-[10px] opacity-80 flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {msg.media.name}
                    </p>
                  </div>
                )}

                {!msg.deletedForEveryone && (msg.type === 'file' || msg.type === 'document') && msg.media && (
                  <AttachmentMessage media={msg.media} type="file" />
                )}

                {!msg.deletedForEveryone && msg.type === 'gif' && msg.media?.url && (
                  <div className="w-56 max-w-full overflow-hidden">
                    <img
                      src={msg.media.url}
                      alt="GIF message"
                      className="w-full h-full object-contain rounded-lg"
                      loading="lazy"
                    />
                  </div>
                )}

                {!msg.deletedForEveryone && msg.type === 'sticker' && msg.media?.url && (
                  isUploadedCustomSticker ? (
                    <div className="w-36 h-36 overflow-hidden">
                      <AttachmentMessage
                        media={msg.media}
                        type="image"
                      />
                    </div>
                  ) : (
                    <div className="w-36 h-36 overflow-hidden">
                      <img
                        src={msg.media.url}
                        alt="Sticker"
                        className="w-full h-full object-contain max-h-36"
                        loading="lazy"
                      />
                    </div>
                  )
                )}

                {!msg.deletedForEveryone && msg.type === 'voice' && (
                  <VoiceMessagePlayer
                    audioUrl={msg.voice?.audioUrl}
                    duration={Number(msg.voice?.duration || 0)}
                  />
                )}

                {!msg.deletedForEveryone && <div className="flex flex-wrap items-center justify-end gap-1 mt-2 pt-1 border-t border-black/10 text-[9px]">
                  <button type="button" onClick={() => handleMessageAction(msg, 'reply')} className="px-2 py-1 rounded-md hover:bg-black/10">↩ Reply</button>
                  <button type="button" onClick={() => handleMessageAction(msg, 'forward')} className="px-2 py-1 rounded-md hover:bg-black/10">➦ Forward</button>
                  <button type="button" onClick={() => handleMessageAction(msg, 'delete_for_me')} className="px-2 py-1 rounded-md hover:bg-black/10">Delete for me</button>
                  {isMe && <button type="button" onClick={() => handleMessageAction(msg, 'delete_for_everyone')} className="px-2 py-1 rounded-md text-rose-500 hover:bg-rose-500/10">Delete for everyone</button>}
                </div>}
                <div className="flex items-center justify-end gap-2 mt-1 text-[9px] font-mono opacity-75">
                  {canCopy && (
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(messageKey, msg.content || '')}
                      title={isCopied ? 'Copied' : 'Copy message'}
                      aria-label={isCopied ? 'Message copied' : 'Copy message'}
                      className="p-1 rounded-md hover:bg-black/10 transition flex items-center gap-1"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <span>{msg.timestamp}</span>

                         {isMe && (
                    <span className="inline-flex items-center">
                      {msg.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </span>
                  )}                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
            <div className={`p-3 border-relative ${
        isDark
          ? 'bg-[#202c33] border-slate-800'
          : 'bg-[#f0f2f5] border-slate-200'
      }`}>
        {isRecording ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/30">
            <div className="flex items-center gap-3 text-rose-500 font-bold text-xs animate-pulse">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span>Recording {formatTime(recordingDuration)}</span>
            </div>

            <button
              type="button"
              onClick={cancelRecording}
              className="px-3 py-2 rounded-xl bg-slate-700 text-white text-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={stopAndSendRecording}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2"
            >
              <Square className="w-3 h-3" />
              Send
            </button>
          </div>
        ) : isUploadingVoice || isUploadingVideo || isUploadingAttachment || isSendingGifSticker ? (
          <div className="flex items-center justify-center gap-2 py-3 text-emerald-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {isUploadingVoice
              ? 'Sending voice message...'
              : isUploadingVideo
                ? 'Uploading video...'
                : isUploadingAttachment
                  ? 'Uploading attachment...'
                  : 'Sending GIF or sticker...'}
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2 relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowGifStickerPicker(false);
                  setShowAttachMenu(false);
                }}
                title="Choose emoji"
                className={`p-2.5 rounded-full hover:bg-slate-500/20 transition cursor-pointer ${
                  showEmojiPicker ? 'text-emerald-500' : 'text-slate-400'
                }`}
              >
                <Smile className="w-5 h-5" />
              </button>

              {showEmojiPicker && (
                <div className={`absolute bottom-14 left-0 z-50 w-[280px] sm:w-[320px] rounded-2xl border shadow-2xl p-3 ${
                  isDark
                    ? 'bg-[#233138] border-slate-700 text-white'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold">Choose an Emoji</p>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className="p-1 rounded-full hover:bg-slate-500/20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                    {EMOJIS.map((emoji, index) => (
                      <button
                        key={`${emoji}-${index}`}
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        className="h-8 w-8 rounded-lg text-xl hover:bg-emerald-500/20 transition flex items-center justify-center"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowGifStickerPicker(!showGifStickerPicker);
                setShowEmojiPicker(false);
                setShowAttachMenu(false);
              }}
              title="GIFs and Stickers"
              className={`p-2.5 rounded-full hover:bg-slate-500/20 transition cursor-pointer ${
                showGifStickerPicker ? 'text-emerald-500' : 'text-slate-400'
              }`}
            >
              <span className="text-[10px] font-black border border-current rounded px-1.5 py-1">
                GIF
              </span>
            </button>

            {showGifStickerPicker && (
              <div className="absolute bottom-16 left-0 z-50">
                <GifStickerPicker
                  isDark={isDark}
                  onClose={() => setShowGifStickerPicker(false)}
                  onSelect={handleGifStickerSelect}
                />
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(!showAttachMenu);
                  setShowEmojiPicker(false);
                  setShowGifStickerPicker(false);
                }}
                title="Attach"
                className="p-2.5 rounded-full hover:bg-slate-500/20 text-slate-400 hover:text-emerald-500 transition cursor-pointer"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {showAttachMenu && (
                <div className={`absolute bottom-12 left-0 z-40 w-52 rounded-2xl border shadow-2xl py-2 text-xs space-y-1 ${
                  isDark
                    ? 'bg-[#233138] border-slate-700 text-slate-100'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 ${
                      isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-500" />
                    <span>Upload Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 ${
                      isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'
                    }`}
                  >
                    <Film className="w-4 h-4 text-sky-500" />
                    <span>Upload Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => documentInputRef.current?.click()}
                    className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 ${
                      isDark ? 'hover:bg-slate-700/60' : 'hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>Upload File</span>
                  </button>

                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={(e) => handleFileUpload(e, 'image')}
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                  />
                                    <input
                    type="file"
                    ref={videoInputRef}
                    onChange={handleVideoUpload}
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                  />

                  <input
                    type="file"
                    ref={documentInputRef}
                    onChange={(e) => handleFileUpload(e, 'document')}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.rtf,.odt,.ods"
                    className="hidden"
                  />
                </div>
              )}
            </div>

            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);

                if (chat?.id) {
                  wsService.sendTyping(chat.id, Boolean(e.target.value.trim()));
                }
              }}
              placeholder="Type a message..."
              className={`flex-1 rounded-2xl px-4 py-3 text-xs sm:text-sm outline-none border transition focus:ring-2 focus:ring-emerald-500 ${
                isDark
                  ? 'bg-[#111b21] border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
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
                title="Record voice message"
                className="p-3 rounded-full hover:bg-slate-500/20 text-slate-400 hover:text-emerald-500 transition cursor-pointer"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        )}
      </div>
{forwardMessage && (
  <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
    <div className={`w-full max-w-md max-h-[85vh] rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
      isDark
        ? 'bg-[#202c33] border-slate-700 text-white'
        : 'bg-white border-slate-200 text-slate-900'
    }`}>
      <div className="px-5 py-4 border-b border-slate-500/20 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base">Forward message</h3>
          <p className="text-xs text-slate-400 mt-1">
            Select a chat or group
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setForwardMessage(null);
            setForwardSearch('');
          }}
          className="p-2 rounded-full hover:bg-slate-500/20"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-500/20">
        <input
          type="search"
          value={forwardSearch}
          onChange={e => setForwardSearch(e.target.value)}
          placeholder="Search chats and groups..."
          className={`w-full rounded-xl px-4 py-3 text-sm outline-none border focus:ring-2 focus:ring-emerald-500 ${
            isDark
              ? 'bg-[#111b21] border-slate-700 text-white'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        />
      </div>

      <div className="overflow-y-auto p-2">
        {availableChats
          .filter(item => item.id !== chat.id)
          .filter(item => {
            const title = item.isGroup
              ? (item.groupName || 'Group')
              : (item.participant?.displayName || 'ChatNova User');

            const search = forwardSearch.trim().toLowerCase();

            return (
              title.toLowerCase().includes(search) ||
              (item.participant?.customId || '').toLowerCase().includes(search)
            );
          })
          .map(item => {
            const title = item.isGroup
              ? (item.groupName || 'Group')
              : (item.participant?.displayName || 'ChatNova User');

            const avatar = item.isGroup
              ? item.groupIcon
              : item.participant?.avatar;

            return (
              <button
                type="button"
                key={item.id}
                disabled={isForwarding}
                onClick={() => handleForwardToChat(item)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition ${
                  isDark ? 'hover:bg-slate-700/70' : 'hover:bg-slate-100'
                }`}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="w-11 h-11 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    {title.charAt(0).toUpperCase()}
                  </div>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">
                    {title}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {item.isGroup
                      ? `${item.groupMembers?.length || 0} members · Group`
                      : (item.participant?.customId || 'Personal chat')}
                  </span>
                </span>

                {isForwarding ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                ) : (
                  <span className="text-xs text-emerald-500 font-semibold">
                    Send
                  </span>
                )}
              </button>
            );
          })}

        {availableChats.filter(item =>
          item.id !== chat.id &&
          (
            (item.isGroup ? (item.groupName || 'Group') : (item.participant?.displayName || 'ChatNova User'))
              .toLowerCase().includes(forwardSearch.trim().toLowerCase()) ||
            (item.participant?.customId || '').toLowerCase().includes(forwardSearch.trim().toLowerCase())
          )
        ).length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">
            No chats or groups found.
          </p>
        )}
      </div>

      <div className="px-5 py-3 border-t border-slate-500/20 text-xs text-slate-400">
        Select the destination where you want to forward this message.
      </div>
    </div>
  </div>
)}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${
            isDark
              ? 'bg-[#222d34] border-slate-700 text-white'
              : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-500" />
                Conversation Details
              </h3>
             
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-500/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center mb-4">
              <img
                src={chatAvatar}
                alt=""
                className="w-20 h-20 rounded-full object-cover ring-2 ring-emerald-500 mb-3"
              />

              <h4 className="font-bold text-base">{chatTitle}</h4>

              <div className="flex items-center gap-2 text-xs mt-0.5">
  {chat.isGroup ? (
    <span className="font-mono text-emerald-500">
      Group Conversation
    </span>
  ) : (
    <>
      <span className="font-mono text-emerald-500">
        {chat.participant?.customId}
      </span>

      {chat.participant?.status === 'online' ? (
        <span className="inline-flex items-center gap-1 text-emerald-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Online
        </span>
      ) : (
        <span className="text-gray-400">
          Last seen: {formatLastSeen(chat.participant?.lastSeen)}
        </span>
      )}
    </>
  )}
</div>
</div>
            <div className={`p-3 rounded-2xl border text-xs space-y-2 mb-4 ${
              isDark
                ? 'bg-[#111b21] border-slate-700/60'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between">
                <span className="text-slate-400">Conversation ID:</span>
                <span className="font-mono text-emerald-400 break-all">{chat.id}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Members:</span>
                <span className="font-mono">
                  {chat.isGroup ? chat.groupMembers?.length || 0 : 2}
                </span>
              </div>
            </div>
                        {chat.isGroup && (
              <button
                type="button"
                onClick={() => {
                  setShowInfoModal(false);
                  onLeaveGroup(chat.id);
                }}
                className="w-full py-2.5 mb-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Leave Group
              </button>
            )}
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

export default ChatRoom;
