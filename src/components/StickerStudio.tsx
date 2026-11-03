
import React, { useEffect, useRef, useState } from 'react';
import {
  X, Type, ImagePlus, Smile, Shapes, Undo2, Redo2,
  RotateCw, Trash2, Send, Save, Download, Plus,
  Heart, Star, Circle, Square, Sparkles
} from 'lucide-react';

interface StickerStudioProps {
  isDark: boolean;
  onClose: () => void;
  onSend: (file: File) => Promise<void>;
}

type ShapeType = 'heart' | 'star' | 'circle' | 'square' | 'sparkles';

interface StickerState {
  text: string;
  emoji: string;
  shape: ShapeType | '';
  photo: string;
  textColor: string;
  background: string;
  outline: string;
  font: string;
  fontSize: number;
  rotation: number;
  photoScale: number;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
}

const initialState: StickerState = {
  text: 'Your Sticker',
  emoji: '',
  shape: '',
  photo: '',
  textColor: '#ff3b9d',
  background: 'transparent',
  outline: '#ffffff',
  font: 'Arial',
  fontSize: 66,
  rotation: 0,
  photoScale: 1,
  bold: true,
  italic: false,
  shadow: true
};

const EMOJI_OPTIONS = [
  '❤️', '😍', '😂', '🔥', '🥰', '😘',
  '😎', '🥳', '🤩', '😭', '👍', '🙏',
  '💯', '✨', '🌈', '🎉', '🌹', '⭐',
  '💖', '💕', '🤣', '😜', '🤗', '👏'
];

const SHAPES: ShapeType[] = [
  'heart', 'star', 'circle', 'square', 'sparkles'
];

const fonts = [
  'Arial',
  'Georgia',
  'Impact',
  'Trebuchet MS',
  'Comic Sans MS',
  'Courier New'
];

const colors = [
  '#ff3b9d', '#ff5722', '#ff9800', '#ffd600',
  '#00c853', '#00bcd4', '#2979ff', '#7c4dff',
  '#e040fb', '#ffffff', '#111827', '#f5f5f5'
];

const StickerStudio: React.FC<StickerStudioProps> = ({
  isDark,
  onClose,
  onSend
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [sticker, setSticker] = useState<StickerState>(initialState);
  const [history, setHistory] = useState<StickerState[]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<
    'text' | 'photo' | 'decorations' | 'style'
  >('text');
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);

  const darkPanel = isDark
    ? 'bg-[#17232b] text-white border-slate-700'
    : 'bg-white text-slate-900 border-slate-200';

  const inputClass = `w-full rounded-xl px-3 py-2.5 text-sm outline-none border ${
    isDark
      ? 'bg-[#101a20] border-slate-700 text-white'
      : 'bg-slate-50 border-slate-200 text-slate-900'
  }`;

  const updateSticker = (changes: Partial<StickerState>) => {
    setSticker(previous => {
      const next = { ...previous, ...changes };
      setHistory(old => [
        ...old.slice(0, historyIndex + 1),
        next
      ]);
      setHistoryIndex(index => index + 1);
      return next;
    });
    setSaved(false);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setSticker(history[nextIndex]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setSticker(history[nextIndex]);
  };

  const loadPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert('Please select an image.');
      event.target.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      window.alert('Image must be smaller than 15 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateSticker({
          photo: reader.result,
          photoScale: 1
        });
      }
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const size = 512;
    canvas.width = size;
    canvas.height = size;

    context.clearRect(0, 0, size, size);

    if (sticker.background !== 'transparent') {
      context.fillStyle = sticker.background;
      context.fillRect(0, 0, size, size);
    }

    const drawContent = () => {
      context.save();
      context.translate(size / 2, size / 2);

      if (sticker.rotation) {
        context.rotate(sticker.rotation * Math.PI / 180);
      }

      if (sticker.shape) {
        context.save();
        context.fillStyle = sticker.textColor;
        context.strokeStyle = sticker.outline;
        context.lineWidth = 12;
        context.lineJoin = 'round';

        const x = -120;
        const y = -100;

        if (sticker.shape === 'circle') {
          context.beginPath();
          context.arc(0, 0, 110, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        } else if (sticker.shape === 'square') {
          context.beginPath();
          context.roundRect(-110, -110, 220, 220, 35);
          context.fill();
          context.stroke();
        } else if (sticker.shape === 'heart') {
          context.beginPath();
          context.moveTo(0, 100);
          context.bezierCurveTo(-190, -20, -100, -150, 0, -65);
          context.bezierCurveTo(100, -150, 190, -20, 0, 100);
          context.fill();
          context.stroke();
        } else {
          context.font = '190px Arial';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(
            sticker.shape === 'star' ? '★' : '✨',
            0,
            0
          );
        }

        context.restore();
      }

      if (sticker.photo) {
        const photo = new Image();

        photo.onload = () => {
          const maxSize = 330 * sticker.photoScale;
          const ratio = Math.min(
            maxSize / photo.width,
            maxSize / photo.height
          );

          const width = photo.width * ratio;
          const height = photo.height * ratio;

          context.save();

          if (sticker.shadow) {
            context.shadowColor = 'rgba(0,0,0,0.25)';
            context.shadowBlur = 18;
          }

          context.drawImage(
            photo,
            -width / 2,
            -height / 2 - 30,
            width,
            height
          );

          context.restore();

          context.save();
          context.font = 'bold 20px Arial';
          context.textAlign = 'center';
          context.fillStyle = sticker.textColor;
          context.restore();

          drawTextAndEmoji(context);
          context.restore();
        };

        photo.onerror = () => {
          drawTextAndEmoji(context);
          context.restore();
        };

        photo.src = sticker.photo;
      } else {
        drawTextAndEmoji(context);
        context.restore();
      }
    };

    const drawTextAndEmoji = (ctx: CanvasRenderingContext2D) => {
      if (sticker.emoji) {
        ctx.save();
        ctx.font = '100px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sticker.emoji, 0, sticker.text ? -125 : 0);
        ctx.restore();
      }

      if (sticker.text.trim()) {
        ctx.save();

        const fontStyle = [
          sticker.italic ? 'italic' : '',
          sticker.bold ? 'bold' : ''
        ].filter(Boolean).join(' ');

        ctx.font = `${fontStyle} ${sticker.fontSize}px "${sticker.font}"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';

        const lines = sticker.text.split('\n').slice(0, 4);
        const lineHeight = sticker.fontSize * 1.12;
        const startY = -((lines.length - 1) * lineHeight) / 2 + 120;

        if (sticker.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 4;
        }

        lines.forEach((line, index) => {
          const y = startY + index * lineHeight;

          ctx.lineWidth = 13;
          ctx.strokeStyle = sticker.outline;
          ctx.strokeText(line, 0, y, 450);

          ctx.shadowBlur = 0;
          ctx.fillStyle = sticker.textColor;
          ctx.fillText(line, 0, y, 450);
        });

        ctx.restore();
      }
    };

    drawContent();
  }, [sticker]);

  const exportSticker = async (): Promise<File> => {
    const canvas = canvasRef.current;

    if (!canvas) {
      throw new Error('Sticker preview is not ready.');
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) resolve(result);
        else reject(new Error('Sticker export failed.'));
      }, 'image/png');
    });

    return new File(
      [blob],
      `chatnova-sticker-${Date.now()}.png`,
      { type: 'image/png' }
    );
  };

  const saveSticker = async () => {
    try {
      const file = await exportSticker();
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const existing = JSON.parse(
            localStorage.getItem('chatnova_my_stickers') || '[]'
          );

          const updated = [
            {
              id: Date.now(),
              name: sticker.text || sticker.emoji || 'My Sticker',
              image: reader.result
            },
            ...existing
          ].slice(0, 40);

          localStorage.setItem(
            'chatnova_my_stickers',
            JSON.stringify(updated)
          );

          setSaved(true);
          window.alert('Sticker saved in My Stickers on this device.');
        } catch {
          window.alert('Storage full. Please remove some saved stickers.');
        }
      };

      reader.readAsDataURL(file);
    } catch {
      window.alert('Sticker could not be saved.');
    }
  };

  const downloadSticker = async () => {
    try {
      const file = await exportSticker();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = file.name;
      anchor.click();

      URL.revokeObjectURL(url);
    } catch {
      window.alert('Sticker download failed.');
    }
  };

  const sendSticker = async () => {
    if (sending) return;

    setSending(true);

    try {
      const file = await exportSticker();
      await onSend(file);
      onClose();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Sticker could not be sent.'
      );
    } finally {
      setSending(false);
    }
  };

  const addDecoration = (emoji: string) => {
    updateSticker({ emoji });
  };

  const tabButton = (
    tab: typeof activeTab,
    label: string,
    icon: React.ReactNode
  ) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`flex-1 min-w-0 flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold ${
        activeTab === tab
          ? 'bg-emerald-600 text-white'
          : isDark
            ? 'text-slate-300 hover:bg-slate-700'
            : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-0 sm:p-4">
      <div className={`w-full h-full sm:h-[94vh] sm:max-w-6xl sm:rounded-3xl overflow-hidden border flex flex-col ${darkPanel}`}>
        <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-slate-500/20">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center text-white">
              <Sparkles size={19} />
            </div>
            <div>
              <h2 className="font-bold text-sm">Sticker Studio</h2>
              <p className="text-[10px] opacity-60">Create your own stickers</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={undo}
              disabled={historyIndex <= 0}
              title="Undo"
              className="p-2 rounded-lg hover:bg-slate-500/20 disabled:opacity-30"
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              title="Redo"
              className="p-2 rounded-lg hover:bg-slate-500/20 disabled:opacity-30"
            >
              <Redo2 size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-rose-500/15 text-rose-500"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          <section className="lg:w-[58%] min-h-[280px] lg:min-h-0 flex flex-col items-center justify-center gap-3 p-4 bg-gradient-to-br from-slate-800 to-slate-950">
            <div className="text-white/70 text-xs font-semibold">
              LIVE STICKER PREVIEW
            </div>

            <div className="w-full max-w-[min(72vw,420px)] aspect-square rounded-3xl overflow-hidden shadow-2xl bg-[linear-gradient(45deg,#ffffff18_25%,transparent_25%,transparent_75%,#ffffff18_75%),linear-gradient(45deg,#ffffff18_25%,transparent_25%,transparent_75%,#ffffff18_75%)] [background-position:0_0,12px_12px] [background-size:24px_24px]">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-white/50 text-[10px]">
              Transparent PNG • 512 × 512
            </p>
          </section>

          <section className="flex-1 min-h-0 flex flex-col">
            <nav className="flex gap-1 p-2 border-b border-slate-500/20">
              {tabButton('text', 'Text', <Type size={19} />)}
              {tabButton('photo', 'Photo', <ImagePlus size={19} />)}
              {tabButton('decorations', 'Decor', <Smile size={19} />)}
              {tabButton('style', 'Style', <Shapes size={19} />)}
            </nav>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'text' && (
                <>
                  <div>
                    <label className="text-xs font-bold block mb-2">Your sticker text</label>
                    <textarea
                      value={sticker.text}
                      onChange={event => updateSticker({ text: event.target.value })}
                      maxLength={100}
                      rows={3}
                      placeholder="Write something stylish..."
                      className={inputClass}
                    />
                    <p className="text-[10px] opacity-50 mt-1">Up to 100 characters</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-2">Font style</label>
                    <select
                      value={sticker.font}
                      onChange={event => updateSticker({ font: event.target.value })}
                      className={inputClass}
                    >
                      {fonts.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span>Text size</span>
                      <span>{sticker.fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="24"
                      max="110"
                      value={sticker.fontSize}
                      onChange={event => updateSticker({ fontSize: Number(event.target.value) })}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateSticker({ bold: !sticker.bold })}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold ${sticker.bold ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-500/30'}`}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSticker({ italic: !sticker.italic })}
                      className={`flex-1 py-2 rounded-xl border text-xs italic ${sticker.italic ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-500/30'}`}
                    >
                      Italic
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-2">Text color</label>
                    <div className="flex flex-wrap gap-2">
                      {colors.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateSticker({ textColor: color })}
                          className={`w-8 h-8 rounded-full border-2 ${sticker.textColor === color ? 'border-emerald-500 scale-110' : 'border-slate-400/30'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'photo' && (
                <>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center gap-3 hover:bg-emerald-500/5"
                  >
                    <ImagePlus size={32} className="text-emerald-500" />
                    <span className="font-bold text-sm">
                      {sticker.photo ? 'Change Photo' : 'Upload Photo'}
                    </span>
                    <span className="text-[10px] opacity-60">JPG, PNG, WEBP • Maximum 15 MB</span>
                  </button>

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={loadPhoto}
                    className="hidden"
                  />

                  {sticker.photo && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Photo size</span>
                        <button
                          type="button"
                          onClick={() => updateSticker({ photo: '' })}
                          className="text-xs text-rose-500 flex items-center gap-1"
                        >
                          <Trash2 size={14} /> Remove photo
                        </button>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={sticker.photoScale}
                        onChange={event => updateSticker({ photoScale: Number(event.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                    </>
                  )}

                  <p className="text-[11px] opacity-60">
                    Tip: You can combine a photo with text, emoji and shapes.
                  </p>
                </>
              )}

              {activeTab === 'decorations' && (
                <>
                  <div>
                    <label className="text-xs font-bold block mb-3">Add emoji</label>
                    <div className="grid grid-cols-6 gap-2">
                      {EMOJI_OPTIONS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => addDecoration(emoji)}
                          className={`aspect-square rounded-xl text-2xl hover:bg-emerald-500/15 ${sticker.emoji === emoji ? 'bg-emerald-500/20 ring-1 ring-emerald-500' : ''}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSticker({ emoji: '' })}
                      className="mt-3 text-xs text-rose-500"
                    >
                      Remove emoji
                    </button>
                  </div>

                  <div className="border-t border-slate-500/20 pt-4">
                    <label className="text-xs font-bold block mb-3">Decorative shapes</label>
                    <div className="grid grid-cols-5 gap-2">
                      {SHAPES.map(shape => (
                        <button
                          key={shape}
                          type="button"
                          onClick={() => updateSticker({ shape: sticker.shape === shape ? '' : shape })}
                          className={`aspect-square rounded-xl flex items-center justify-center ${sticker.shape === shape ? 'bg-emerald-600 text-white' : 'bg-slate-500/10'}`}
                        >
                          {shape === 'heart' ? <Heart size={22} /> :
                           shape === 'star' ? <Star size={22} /> :
                           shape === 'circle' ? <Circle size={22} /> :
                           shape === 'square' ? <Square size={22} /> :
                           <Sparkles size={22} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'style' && (
                <>
                  <div>
                    <label className="text-xs font-bold block mb-2">Sticker background</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        'transparent', '#ffffff', '#111827',
                        '#ffb3d9', '#ffe082', '#b9f6ca',
                        '#b3e5fc', '#d1c4e9'
                      ].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateSticker({ background: color })}
                          className={`h-10 rounded-xl border-2 ${sticker.background === color ? 'border-emerald-500' : 'border-slate-400/20'}`}
                          style={{
                            background: color === 'transparent'
                              ? 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 12px 12px'
                              : color
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-2">Sticker outline</label>
                    <div className="flex flex-wrap gap-2">
                      {colors.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateSticker({ outline: color })}
                          className={`w-8 h-8 rounded-full border-2 ${sticker.outline === color ? 'border-emerald-500 scale-110' : 'border-slate-400/30'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center justify-between text-sm py-2">
                    <span>Shadow effect</span>
                    <input
                      type="checkbox"
                      checked={sticker.shadow}
                      onChange={event => updateSticker({ shadow: event.target.checked })}
                      className="w-5 h-5 accent-emerald-500"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => updateSticker({ rotation: (sticker.rotation + 15) % 360 })}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-500/30 py-3 text-sm"
                  >
                    <RotateCw size={17} /> Rotate sticker 15°
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSticker({ rotation: 0 })}
                    className="w-full text-xs text-emerald-500"
                  >
                    Reset rotation
                  </button>
                </>
              )}
            </div>

            <div className="shrink-0 p-3 border-t border-slate-500/20 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={saveSticker}
                  className="rounded-xl py-3 text-xs font-bold border border-slate-500/30 flex items-center justify-center gap-2"
                >
                  <Save size={16} /> {saved ? 'Saved' : 'Save Sticker'}
                </button>
                <button
                  type="button"
                  onClick={downloadSticker}
                  className="rounded-xl py-3 text-xs font-bold border border-slate-500/30 flex items-center justify-center gap-2"
                >
                  <Download size={16} /> Download
                </button>
              </div>

              <button
                type="button"
                onClick={sendSticker}
                disabled={sending}
                className="w-full rounded-xl py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2"
              >
                <Send size={17} />
                {sending ? 'Sending Sticker...' : 'Send Sticker'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StickerStudio;
