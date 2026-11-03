
import React, { useCallback, useEffect, useState } from 'react';
import { Camera, CircleDot, Eye, Loader2, Trash2, X } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [text, setText] = useState('');
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

  const handlePost = async () => {
    if (!text.trim() || posting) return;

    setPosting(true);
    setError('');
    setNotice('');

    const response = await statusAPI.createTextStatus(text.trim());

    if (response.success) {
      setText('');
      setNotice('Status posted successfully.');
      await loadStatuses();
    } else {
      setError(response.message || 'Unable to post status.');
    }

    setPosting(false);
  };

  const openStatus = async (status: StatusRecord) => {
    setSelectedStatus(status);
    setViewers([]);

    if (isMine(status)) return;

    await statusAPI.markViewed(status._id);
    await loadStatuses();
  };

  const loadViewers = async (status: StatusRecord) => {
    setLoadingViewers(true);
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

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
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
            onClick={handlePost}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {posting ? 'Posting...' : 'Post Status'}
          </button>
        </div>
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
                        {status.text || status.caption || 'Media status'}
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
                        {status.text || status.caption || 'Media status'}
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
            <p className="mb-5 text-[10px] text-slate-400">
              {formatTime(selectedStatus.createdAt)}
            </p>

            <div className="flex min-h-48 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-950 to-slate-900 p-6 text-center">
              <p className="whitespace-pre-wrap text-xl">
                {selectedStatus.text || 'Media status'}
              </p>
            </div>

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

      {viewers.length > 0 && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#17212b] p-5 text-white">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">Status viewers</h3>
              <button
                type="button"
                onClick={() => setViewers([])}
                className="rounded-full p-2 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingViewers ? (
              <p className="text-xs text-slate-400">Loading viewers...</p>
            ) : (
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
            )}

            {!loadingViewers && viewers.length === 0 && (
              <p className="text-xs text-slate-400">No viewers yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
