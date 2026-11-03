
import React, { useEffect, useState } from 'react';
import {
  X,
  Search,
  Loader2,
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';
import StickerStudio from './StickerStudio';

interface GifStickerPickerProps {
  isDark: boolean;
  onClose: () => void;
  onSelect: (
    url: string,
    type: 'gif' | 'sticker'
  ) => void | Promise<void>;
}

interface GiphyMedia {
  id: string;
  url: string;
  preview: string;
  description: string;
}

interface GiphyImageSet {
  original?: {
    url?: string;
    webp?: string;
  };
  fixed_width?: {
    url?: string;
    webp?: string;
  };
  fixed_width_small?: {
    url?: string;
    webp?: string;
  };
  downsized?: {
    url?: string;
  };
}

interface GiphyItem {
  id: string;
  title?: string;
  images?: GiphyImageSet;
}

const GIPHY_API_KEY =
  import.meta.env.VITE_GIPHY_API_KEY || '';

const GIPHY_BASE_URL =
  'https://api.giphy.com/v1';

export const GifStickerPicker: React.FC<GifStickerPickerProps> = ({
  isDark,
  onClose,
  onSelect
}) => {
  const [activeTab, setActiveTab] = useState<'gif' | 'sticker'>('gif');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<GiphyMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showStudio, setShowStudio] = useState(false);

  useEffect(() => {
    if (!GIPHY_API_KEY) {
      setResults([]);
      setError('GIPHY API Key configure nahi hui hai.');
      return;
    }

    const controller = new AbortController();

    const loadMedia = async () => {
      setLoading(true);
      setError('');

      try {
        const trimmedSearch = search.trim();

        const endpoint = activeTab === 'gif'
          ? trimmedSearch
            ? `${GIPHY_BASE_URL}/gifs/search`
            : `${GIPHY_BASE_URL}/gifs/trending`
          : trimmedSearch
            ? `${GIPHY_BASE_URL}/stickers/search`
            : `${GIPHY_BASE_URL}/stickers/trending`;

        const params = new URLSearchParams({
          api_key: GIPHY_API_KEY,
          limit: '24',
          rating: 'pg',
          lang: 'en',
          bundle: 'messaging_non_clips'
        });

        if (trimmedSearch) {
          params.set('q', trimmedSearch);
        }

        const response = await fetch(
          `${endpoint}?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error(
              'GIPHY API Key invalid hai ya access allow nahi hai.'
            );
          }

          if (response.status === 429) {
            throw new Error(
              'GIPHY search limit poori ho gayi. Thodi der baad try karein.'
            );
          }

          throw new Error('GIPHY service abhi available nahi hai.');
        }

        const data = await response.json();

        if (data.meta?.status !== 200 || !Array.isArray(data.data)) {
          throw new Error('GIPHY se valid results nahi mile.');
        }

        const items: GiphyMedia[] = data.data
          .map((item: GiphyItem) => {
            const images = item.images || {};

            const original =
              activeTab === 'sticker'
                ? images.original?.webp || images.original?.url
                : images.original?.url;

            const preview =
              images.fixed_width_small?.webp ||
              images.fixed_width_small?.url ||
              images.fixed_width?.webp ||
              images.fixed_width?.url ||
              images.downsized?.url ||
              original;

            if (!original || !preview) return null;

            return {
              id: String(item.id),
              url: original,
              preview,
              description: String(
                item.title ||
                (activeTab === 'gif' ? 'GIF' : 'Sticker')
              )
            };
          })
          .filter(
            (item: GiphyMedia | null): item is GiphyMedia =>
              item !== null
          );

        setResults(items);

        if (!items.length) {
          setError('Koi result nahi mila. Dusra search try karein.');
        }
      } catch (err) {
        if (
          err instanceof Error &&
          err.name === 'AbortError'
        ) {
          return;
        }

        setResults([]);
        setError(
          err instanceof Error
            ? err.message
            : 'Media load nahi ho paya.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const timer = window.setTimeout(loadMedia, 350);

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

  const handleSelect = (item: GiphyMedia) => {
    if (selectedId) return;

    setSelectedId(item.id);
    void onSelect(item.url, activeTab);
  };

  const handleSendCustomSticker = async (file: File) => {
    const url = URL.createObjectURL(file);

    try {
      await onSelect(url, 'sticker');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <div
        className={`w-[min(92vw,380px)] rounded-2xl border shadow-2xl overflow-hidden ${panelClass}`}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-500/20">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold">
              GIFs & Stickers
            </h3>
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

        <div className="grid grid-cols-3 p-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setActiveTab('gif');
            }}
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
            onClick={() => {
              setSelectedId(null);
              setActiveTab('sticker');
            }}
            className={`py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'sticker'
                ? 'bg-emerald-600 text-white'
                : buttonClass
            }`}
          >
            Stickers
          </button>

          <button
            type="button"
            onClick={() => setShowStudio(true)}
            className="py-2 rounded-xl text-xs font-bold transition bg-gradient-to-r from-pink-600 to-violet-600 text-white flex items-center justify-center gap-1 hover:brightness-110"
          >
            <Sparkles size={13} />
            Create
          </button>
        </div>

        <div className="px-3 pb-2">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
              isDark ? 'bg-[#111b21]' : 'bg-slate-100'
            }`}
          >
            <Search className="w-4 h-4 opacity-60" />

            <input
              type="search"
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setSelectedId(null);
              }}
              placeholder={
                activeTab === 'gif'
                  ? 'Search GIFs...'
                  : 'Search Stickers...'
              }
              className="flex-1 bg-transparent outline-none text-xs"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="opacity-60"
                aria-label="Clear search"
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
              <span className="text-xs">
                Loading {activeTab === 'gif' ? 'GIFs' : 'Stickers'}...
              </span>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-center p-4">
              <p className="text-xs opacity-70">
                {error}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {results.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  disabled={Boolean(selectedId)}
                  title={item.description}
                  className={`rounded-lg overflow-hidden bg-black/10 aspect-square transition ${
                    activeTab === 'sticker' ? 'p-2' : ''
                  } ${
                    selectedId === item.id
                      ? 'ring-2 ring-emerald-500'
                      : 'hover:ring-2 hover:ring-emerald-500'
                  }`}
                >
                  <img
                    src={item.preview}
                    alt={item.description}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 py-2 text-center border-t border-slate-500/20">
          <span className="text-[10px] opacity-60">
            Powered by GIPHY
          </span>
        </div>
      </div>

      {showStudio && (
        <StickerStudio
          isDark={isDark}
          onClose={() => setShowStudio(false)}
          onSend={handleSendCustomSticker}
        />
      )}
    </>
  );
};

export default GifStickerPicker;
