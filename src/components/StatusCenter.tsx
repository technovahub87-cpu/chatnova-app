import React, { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  CircleDot,
  Eye,
  Loader2,
  Trash2,
  X,
  Image as ImageIcon,
  Video
} from 'lucide-react';
import { User } from '../types';
import { StatusRecord, statusAPI } from '../services/statusAPI';

interface StatusCenterProps {
  currentUser: User;
}

export const StatusCenter: React.FC<StatusCenterProps> = ({
  currentUser
}) => {
  const [statuses, setStatuses] = useState<StatusRecord[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<StatusRecord | null>(null);
  const [viewers, setViewers] = useState<StatusRecord['viewers']>([]);
  const [viewersOpen, setViewersOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);

  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaSrc, setMediaSrc] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isMine = (status: StatusRecord) =>
    status.user?.customId === currentUser.customId;

  const loadStatuses = useCallback(async () => {
    setLoading(true);
    setError('');

    const response = await statusAPI.getStatuses();

    if (response.success && response.data?.statuses) {
      setStatuses(response.data.statuses);
    } else {
      setError(response.message || 'Unable to load statuses.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    let objectUrl = '';

    const loadMedia = async () => {
      setMediaSrc('');

      if (
        !selectedStatus ||
        (selectedStatus.type !== 'image' && selectedStatus.type !== 'video')
      ) {
        setMediaLoading(false);
        return;
      }

      setMediaLoading(true);

      const response = await statusAPI.getStatusMedia(selectedStatus._id);

      if (response.success && response.blob) {
        objectUrl = URL.createObjectURL(response.blob);
        setMediaSrc(objectUrl);
      } else {
        setError(response.message || 'Unable to load this media.');
      }

      setMediaLoading(false);
    };

    loadMedia();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedStatus]);

  const handlePostText = async () => {
    if (!text.trim() || posting) return;

    setPosting(true);
    setError('');
    setNotice('');

    const response = await statusAPI.createTextStatus(text.trim());

    if (response.success) {
      setText('');
      setNotice('Text status posted successfully.');
      await loadStatuses();
    } else {
      setError(response.message || 'Unable to post status.');
    }

    setPosting(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError('');
    setNotice('');

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Please select JPG, PNG, WEBP, MP4 or WEBM file.');
      event.target.value = '';
      return;
    }

    const isImage = file.type.startsWith('image/');
    const maxSize = isImage ? 5 * 1024 * 1024 : 10 * 1024 * 1024;

    if (file.size > maxSize) {
      setError(
        isImage
          ? 'Image size must be 5 MB or less.'
          : 'Video size must be 10 MB or less.'
      );
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handlePostMedia = async () => {
    if (!selectedFile || posting) return;

    setPosting(true);
    setError('');
    setNotice('');

    const response = await statusAPI.createMediaStatus(
      selectedFile,
      caption.trim()
    );

    if (response.success) {
      setSelectedFile(null);
      setCaption('');
      setNotice('Photo/video status posted successfully.');

      const fileInput = document.getElementById(
        'chatnova-status-media'
      ) as HTMLInputElement | null;

      if (fileInput) fileInput.value = '';

      await loadStatuses();
    } else {
      setError(response.message || 'Unable to upload media status.');
    }

    setPosting(false);
  };

  const openStatus = async (status: StatusRecord) => {
    setSelectedStatus(status);
    setError('');

    if (!isMine(status)) {
      await statusAPI.markViewed(status._id);
      await loadStatuses();
    }
  };

  const loadViewers = async (status: StatusRecord) => {
    setViewersOpen(true);
    setLoadingViewers(true);
    setViewers([]);
    setError('');

    const response = await statusAPI.getViewers(status._id);

    if (response.success && response.data?.viewers) {
      setViewers(response.data.viewers);
    } else {
      setError(response.message || 'Unable to load viewers.');
    }

    setLoadingViewers(false);
  };

  const handleDelete = async (status: StatusRecord) => {
    if (!window.confirm('Delete this status permanently?')) return;

    const response = await statusAPI.deleteStatus(status._id);

    if (response.success) {
      setSelectedStatus(null);
      setNotice('Status deleted successfully.');
      await loadStatuses();
    } else {
      setError(response.message || 'Unable to delete status.');
    }
  };

  const formatTime = (date: string) =>
    new Date(date).toLocaleString([], {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

  const myStatuses = statuses.filter(isMine);
  const otherStatuses = statuses.filter(status => !isMine(status));

  const statusLabel = (status: StatusRecord) => {
    if (status.type === 'image') return '📷 Photo status';
    if (status.type === 'video') return '🎥 Video status';
    return status.text || 'Text status';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">

      {/* Create text status */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CircleDot className="w-5 h-5 text-emerald-500" />
          <h3 className="font-bold text-sm">Create a text status</h3>
        </div>

        <textarea
          value={text}
          onChange={event => setText(event.target.value.slice(0, 700))}
          maxLength={700}
          rows={3}
          placeholder="What's on your mind?"
          className="w-full rounded-xl border border-slate-500/20 bg-transparent p-3 text-sm outline-none focus:border-emerald-500 resize-none"
        />

        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-slate-400">
            {text.length}/700 · Expires after 24 hours
          </span>

          <button
            type="button"
            disabled={!text.trim() || posting}
            onClick={handlePostText}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {posting ? 'Posting...' : 'Post Status'}
          </button>
        </div>
      </div>

      {/* Create photo/video status */}
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-5 h-5 text-sky-500" />
          <h3 className="font-bold text-sm">Add photo or video</h3>
        </div>

        <label
          htmlFor="chatnova-status-media"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-500/30 p-6 text-center hover:border-sky-500"
        >
          {selectedFile?.type.startsWith('video/') ? (
            <Video className="h-8 w-8 text-sky-500" />
          ) : (
            <ImageIcon className="h-8 w-8 text-sky-500" />
          )}

          <span className="text-sm font-semibold">
            {selectedFile ? selectedFile.name : 'Choose photo or video'}
          </span>

          <span className="text-[10px] text-slate-400">
            Photos up to 5 MB · Videos up to 10 MB
          </span>
        </label>

        <input
          id="chatnova-status-media"
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile && (
          <div className="mt-3 space-y-3">
            <input
              type="text"
              value={caption}
              onChange={event => setCaption(event.target.value.slice(0, 300))}
              maxLength={300}
              placeholder="Write a caption (optional)"
              className="w-full rounded-xl border border-slate-500/20 bg-transparent p-3 text-sm outline-none focus:border-sky-500"
            />

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setCaption('');
                  const input = document.getElementById(
                    'chatnova-status-media'
                  ) as HTMLInputElement | null;
                  if (input) input.value = '';
                }}
                className="rounded-xl border border-slate-500/30 px-4 py-2 text-xs"
              >
                Remove
              </button>

              <button
                type="button"
                disabled={posting}
                onClick={handlePostMedia}
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                {posting ? 'Uploading...' : 'Post Photo/Video'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-500">
          {notice}
        </div>
      )}

      {/* Status lists */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading statuses...
        </div>
      ) : (
        <>
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              My Status
            </h3>

            {myStatuses.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-500/30 p-4 text-center text-xs text-slate-400">
                You haven't posted any status yet.
              </p>
            ) : (
              <div className="space-y-2">
                {myStatuses.map(status => (
                  <div
                    key={status._id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-500/20 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => openStatus(status)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">
                        {statusLabel(status)}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {formatTime(status.createdAt)}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => loadViewers(status)}
                      className="flex items-center gap-1 rounded-lg bg-slate-500/10 px-2 py-2 text-xs"
                      title="View viewers"
                    >
                      <Eye className="h-4 w-4 text-emerald-500" />
                      {status.viewers?.length || 0}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(status)}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                      title="Delete status"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Recent Updates
            </h3>

            {otherStatuses.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-500/30 p-4 text-center text-xs text-slate-400">
                No status updates from your contacts yet.
              </p>
            ) : (
              <div className="space-y-2">
                {otherStatuses.map(status => (
                  <button
                    type="button"
                    key={status._id}
                    onClick={() => openStatus(status)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-500/20 p-3 text-left hover:bg-slate-500/5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-500 bg-slate-500/10">
                      {status.user?.avatar ? (
                        <img
                          src={status.user.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Camera className="h-5 w-5 text-emerald-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {status.user?.displayName || status.user?.customId || 'User'}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {statusLabel(status)}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {formatTime(status.createdAt)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Status viewer */}
      {selectedStatus && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-[#17212b] p-5 text-white">
            <button
              type="button"
              onClick={() => setSelectedStatus(null)}
              className="absolute right-3 top-3 rounded-full p-2 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>

            <p className="mb-1 pr-8 text-sm font-bold">
              {selectedStatus.user?.displayName || 'Status'}
            </p>

            <p className="mb-4 text-[10px] text-slate-400">
              {formatTime(selectedStatus.createdAt)}
            </p>

            <div className="flex min-h-48 max-h-[65vh] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-950 to-slate-900 p-3">
              {selectedStatus.type === 'text' ? (
                <p className="whitespace-pre-wrap text-center text-xl">
                  {selectedStatus.text}
                </p>
              ) : mediaLoading ? (
                <div className="flex items-center gap-2 text-sm text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading media...
                </div>
              ) : mediaSrc ? (
                selectedStatus.type === 'image' ? (
                  <img
                    src={mediaSrc}
                    alt="Status"
                    className="max-h-[60vh] max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <video
                    src={mediaSrc}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[60vh] max-w-full rounded-lg"
                  />
                )
              ) : (
                <p className="text-sm text-slate-300">
                  Media could not be loaded.
                </p>
              )}
            </div>

            {selectedStatus.caption && (
              <p className="mt-3 whitespace-pre-wrap text-center text-sm">
                {selectedStatus.caption}
              </p>
            )}

            {isMine(selectedStatus) && (
              <button
                type="button"
                onClick={() => handleDelete(selectedStatus)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Delete Status
              </button>
            )}
          </div>
        </div>
      )}

      {/* Viewers modal */}
      {viewersOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#17212b] p-5 text-white">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">Status viewers</h3>
              <button
                type="button"
                onClick={() => setViewersOpen(false)}
                className="rounded-full p-2 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingViewers ? (
              <p className="text-xs text-slate-400">Loading viewers...</p>
            ) : viewers.length > 0 ? (
              viewers.map((viewer, index) => (
                <div
                  key={`${viewer.user?._id || index}`}
                  className="border-b border-white/10 py-3 text-sm"
                >
                  {viewer.user?.displayName || viewer.user?.customId || 'User'}
                  <p className="text-[10px] text-slate-400">
                    {formatTime(viewer.viewedAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">No viewers yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
