
import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import { fetchAttachment } from '../services/attachmentMessages';
import { MediaAttachment } from '../types';

interface AttachmentMessageProps {
  media: MediaAttachment;
  type: 'image' | 'file' | 'document';
}

const formatSize = (value: string) => {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes <= 0) return 'File attachment';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const AttachmentMessage: React.FC<AttachmentMessageProps> = ({
  media,
  type
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    const loadAttachment = async () => {
      try {
        setLoading(true);
        setError('');

        const blob = await fetchAttachment(media.url);

        if (!active) return;

        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load attachment.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAttachment();

    return () => {
      active = false;

      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [media.url]);

  const downloadFile = () => {
    if (!objectUrl) return;

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = media.name || 'ChatNova-attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-emerald-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading attachment...
      </div>
    );
  }

  if (error || !objectUrl) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-rose-400">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error || 'Attachment unavailable.'}</span>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className="space-y-2 mb-1">
        <img
          src={objectUrl}
          alt={media.name || 'ChatNova image'}
          className="rounded-xl max-h-72 object-contain w-full cursor-pointer"
          onClick={() => window.open(objectUrl, '_blank', 'noopener,noreferrer')}
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] opacity-80 truncate">
            {media.name}
          </p>

          <button
            type="button"
            onClick={downloadFile}
            title="Download image"
            className="p-2 rounded-full hover:bg-black/10"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={downloadFile}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-black/20 hover:bg-black/30 transition text-left mb-1"
    >
      <FileText className="w-8 h-8 text-emerald-400 shrink-0" />

      <span className="min-w-0 flex-1">
        <span className="block font-bold text-xs truncate">
          {media.name || 'Attachment'}
        </span>

        <span className="block text-[10px] opacity-75">
          {formatSize(media.size)}
        </span>
      </span>

      <Download className="w-5 h-5 shrink-0 text-emerald-400" />
    </button>
  );
};

export default AttachmentMessage;
