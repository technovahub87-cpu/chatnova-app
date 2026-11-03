
import React, { useEffect, useState } from 'react';
import { X, Search, Loader2, Image as ImageIcon } from 'lucide-react';

interface GifStickerPickerProps {
  isDark: boolean;
  onClose: () => void;
  onSelect: (url: string, type: 'gif' | 'sticker') => void;
}

interface TenorMedia {
  id: string;
  url: string;
  preview: string;
  description: string;
}

const TENOR_API_KEY =
  import.meta.env.VITE_TENOR_API_KEY || '';

const STICKER_EMOJIS = [
  '😍','🥰','😘','😂','🤣','😭','😎','🥳',
  '🤩','😡','😱','🤗','🙏','👏','👍','❤️',
  '🔥','💯','🎉','🌹','💖','🤝','😴','🤔'
];

export const GifStickerPicker: React.FC<GifStickerPickerProps> = ({
  isDark,
  onClose,
  onSelect
}) => {
  const [activeTab, setActiveTab] = useState<'gif' | 'sticker'>('gif');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<TenorMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab !== 'gif') return;

    if (!TENOR_API_KEY) {
      setResults([]);
      setError('GIF search ke liye Tenor API key configure karni hogi.');
      return;
    }

    const controller = new AbortController();

    const loadGifs = async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          key: TENOR_API_KEY,
          client_key: 'chatnova',
          q: search.trim() || 'trending',
          limit: '24',
          media_filter: 'tinygif,gif',
          contentfilter: 'medium'
        });

        const response = await fetch(
          `https://tenor.googleapis.com/v2/search?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('GIF search service unavailable.');
        }

        const data = await response.json();

        const items: TenorMedia[] = (data.results || [])
          .map((item: any) => {
            const formats = item.media_formats || {};
            const preview = formats.tinygif?.url || formats.gif?.url;
            const full = formats.gif?.url || preview;

            if (!full || !preview) return null;

            return {
              id: String(item.id),
              url: full,
              preview,
              description: String(item.content_description || 'GIF')
            };
          })
          .filter(Boolean);

        setResults(items);

        if (!items.length) {
          setError('No GIFs found. Try another search.');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;

        setResults([]);
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load GIFs.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const timer = window.setTimeout(loadGifs, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, activeTab]);

  const panelClass = isDark
    ? 'bg-[#233138] border-slate-700 text-white'
    : 'bg-white border-slate-200 text-slate-900';

  const buttonClass = isDark
    ? 'hover:bg-slate-700/70'
    : 'hover:bg-slate-100';

  return (
    <div className={`w-[min(92vw,360px)] rounded-2xl border shadow-2xl overflow-hidden ${panelClass}`}>
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-500/20">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-bold">GIFs & Stickers</h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-full ${buttonClass}`}
          aria-label="Close picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 p-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('gif')}
          className={`py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'gif'
              ? 'bg-emerald-600 text-white'
              : buttonClass
          }`}
        >
          GIF
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sticker')}
          className={`py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'sticker'
              ? 'bg-emerald-600 text-white'
              : buttonClass
          }`}
        >
          Stickers
        </button>
      </div>

      {activeTab === 'gif' ? (
        <>
          <div className="px-3 pb-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
              isDark ? 'bg-[#111b21]' : 'bg-slate-100'
            }`}>
              <Search className="w-4 h-4 opacity-60" />

              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search GIFs..."
                className="flex-1 bg-transparent outline-none text-xs"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="opacity-60"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="h-64 overflow-y-auto p-2">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-emerald-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs">Loading GIFs...</span>
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center text-center p-4">
                <p className="text-xs opacity-70">{error}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {results.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.url, 'gif')}
                    title={item.description}
                    className="rounded-lg overflow-hidden bg-black/10 aspect-square hover:ring-2 hover:ring-emerald-500"
                  >
                    <img
                      src={item.preview}
                      alt={item.description}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2 text-center border-t border-slate-500/20">
            <span className="text-[10px] opacity-50">GIFs powered by Tenor</span>
          </div>
        </>
      ) : (
        <div className="p-3">
          <p className="text-xs opacity-60 mb-3">
            Sticker pack selection will be connected in the next step.
          </p>

          <div className="grid grid-cols-4 gap-2">
            {STICKER_EMOJIS.map((emoji, index) => (
              <div
                key={`${emoji}-${index}`}
                className={`aspect-square rounded-xl flex items-center justify-center text-3xl ${
                  isDark ? 'bg-[#111b21]' : 'bg-slate-100'
                }`}
                title={emoji}
              >
                {emoji}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GifStickerPicker;
