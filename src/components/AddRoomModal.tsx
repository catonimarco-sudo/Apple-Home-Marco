import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  FolderPlus,
  Check,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { SmartDevice, RoomName } from '../types';
import { ROOM_ICONS_LIST, PRESET_ROOM_WALLPAPERS } from './RoomSettingsModal';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRooms?: string[];
  devices?: SmartDevice[];
  availableDevices?: SmartDevice[];
  onAddRoom: (roomName: string, iconName: string, assignedDeviceIds: string[], wallpaperUrl?: string) => void;
}

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  isOpen,
  onClose,
  existingRooms = [],
  devices = [],
  availableDevices = [],
  onAddRoom,
}) => {
  const allDeviceList = devices.length > 0 ? devices : availableDevices;
  const [roomName, setRoomName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Home');
  const [wallpaperUrl, setWallpaperUrl] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setWallpaperUrl(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleDevice = (id: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((dId) => dId !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = roomName.trim();
    if (!cleanName) {
      setErrorMsg('Inserisci un nome per la stanza.');
      return;
    }

    if ((existingRooms || []).some((r) => r && r.toLowerCase() === cleanName.toLowerCase())) {
      setErrorMsg('Esiste già una stanza con questo nome.');
      return;
    }

    onAddRoom(cleanName, selectedIcon, selectedDeviceIds, wallpaperUrl);
    setRoomName('');
    setSelectedIcon('Home');
    setWallpaperUrl('');
    setSelectedDeviceIds([]);
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#121620] border border-white/20 rounded-[28px] max-w-lg w-full shadow-2xl text-slate-100 relative flex flex-col max-h-[90vh] backdrop-blur-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Apple Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-sans tracking-tight">Nuova Stanza</h3>
              <p className="text-xs text-slate-400">Aggiungi e personalizza icona, sfondo e dispositivi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
            {/* Room Name Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Nome Stanza <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Es. Mansarda, Palestra, Balcone, Lavanderia..."
                value={roomName}
                onChange={(e) => {
                  setRoomName(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition placeholder-slate-500"
                autoFocus
              />
              {errorMsg && (
                <p className="text-xs text-rose-400 mt-1.5 font-medium">{errorMsg}</p>
              )}
            </div>

            {/* Icon Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Icona Stanza (Stile Apple Home)
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-32 overflow-y-auto pr-1 no-scrollbar">
                {ROOM_ICONS_LIST.map((ico) => {
                  const isSelected = selectedIcon === ico.id;
                  return (
                    <button
                      key={ico.id}
                      type="button"
                      onClick={() => setSelectedIcon(ico.id)}
                      className={`p-2 rounded-2xl flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-lg shadow-amber-400/20 scale-105'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                      title={ico.label}
                    >
                      {ico.icon}
                      <span className="text-[9px] truncate max-w-full text-center">{ico.label.split('/')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wallpaper Selection (Optional) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Sfondo Stanza (Opzionale)
                </label>
                {wallpaperUrl && (
                  <button
                    type="button"
                    onClick={() => setWallpaperUrl('')}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Rimuovi
                  </button>
                )}
              </div>

              {wallpaperUrl && (
                <div className="relative h-20 w-full rounded-2xl overflow-hidden border border-amber-400/50 shadow-inner">
                  <img src={wallpaperUrl} alt="Room Wallpaper" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 p-2 flex items-center justify-center">
                    <span className="text-xs font-bold text-white drop-shadow">✓ Sfondo Selezionato</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl border border-white/10 transition cursor-pointer flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Carica Foto...</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_ROOM_WALLPAPERS.slice(0, 4).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setWallpaperUrl(preset.url)}
                    className={`relative h-12 rounded-xl overflow-hidden border transition cursor-pointer ${
                      wallpaperUrl === preset.url ? 'border-amber-400 ring-1 ring-amber-400' : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Assign Devices Option */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Assegna Dispositivi ({selectedDeviceIds.length} selezionati)
                </label>
                <span className="text-[10px] text-slate-400">Opzionale</span>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-2 max-h-32 overflow-y-auto space-y-1.5 no-scrollbar">
                {allDeviceList.length === 0 ? (
                  <p className="text-xs text-slate-500 p-2 text-center">Nessun dispositivo disponibile.</p>
                ) : (
                  allDeviceList.map((dev) => {
                    const isChecked = selectedDeviceIds.includes(dev.id);
                    return (
                      <div
                        key={dev.id}
                        onClick={() => handleToggleDevice(dev.id)}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-amber-400/20 border border-amber-400/40 text-amber-200'
                            : 'bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                            isChecked ? 'bg-amber-400 text-slate-950 font-bold' : 'border border-white/30 text-transparent'
                          }`}>
                            ✓
                          </span>
                          <span className="font-semibold text-white truncate">{dev.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 bg-white/10 px-2 py-0.5 rounded-full shrink-0">
                          {dev.room}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer Action Buttons */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-black/40 shrink-0">
            <span className="text-xs text-slate-400">
              {roomName.trim() ? `Nuova: "${roomName.trim()}"` : 'Inserisci nome stanza'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-400/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Salva Stanza</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
