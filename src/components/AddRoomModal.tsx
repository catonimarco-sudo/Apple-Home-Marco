import React, { useState } from 'react';
import { 
  X, 
  Plus, 
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
  FolderPlus,
  Check
} from 'lucide-react';
import { SmartDevice, RoomName } from '../types';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRooms?: string[];
  devices?: SmartDevice[];
  availableDevices?: SmartDevice[];
  onAddRoom: (roomName: string, iconName: string, assignedDeviceIds: string[]) => void;
}

const AVAILABLE_ICONS = [
  { id: 'Home', label: 'Casa', icon: <Home className="w-5 h-5" /> },
  { id: 'Tv', label: 'Salotto / TV', icon: <Tv className="w-5 h-5" /> },
  { id: 'Utensils', label: 'Cucina', icon: <Utensils className="w-5 h-5" /> },
  { id: 'Bed', label: 'Camera', icon: <Bed className="w-5 h-5" /> },
  { id: 'Bath', label: 'Bagno', icon: <Bath className="w-5 h-5" /> },
  { id: 'Monitor', label: 'Studio / Ufficio', icon: <Monitor className="w-5 h-5" /> },
  { id: 'DoorOpen', label: 'Ingresso / Corridoio', icon: <DoorOpen className="w-5 h-5" /> },
  { id: 'Trees', label: 'Giardino / Terrazzo', icon: <Trees className="w-5 h-5" /> },
  { id: 'Warehouse', label: 'Garage / Cantina', icon: <Warehouse className="w-5 h-5" /> },
  { id: 'Coffee', label: 'Zona Relax / Bar', icon: <Coffee className="w-5 h-5" /> },
  { id: 'Flame', label: 'Taverna / Camino', icon: <Flame className="w-5 h-5" /> },
  { id: 'Waves', label: 'Piscina / Spa', icon: <Waves className="w-5 h-5" /> },
  { id: 'Sun', label: 'Balcone / Solarium', icon: <Sun className="w-5 h-5" /> },
];

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
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

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

    onAddRoom(cleanName, selectedIcon, selectedDeviceIds);
    setRoomName('');
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
              <p className="text-xs text-slate-400">Aggiungi e organizza i dispositivi come in Apple Home</p>
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
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                {AVAILABLE_ICONS.map((ico) => {
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
                      title={ico.label}
                    >
                      {ico.icon}
                      <span className="text-[9px] truncate max-w-full text-center">{ico.label.split('/')[0]}</span>
                    </button>
                  );
                })}
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
              <div className="bg-black/30 border border-white/10 rounded-2xl p-2 max-h-36 overflow-y-auto space-y-1.5 no-scrollbar">
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
