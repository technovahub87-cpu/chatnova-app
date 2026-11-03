import React, { useEffect, useState } from 'react';
import { Loader2, PlayCircle, AlertCircle } from 'lucide-react';
import { fetchVideoMessage } from '../services/videoMessages';

interface VideoMessagePlayerProps {
  videoUrl?: string;
  name?: string;
}

export const VideoMessagePlayer: React.FC<VideoMessagePlayerProps> = ({
  videoUrl,
  name
}) => {
  const [videoObjectUrl, setVideoObjectUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;
    let objectUrl = '';

    const loadVideo = async () => {
      if (!videoUrl) {
        setError('Video URL is missing.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError('');

        const videoBlob = await fetchVideoMessage(videoUrl);

        if (!isActive) return;

        objectUrl = URL.createObjectURL(videoBlob);
        setVideoObjectUrl(objectUrl);
      } catch (err) {
        if (isActive) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load video.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadVideo();

    return () => {
      isActive = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [videoUrl]);

  if (isLoading) {
    return (
      <div className="w-full min-w-[220px] flex items-center justify-center gap-2 py-8 text-emerald-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs">Loading video...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-w-[220px] flex items-center gap-2 p-3 rounded-xl bg-black/20 text-rose-400">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span className="text-xs break-words">{error}</span>
      </div>
    );
  }

  return (
    <div className="w-full min-w-[220px] space-y-2">
      {name && (
        <p className="text-xs font-medium truncate">
          <PlayCircle className="w-4 h-4 inline mr-1 text-emerald-400" />
          {name}
        </p>
      )}

      {videoObjectUrl && (
        <video
          src={videoObjectUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-72 rounded-xl bg-black"
        >
          Your browser does not support video playback.
        </video>
      )}
    </div>
  );
};

export default VideoMessagePlayer;
