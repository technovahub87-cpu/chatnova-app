
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2, Mic } from 'lucide-react';
import { fetchVoiceAudio } from '../services/voiceMessages';

interface VoiceMessagePlayerProps {
  audioUrl?: string;
  duration?: number;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration = 0
}) => {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remaining = safeSeconds % 60;

    return `${minutes}:${String(remaining).padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const togglePlayback = async () => {
    if (!audioUrl || loading) return;

    setError('');

    if (audioRef.current && playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    try {
      if (!audioRef.current) {
        setLoading(true);

        const blob = await fetchVoiceAudio(audioUrl);
        const objectUrl = URL.createObjectURL(blob);

        objectUrlRef.current = objectUrl;

        const audio = new Audio(objectUrl);
        audioRef.current = audio;

        audio.onended = () => setPlaying(false);
        audio.onerror = () => {
          setPlaying(false);
          setError('Audio playback failed.');
        };
      }

      await audioRef.current.play();
      setPlaying(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to play voice message.'
      );
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-1 min-w-[190px]">
      <button
        type="button"
        onClick={togglePlayback}
        disabled={!audioUrl || loading}
        title={playing ? 'Pause voice message' : 'Play voice message'}
        className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 h-5">
          {Array.from({ length: 22 }).map((_, index) => (
            <span
              key={index}
              className="flex-1 rounded-full bg-emerald-400/80"
              style={{
                height: `${5 + ((index * 7) % 13)}px`
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between text-[10px] opacity-75 mt-1 font-mono">
          <span className="flex items-center gap-1">
            <Mic className="w-3 h-3" />
            Voice message
          </span>
          <span>{formatTime(duration)}</span>
        </div>

        {error && (
          <p className="text-[10px] text-rose-400 mt-1">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
