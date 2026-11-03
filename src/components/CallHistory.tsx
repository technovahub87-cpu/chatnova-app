
import React, { useEffect, useState } from 'react';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  RefreshCw
} from 'lucide-react';

import {
  getCallHistory,
  CallHistoryItem,
  CallHistoryType
} from '../services/callHistory';

interface CallHistoryProps {
  onCall: (type: 'voice' | 'video', conversationId: string) => void;
  isDark: boolean;
}

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const formatCallDate = (value: string) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const CallHistory: React.FC<CallHistoryProps> = ({
  onCall,
  isDark
}) => {
  const [filter, setFilter] = useState<CallHistoryType>('all');
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    setError('');

    const result = await getCallHistory(filter);

    if (result.success) {
      setCalls(result.calls);
    } else {
      setCalls([]);
      setError(result.message || 'Unable to load call history.');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, [filter]);

  const filters: {
    label: string;
    value: CallHistoryType;
  }[] = [
    { label: 'All', value: 'all' },
    { label: 'Voice', value: 'voice' },
    { label: 'Video', value: 'video' }
  ];

  const cardClass = isDark
    ? 'border-slate-700 bg-[#202c33]'
    : 'border-slate-200 bg-white';

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Call History</h2>
          <p className="text-xs text-slate-400 mt-1">
            Your voice and video calls
          </p>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          title="Refresh call history"
          className="p-2 rounded-full hover:bg-slate-500/10 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-4 pb-3 flex gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              filter === item.value
                ? 'bg-emerald-600 text-white'
                : isDark
                  ? 'bg-[#202c33] text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Loading call history...
          </div>
        ) : error ? (
          <div className="py-10 px-4 text-center">
            <p className="text-sm text-rose-500">{error}</p>
            <button
              type="button"
              onClick={loadHistory}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Try Again
            </button>
          </div>
        ) : calls.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              {filter === 'video' ? (
                <Video className="w-8 h-8 text-emerald-500" />
              ) : (
                <Phone className="w-8 h-8 text-emerald-500" />
              )}
            </div>

            <h3 className="font-semibold text-sm">No calls yet</h3>
            <p className="text-xs text-slate-400 mt-2">
              Your {filter === 'all' ? 'voice and video' : filter} call history will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => {
              const missed =
                call.status === 'missed' ||
                call.status === 'rejected' ||
                call.status === 'failed';

              const outgoing = call.direction === 'outgoing';
              const isVideo = call.type === 'video';

              const Icon = missed
                ? PhoneMissed
                : outgoing
                  ? PhoneOutgoing
                  : PhoneIncoming;

              const contactName =
                call.contact?.displayName || 'ChatNova Contact';

              const statusText =
                call.status === 'missed'
                  ? 'Missed'
                  : call.status === 'rejected'
                    ? 'Rejected'
                    : call.status === 'failed'
                      ? 'Failed'
                      : outgoing
                        ? 'Outgoing'
                        : 'Incoming';

              return (
                <div
                  key={call.id}
                  className={`rounded-xl border p-3 flex items-center gap-3 ${cardClass}`}
                >
                  <div className="w-11 h-11 shrink-0 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    {isVideo ? (
                      <Video className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Phone className="w-5 h-5 text-emerald-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {contactName}
                    </p>

                    <div className="flex items-center gap-1 mt-1">
                      <Icon
                        className={`w-3.5 h-3.5 ${
                          missed ? 'text-rose-500' : 'text-emerald-500'
                        }`}
                      />

                      <span
                        className={`text-xs ${
                          missed ? 'text-rose-500' : 'text-slate-400'
                        }`}
                      >
                        {statusText} · {isVideo ? 'Video' : 'Voice'}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-1">
                      {formatCallDate(call.startedAt)}
                      {call.status === 'ended' && call.duration > 0
                        ? ` · ${formatDuration(call.duration)}`
                        : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!call.conversationId}
                    onClick={() => {
                      if (call.conversationId) {
                        onCall(call.type, call.conversationId);
                      }
                    }}
                    title={`Call ${contactName} again`}
                    className="w-10 h-10 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-30"
                  >
                    {isVideo ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <Phone className="w-5 h-5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallHistory;
