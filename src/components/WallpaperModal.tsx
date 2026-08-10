import React, { useState } from 'react';
import { X, Image as ImageIcon, Upload, Check, RefreshCw } from 'lucide-react';

interface WallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWallpaper: string;
  onSelectWallpaper: (url: string) => void;
}

const PRESET_WALLPAPERS = [
  {
    id: 'default_warm',
    name: 'Apple Home Warm Sunset',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'botanical',
    name: 'Apple Home Botanical',
    url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'abstract_dusk',
    name: 'Apple Home Twilight Blur',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'modern_dark',
    name: 'Minimal Dark Glass',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'golden_hour',
    name: 'Casa al Tramonto',
    url: 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=1920&q=80',
  },
];

export const WallpaperModal: React.FC<WallpaperModalProps> = ({
  isOpen,
  onClose,
  currentWallpaper,
  onSelectWallpaper,
}) => {
  if (!isOpen) return null;

  const [customInputUrl, setCustomInputUrl] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          onSelectWallpaper(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5 text-amber-400">
            <div className="p-2 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Sfondo & Wallpaper Casa</h3>
              <p className="text-xs text-slate-400">Personalizza la grafica di sfondo della tua dashboard</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Custom Upload Button */}
        <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/10 space-y-3">
          <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span>Carica la tua foto / Sfondo dal PC o Telefono</span>
          </h4>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <label className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-4 py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20">
              <Upload className="w-4 h-4" />
              <span>Sfoglia e Carica Foto...</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            {currentWallpaper && (
              <button
                onClick={() => onSelectWallpaper('')}
                className="bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold px-4 py-3 rounded-xl border border-white/10 transition cursor-pointer"
              >
                Ripristina Sfondo Default
              </button>
            )}
          </div>
        </div>

        {/* Preset Gallery */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Galleria Sfondi Apple Home
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PRESET_WALLPAPERS.map((preset) => {
              const isSelected = currentWallpaper === preset.url;
              return (
                <button
                  key={preset.id}
                  onClick={() => onSelectWallpaper(preset.url)}
                  className={`group relative h-24 rounded-2xl overflow-hidden border-2 transition cursor-pointer text-left ${
                    isSelected
                      ? 'border-amber-400 ring-2 ring-amber-400/30'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt={preset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 flex flex-col justify-end">
                    <span className="text-[11px] font-bold text-white line-clamp-1">{preset.name}</span>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-amber-400 text-slate-950 p-1 rounded-full shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-6 py-2.5 rounded-xl transition cursor-pointer"
          >
            Fatto
          </button>
        </div>

      </div>
    </div>
  );
};
