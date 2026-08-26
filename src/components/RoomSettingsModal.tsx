import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Check, 
  Upload, 
  Image as ImageIcon, 
  Home, 
  Tv, 
  Utensils, 
  Bed, 
  Bath, 
  Trees, 
  Warehouse, 
  Monitor, 
  DoorOpen, 
  Coffee, 
  Flame, 
  Waves, 
  Sun, 
  Sparkles, 
  Shield, 
  Music, 
  Wind, 
  Dumbbell, 
  Car, 
  BookOpen, 
  AlertTriangle,
  RefreshCw,
  Sliders,
  Palette,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  GripVertical
} from 'lucide-react';
import { SmartDevice, RoomConfig, RoomName } from '../types';

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  roomConfig?: RoomConfig;
  existingConfig?: RoomConfig;
  devices: SmartDevice[];
  onSaveRoomConfig?: (originalName: string, newConfig: RoomConfig, assignedDeviceIds: string[]) => void;
  onSaveConfig?: (originalName: string, newConfig: RoomConfig, assignedDeviceIds: string[]) => void;
  onDeleteRoom: (roomName: string) => void;
  allRooms?: string[];
  roomOrder?: string[];
  onReorderRooms?: (newOrder: string[]) => void;
}

export const ROOM_ICONS_LIST = [
  { id: 'Home', label: 'Casa', icon: <Home className="w-5 h-5" /> },
  { id: 'Tv', label: 'Salotto / TV', icon: <Tv className="w-5 h-5" /> },
  { id: 'Utensils', label: 'Cucina', icon: <Utensils className="w-5 h-5" /> },
  { id: 'Bed', label: 'Camera da Letto', icon: <Bed className="w-5 h-5" /> },
  { id: 'Bath', label: 'Bagno', icon: <Bath className="w-5 h-5" /> },
  { id: 'Monitor', label: 'Studio / PC', icon: <Monitor className="w-5 h-5" /> },
  { id: 'DoorOpen', label: 'Ingresso', icon: <DoorOpen className="w-5 h-5" /> },
  { id: 'Trees', label: 'Giardino', icon: <Trees className="w-5 h-5" /> },
  { id: 'Warehouse', label: 'Garage / Box', icon: <Warehouse className="w-5 h-5" /> },
  { id: 'Coffee', label: 'Relax / Bar', icon: <Coffee className="w-5 h-5" /> },
  { id: 'Flame', label: 'Taverna', icon: <Flame className="w-5 h-5" /> },
  { id: 'Waves', label: 'Piscina / Spa', icon: <Waves className="w-5 h-5" /> },
  { id: 'Sun', label: 'Terrazzo / Balcone', icon: <Sun className="w-5 h-5" /> },
  { id: 'Dumbbell', label: 'Palestra', icon: <Dumbbell className="w-5 h-5" /> },
  { id: 'Car', label: 'Parcheggio', icon: <Car className="w-5 h-5" /> },
  { id: 'BookOpen', label: 'Libreria', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'Music', label: 'Musica', icon: <Music className="w-5 h-5" /> },
  { id: 'Wind', label: 'Clima', icon: <Wind className="w-5 h-5" /> },
  { id: 'Shield', label: 'Sicurezza', icon: <Shield className="w-5 h-5" /> },
  { id: 'Sparkles', label: 'Smart Zone', icon: <Sparkles className="w-5 h-5" /> },
];

export const PRESET_ROOM_WALLPAPERS = [
  {
    id: 'sunset_warm',
    name: 'Tramonto Caldo',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'botanical_lush',
    name: 'Botanico Verde',
    url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'twilight_blur',
    name: 'Twilight Dusk',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'minimal_dark',
    name: 'Minimal Dark',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'modern_lounge',
    name: 'Modern Lounge',
    url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'cozy_room',
    name: 'Camera Intima',
    url: 'https://images.unsplash.com/photo-1540518614846-7ede433c4ef2?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'clean_kitchen',
    name: 'Cucina Luminosa',
    url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 'spa_bathroom',
    name: 'Bagno Spa',
    url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1920&q=80',
  },
];

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  roomName,
  roomConfig,
  existingConfig,
  devices,
  onSaveRoomConfig,
  onSaveConfig,
  onDeleteRoom,
  allRooms = [],
  roomOrder = [],
  onReorderRooms,
}) => {
  const activeConfig = roomConfig || existingConfig;
  const [name, setName] = useState(roomName);
  const [selectedIcon, setSelectedIcon] = useState(activeConfig?.iconName || 'Home');
  const [wallpaperUrl, setWallpaperUrl] = useState(activeConfig?.wallpaperUrl || '');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Compute current room position
  const currentRoomsList = allRooms && allRooms.length > 0 ? allRooms : (roomOrder && roomOrder.length > 0 ? roomOrder : []);
  const currentPosIndex = currentRoomsList.indexOf(roomName);

  const handleMovePosition = (direction: 'left' | 'right') => {
    if (!onReorderRooms || currentPosIndex === -1) return;
    const targetIndex = direction === 'left' ? currentPosIndex - 1 : currentPosIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentRoomsList.length) return;

    const listCopy = [...currentRoomsList];
    const [moved] = listCopy.splice(currentPosIndex, 1);
    listCopy.splice(targetIndex, 0, moved);
    onReorderRooms(listCopy);
  };

  useEffect(() => {
    const cfg = roomConfig || existingConfig;
    setName(roomName);
    setSelectedIcon(cfg?.iconName || 'Home');
    setWallpaperUrl(cfg?.wallpaperUrl || '');
    // Initial devices in this room
    const currentInRoom = devices.filter((d) => d.room === roomName).map((d) => d.id);
    setSelectedDeviceIds(currentInRoom);
    setShowDeleteConfirm(false);
  }, [roomName, roomConfig, existingConfig, devices, isOpen]);

  if (!isOpen || !roomName) return null;

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || roomName;
    const newConfig: RoomConfig = {
      name: cleanName,
      iconName: selectedIcon,
      wallpaperUrl: wallpaperUrl,
    };
    const saveFn = onSaveConfig || onSaveRoomConfig;
    if (saveFn) {
      saveFn(roomName, newConfig, selectedDeviceIds);
    }
    onClose();
  };

  const handleDelete = () => {
    onDeleteRoom(roomName);
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#121620] border border-white/20 rounded-[28px] max-w-xl w-full shadow-2xl text-slate-100 relative flex flex-col max-h-[90vh] backdrop-blur-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Personalizza Stanza</span>
                <span className="text-xs bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-mono font-normal">
                  {roomName}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Modifica icona, sfondo dedicato e dispositivi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            
            {/* Delete Confirmation Alert Banner if triggered */}
            {showDeleteConfirm && (
              <div className="bg-rose-950/80 border border-rose-500/40 rounded-2xl p-4 space-y-3 animate-in fade-in zoom-in duration-150">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Eliminare la stanza "{roomName}"?</h4>
                    <p className="text-xs text-rose-200/90 mt-1">
                      I {devices.filter(d => d.room === roomName).length} dispositivi assegnati a questa stanza non verranno cancellati, ma spostati in "Senza Stanza".
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Conferma Eliminazione</span>
                  </button>
                </div>
              </div>
            )}

            {/* Room Name Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Nome Stanza
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/40 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition"
                placeholder="Nome stanza..."
              />
            </div>

            {/* Room Icon Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Icona Stanza
                </label>
                <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                  Selezionata: {ROOM_ICONS_LIST.find(i => i.id === selectedIcon)?.label || selectedIcon}
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                {ROOM_ICONS_LIST.map((ico) => {
                  const isSelected = selectedIcon === ico.id;
                  return (
                    <button
                      key={ico.id}
                      type="button"
                      onClick={() => setSelectedIcon(ico.id)}
                      className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-lg shadow-amber-400/20 scale-105'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {ico.icon}
                      <span className="text-[9px] truncate max-w-full text-center">{ico.label.split('/')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Room Background / Wallpaper Customization */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <span>Sfondo Dedicato per {name || roomName}</span>
                </label>
                {wallpaperUrl && (
                  <button
                    type="button"
                    onClick={() => setWallpaperUrl('')}
                    className="text-[10px] text-slate-400 hover:text-amber-400 underline transition cursor-pointer"
                  >
                    Usa Sfondo Casa Predefinito
                  </button>
                )}
              </div>

              {/* Wallpaper Preview Card */}
              <div className="relative h-28 w-full rounded-2xl overflow-hidden border border-white/20 bg-black/40 flex items-center justify-center shadow-inner">
                {wallpaperUrl ? (
                  <>
                    <img 
                      src={wallpaperUrl} 
                      alt="Room Wallpaper Preview" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] p-3 flex flex-col justify-between">
                      <span className="text-[10px] font-mono bg-black/70 text-emerald-400 px-2 py-0.5 rounded-md self-start border border-emerald-500/30">
                        ✓ Sfondo Stanza Attivo
                      </span>
                      <span className="text-xs font-bold text-white drop-shadow-md">
                        {name || roomName}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs text-slate-400">Nessuno sfondo dedicato (usa lo sfondo generale della casa)</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Scegli un preset qui sotto o carica una tua foto</p>
                  </div>
                )}
              </div>

              {/* Upload custom room photo */}
              <div className="flex items-center gap-2">
                <label className="flex-1 bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-white/15 transition cursor-pointer flex items-center justify-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Carica Foto Stanza dal PC / Telefono...</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* Preset Room Wallpapers */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Oppure scegli dai preset:
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_ROOM_WALLPAPERS.map((preset) => {
                    const isSelected = wallpaperUrl === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setWallpaperUrl(preset.url)}
                        className={`group relative h-16 rounded-xl overflow-hidden border-2 transition cursor-pointer text-left ${
                          isSelected
                            ? 'border-amber-400 ring-2 ring-amber-400/40'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-1 flex flex-col justify-end">
                          <span className="text-[9px] font-semibold text-white truncate">{preset.name}</span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-amber-400 text-slate-950 p-0.5 rounded-full shadow-md">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Assign / Move Devices for this room */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Dispositivi in questa stanza ({selectedDeviceIds.length})
                </label>
                <span className="text-[10px] text-slate-400">Tocca per aggiungere / rimuovere</span>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-2 max-h-36 overflow-y-auto space-y-1.5 no-scrollbar">
                {devices.length === 0 ? (
                  <p className="text-xs text-slate-500 p-2 text-center">Nessun dispositivo disponibile.</p>
                ) : (
                  devices.map((dev) => {
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
                          {dev.room || 'Senza Stanza'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Room Order / Position in Dashboard */}
            {onReorderRooms && currentRoomsList.length > 1 && (
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <GripVertical className="w-4 h-4 text-amber-400" />
                      <span>Posizione & Ordinamento Stanza</span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {currentPosIndex !== -1 
                        ? `Posizione attuale: ${currentPosIndex + 1} su ${currentRoomsList.length}` 
                        : 'Sposta la stanza nella sequenza'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleMovePosition('left')}
                      disabled={currentPosIndex <= 0}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        currentPosIndex <= 0
                          ? 'border-white/5 bg-white/5 text-slate-600 cursor-not-allowed'
                          : 'border-white/15 bg-white/10 hover:bg-white/20 text-white active:scale-95'
                      }`}
                      title="Sposta prima / indietro nella lista"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                      <span>Indietro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMovePosition('right')}
                      disabled={currentPosIndex === -1 || currentPosIndex >= currentRoomsList.length - 1}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        currentPosIndex === -1 || currentPosIndex >= currentRoomsList.length - 1
                          ? 'border-white/5 bg-white/5 text-slate-600 cursor-not-allowed'
                          : 'border-white/15 bg-white/10 hover:bg-white/20 text-white active:scale-95'
                      }`}
                      title="Sposta dopo / avanti nella lista"
                    >
                      <span>Avanti</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Room Section */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-rose-300">Elimina Stanza</h5>
                <p className="text-[11px] text-slate-400">
                  Rimuove la stanza. I dispositivi vengono spostati su "Non assegnati"
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 text-rose-300 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Elimina Stanza</span>
              </button>
            </div>

          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-black/40 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-400/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Salva Modifiche</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
