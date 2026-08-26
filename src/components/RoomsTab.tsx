import React, { useState, useRef } from 'react';
import { SmartDevice, RoomName, RoomConfig, isWideDeviceCard } from '../types';
import { DeviceCard } from './DeviceCard';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  Utensils, 
  Bed, 
  Bath, 
  Trees, 
  Warehouse, 
  Monitor, 
  DoorOpen, 
  Home, 
  Plus, 
  Zap, 
  SunMedium, 
  Thermometer, 
  Power, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  Layers,
  Edit3,
  Sliders,
  Dumbbell,
  Car,
  BookOpen,
  Music,
  Wind,
  Shield,
  Coffee,
  Flame,
  Waves,
  Sun,
  Trash2,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';

interface RoomsTabProps {
  devices: SmartDevice[];
  customRooms?: string[];
  deletedRooms?: string[];
  roomConfigs?: Record<string, RoomConfig>;
  roomOrder?: string[];
  onReorderRooms?: (newOrder: string[]) => void;
  onDeleteRoom?: (roomName: string) => void;
  onTogglePower: (device: SmartDevice) => void;
  onUpdateState: (deviceId: string, newState: Partial<SmartDevice['state']>) => void;
  onClickDetail: (device: SmartDevice) => void;
  onDeleteDevice?: (id: string) => void;
  onOpenAddRoomModal: () => void;
  onOpenRoomSettings?: (roomName: string) => void;
  onTurnOffRoom?: (roomName: string) => void;
  onTurnOnRoom?: (roomName: string) => void;
  onToggleChannel?: (device: SmartDevice, channelDp: string, nextValue?: boolean) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  'Home': <Home className="w-5 h-5" />,
  'Tv': <Tv className="w-5 h-5" />,
  'Utensils': <Utensils className="w-5 h-5" />,
  'Bed': <Bed className="w-5 h-5" />,
  'Bath': <Bath className="w-5 h-5" />,
  'Monitor': <Monitor className="w-5 h-5" />,
  'DoorOpen': <DoorOpen className="w-5 h-5" />,
  'Trees': <Trees className="w-5 h-5" />,
  'Warehouse': <Warehouse className="w-5 h-5" />,
  'Coffee': <Coffee className="w-5 h-5" />,
  'Flame': <Flame className="w-5 h-5" />,
  'Waves': <Waves className="w-5 h-5" />,
  'Sun': <Sun className="w-5 h-5" />,
  'Dumbbell': <Dumbbell className="w-5 h-5" />,
  'Car': <Car className="w-5 h-5" />,
  'BookOpen': <BookOpen className="w-5 h-5" />,
  'Music': <Music className="w-5 h-5" />,
  'Wind': <Wind className="w-5 h-5" />,
  'Shield': <Shield className="w-5 h-5" />,
  'Sparkles': <Sparkles className="w-5 h-5" />,
};

const DEFAULT_ROOM_ICONS: Record<string, React.ReactNode> = {
  'Salotto': <Tv className="w-5 h-5" />,
  'Cucina': <Utensils className="w-5 h-5" />,
  'Camera da Letto': <Bed className="w-5 h-5" />,
  'Bagno': <Bath className="w-5 h-5" />,
  'Studio': <Monitor className="w-5 h-5" />,
  'Ingresso': <DoorOpen className="w-5 h-5" />,
  'Giardino': <Trees className="w-5 h-5" />,
  'Garage': <Warehouse className="w-5 h-5" />,
};

export const RoomsTab: React.FC<RoomsTabProps> = ({
  devices,
  customRooms = [],
  deletedRooms = [],
  roomConfigs = {},
  roomOrder = [],
  onReorderRooms,
  onDeleteRoom,
  onTogglePower,
  onUpdateState,
  onClickDetail,
  onDeleteDevice,
  onOpenAddRoomModal,
  onOpenRoomSettings,
  onTurnOffRoom,
  onTurnOnRoom,
  onToggleChannel,
}) => {
  // Aggregate and sort all unique room names (excluding deleted rooms)
  const allRooms = React.useMemo(() => {
    const base = ['Salotto', 'Cucina', 'Camera da Letto', 'Bagno', 'Studio', 'Ingresso', 'Giardino', 'Garage'];
    const fromDevices = devices.map((d) => d.room).filter(Boolean);
    const combined = Array.from(new Set([...base, ...customRooms, ...fromDevices]));
    const filtered = combined.filter((r) => !deletedRooms.includes(r));

    if (!roomOrder || roomOrder.length === 0) return filtered;

    return filtered.sort((a, b) => {
      const idxA = roomOrder.indexOf(a);
      const idxB = roomOrder.indexOf(b);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [devices, customRooms, deletedRooms, roomOrder]);

  const [activeRoomView, setActiveRoomView] = useState<string | 'all'>('all');
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right'>('left');
  const [roomToDeleteConfirm, setRoomToDeleteConfirm] = useState<string | null>(null);

  // Drag and Drop state for Room cards
  const [draggedRoom, setDraggedRoom] = useState<string | null>(null);
  const [dragOverRoom, setDragOverRoom] = useState<string | null>(null);

  // Touch Swipe for Rooms Tab
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      if (deltaX < 0) {
        // Swipe Left -> Next room
        setSwipeDirection('left');
        if (activeRoomView === 'all') {
          if (allRooms.length > 0) setActiveRoomView(allRooms[0]);
        } else {
          const currentIdx = allRooms.indexOf(activeRoomView);
          if (currentIdx < allRooms.length - 1) {
            setActiveRoomView(allRooms[currentIdx + 1]);
          } else {
            setActiveRoomView('all');
          }
        }
      } else {
        // Swipe Right -> Prev room
        setSwipeDirection('right');
        if (activeRoomView === 'all') {
          if (allRooms.length > 0) setActiveRoomView(allRooms[allRooms.length - 1]);
        } else {
          const currentIdx = allRooms.indexOf(activeRoomView);
          if (currentIdx > 0) {
            setActiveRoomView(allRooms[currentIdx - 1]);
          } else {
            setActiveRoomView('all');
          }
        }
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleMoveRoom = (roomName: string, direction: 'left' | 'right') => {
    const currentList = [...allRooms];
    const index = currentList.indexOf(roomName);
    if (index === -1) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const [item] = currentList.splice(index, 1);
    currentList.splice(targetIndex, 0, item);
    onReorderRooms?.(currentList);
  };

  const handleRoomDragStart = (e: React.DragEvent, roomName: string) => {
    setDraggedRoom(roomName);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', roomName);
  };

  const handleRoomDragOver = (e: React.DragEvent, roomName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRoom !== roomName) {
      setDragOverRoom(roomName);
    }
  };

  const handleRoomDragLeave = (e: React.DragEvent, roomName: string) => {
    if (dragOverRoom === roomName) {
      setDragOverRoom(null);
    }
  };

  const handleRoomDrop = (e: React.DragEvent, targetRoom: string) => {
    e.preventDefault();
    const sourceRoom = draggedRoom || e.dataTransfer.getData('text/plain');
    if (!sourceRoom || sourceRoom === targetRoom) {
      setDraggedRoom(null);
      setDragOverRoom(null);
      return;
    }

    const currentList = [...allRooms];
    const sourceIdx = currentList.indexOf(sourceRoom);
    const targetIdx = currentList.indexOf(targetRoom);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const [moved] = currentList.splice(sourceIdx, 1);
      currentList.splice(targetIdx, 0, moved);
      onReorderRooms?.(currentList);
    }

    setDraggedRoom(null);
    setDragOverRoom(null);
  };

  const handleConfirmDeleteRoom = () => {
    if (roomToDeleteConfirm && onDeleteRoom) {
      onDeleteRoom(roomToDeleteConfirm);
      if (activeRoomView === roomToDeleteConfirm) {
        setActiveRoomView('all');
      }
      setRoomToDeleteConfirm(null);
    }
  };

  const getRoomIcon = (name: string) => {
    if (roomConfigs[name]?.iconName && ICON_MAP[roomConfigs[name].iconName!]) {
      return ICON_MAP[roomConfigs[name].iconName!];
    }
    if (DEFAULT_ROOM_ICONS[name]) return DEFAULT_ROOM_ICONS[name];
    const lower = name.toLowerCase();
    if (lower.includes('cucina')) return <Utensils className="w-5 h-5" />;
    if (lower.includes('camera') || lower.includes('letto')) return <Bed className="w-5 h-5" />;
    if (lower.includes('bagno')) return <Bath className="w-5 h-5" />;
    if (lower.includes('salotto') || lower.includes('tv') || lower.includes('soggiorno')) return <Tv className="w-5 h-5" />;
    if (lower.includes('giardino') || lower.includes('terrazz')) return <Trees className="w-5 h-5" />;
    if (lower.includes('garage') || lower.includes('cantina') || lower.includes('box')) return <Warehouse className="w-5 h-5" />;
    if (lower.includes('studio') || lower.includes('ufficio') || lower.includes('pc')) return <Monitor className="w-5 h-5" />;
    if (lower.includes('balcone') || lower.includes('solarium')) return <Sun className="w-5 h-5" />;
    if (lower.includes('piscina') || lower.includes('spa')) return <Waves className="w-5 h-5" />;
    if (lower.includes('taverna') || lower.includes('camino')) return <Flame className="w-5 h-5" />;
    if (lower.includes('relax') || lower.includes('bar')) return <Coffee className="w-5 h-5" />;
    if (lower.includes('palestra')) return <Dumbbell className="w-5 h-5" />;
    return <Home className="w-5 h-5" />;
  };

  const getRoomStats = (roomName: string) => {
    const roomDevs = devices.filter((d) => d.room === roomName);
    const activeCount = roomDevs.filter(
      (d) => d.state.plug?.power || d.state.light?.power || d.state.thermostat?.power || !d.state.lock?.locked
    ).length;
    const roomWatts = roomDevs.reduce((sum, d) => {
      if (d.category === 'plug' && d.state.plug?.power) return sum + (d.state.plug.watts || 0);
      if (d.category === 'light' && d.state.light?.power) return sum + (d.state.light.brightness * 0.12);
      return sum;
    }, 0);
    const thermostat = roomDevs.find((d) => d.category === 'thermostat');
    const currentTemp = thermostat?.state.thermostat?.currentTemp;

    return {
      devices: roomDevs,
      totalCount: roomDevs.length,
      activeCount,
      roomWatts,
      currentTemp,
    };
  };

  const roomsToDisplay = activeRoomView === 'all' 
    ? allRooms 
    : allRooms.filter((r) => r === activeRoomView);

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="space-y-8 text-slate-100 touch-pan-y"
    >
      {/* Delete Confirmation Modal for Room Deletion */}
      {roomToDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#141923] border border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/20 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Elimina Stanza</h3>
                <p className="text-xs text-rose-200/80">Stanza: "{roomToDeleteConfirm}"</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Sei sicuro di voler eliminare la stanza <strong className="text-white">"{roomToDeleteConfirm}"</strong>?
              <br />
              <span className="text-amber-300 block mt-2 font-medium">
                I {devices.filter(d => d.room === roomToDeleteConfirm).length} dispositivi assegnati a questa stanza non verranno cancellati, ma spostati automaticamente su "Non assegnati" (Senza Stanza).
              </span>
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRoomToDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRoom}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Conferma ed Elimina</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apple Home Rooms Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/30 backdrop-blur-xl border border-white/10 p-4 rounded-[26px]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Stanze di Casa</h2>
            <p className="text-xs text-slate-400">
              Personalizza, riordina con Drag & Drop o frecce, ed elimina le stanze
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Swipe arrows for quick room cycling */}
          {activeRoomView !== 'all' && (
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/15">
              <button
                type="button"
                onClick={() => {
                  const idx = allRooms.indexOf(activeRoomView);
                  setSwipeDirection('right');
                  if (idx > 0) setActiveRoomView(allRooms[idx - 1]);
                  else setActiveRoomView(allRooms[allRooms.length - 1]);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
                title="Stanza precedente"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold px-1.5 text-amber-400">{activeRoomView}</span>
              <button
                type="button"
                onClick={() => {
                  const idx = allRooms.indexOf(activeRoomView);
                  setSwipeDirection('left');
                  if (idx < allRooms.length - 1) setActiveRoomView(allRooms[idx + 1]);
                  else setActiveRoomView(allRooms[0]);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
                title="Stanza successiva"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Room quick pill selector */}
          <button
            onClick={() => setActiveRoomView('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${
              activeRoomView === 'all'
                ? 'bg-white text-slate-950 border-white shadow-md'
                : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
            }`}
          >
            Tutte le Stanze
          </button>

          <button
            onClick={onOpenAddRoomModal}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer shadow-md shadow-amber-400/10"
          >
            <Plus className="w-4 h-4" />
            <span>Nuova Stanza</span>
          </button>
        </div>
      </div>

      {/* Room Quick Grid Selector / Reorder with Drag & Drop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {allRooms.map((roomName, idx) => {
          const stats = getRoomStats(roomName);
          const isSelected = activeRoomView === roomName;
          const isDragging = draggedRoom === roomName;
          const isDragOver = dragOverRoom === roomName;

          return (
            <div
              key={roomName}
              draggable={true}
              onDragStart={(e) => handleRoomDragStart(e, roomName)}
              onDragOver={(e) => handleRoomDragOver(e, roomName)}
              onDragLeave={(e) => handleRoomDragLeave(e, roomName)}
              onDrop={(e) => handleRoomDrop(e, roomName)}
              className={`relative group/pill transition-all duration-200 rounded-2xl ${
                isDragging ? 'opacity-40 scale-95 border-2 border-dashed border-amber-400' : ''
              } ${isDragOver ? 'ring-2 ring-amber-400 scale-105 shadow-xl z-20' : ''}`}
            >
              <button
                onClick={() => setActiveRoomView(isSelected ? 'all' : roomName)}
                className={`w-full p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-lg shadow-amber-400/20 scale-105'
                    : 'bg-black/25 hover:bg-black/40 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <div className={isSelected ? 'text-slate-950' : 'text-amber-400'}>
                  {getRoomIcon(roomName)}
                </div>
                <span className="text-xs font-bold truncate max-w-full">{roomName}</span>
                <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                  {stats.activeCount}/{stats.totalCount} attivi
                </span>
              </button>

              {/* Quick Shift Arrows on Room Card Selector */}
              <div className="absolute top-1 right-1 opacity-0 group-hover/pill:opacity-100 transition-opacity flex items-center gap-0.5 bg-black/80 rounded-lg p-0.5 border border-white/10 z-10">
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveRoom(roomName, 'left');
                    }}
                    className="p-1 text-slate-300 hover:text-amber-400 transition"
                    title="Sposta prima"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                )}
                {idx < allRooms.length - 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveRoom(roomName, 'right');
                    }}
                    className="p-1 text-slate-300 hover:text-amber-400 transition"
                    title="Sposta dopo"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Rooms Sections */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={activeRoomView}
          initial={{ opacity: 0, x: swipeDirection === 'left' ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: swipeDirection === 'left' ? -20 : 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="space-y-8"
        >
          {roomsToDisplay.map((roomName) => {
            const stats = getRoomStats(roomName);
            const roomConfig = roomConfigs[roomName];
            const wallpaper = roomConfig?.wallpaperUrl;
            const currentRoomIdx = allRooms.indexOf(roomName);
            const isDragging = draggedRoom === roomName;
            const isDragOver = dragOverRoom === roomName;

            return (
              <div
                key={roomName}
                draggable={true}
                onDragStart={(e) => handleRoomDragStart(e, roomName)}
                onDragOver={(e) => handleRoomDragOver(e, roomName)}
                onDragLeave={(e) => handleRoomDragLeave(e, roomName)}
                onDrop={(e) => handleRoomDrop(e, roomName)}
                className={`bg-black/30 backdrop-blur-xl border border-white/15 rounded-[28px] p-5 sm:p-6 space-y-4 shadow-xl relative overflow-hidden group/card transition-all duration-200 ${
                  isDragging ? 'opacity-40 scale-[0.98] border-2 border-dashed border-amber-400' : ''
                } ${isDragOver ? 'ring-2 ring-amber-400 scale-[1.01] shadow-2xl z-20' : ''}`}
              >
                {/* Optional Room Wallpaper Background Layer */}
                {wallpaper && (
                  <>
                    <div 
                      className="absolute inset-0 bg-cover bg-center opacity-25 group-hover/card:opacity-35 transition-opacity duration-300 pointer-events-none scale-105"
                      style={{ backgroundImage: `url(${wallpaper})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/50 pointer-events-none" />
                  </>
                )}

                {/* Room Card Top Header */}
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    {/* Drag Handle for Room Card */}
                    <div 
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-amber-400 cursor-grab active:cursor-grabbing transition"
                      title="Trascina per riordinare la stanza"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="p-2.5 rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-400">
                      {getRoomIcon(roomName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black text-white">{roomName}</h3>
                        <span className="text-[11px] font-mono bg-white/10 px-2.5 py-0.5 rounded-full text-slate-300 border border-white/10">
                          {stats.totalCount} Dispositivi
                        </span>
                        {wallpaper && (
                          <span className="text-[10px] font-mono bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                            Sfondo Dedicato
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 text-amber-300">
                          <SunMedium className="w-3.5 h-3.5 text-amber-400" />
                          {stats.activeCount} attivi
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-emerald-400 font-mono">
                          <Zap className="w-3.5 h-3.5" />
                          {stats.roomWatts.toFixed(0)} W
                        </span>
                        {stats.currentTemp && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-sky-400 font-mono">
                              <Thermometer className="w-3.5 h-3.5" />
                              {stats.currentTemp}°C
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Batch Actions, Reordering & Deletion for Room */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                    {/* Move Room Left / Right Arrows */}
                    <div className="flex items-center bg-black/40 rounded-full border border-white/15 p-0.5 mr-1">
                      <button
                        type="button"
                        onClick={() => handleMoveRoom(roomName, 'left')}
                        disabled={currentRoomIdx === 0}
                        className={`p-1.5 rounded-full transition cursor-pointer ${
                          currentRoomIdx === 0
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                        title="Sposta stanza prima (a sinistra / su)"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveRoom(roomName, 'right')}
                        disabled={currentRoomIdx === allRooms.length - 1}
                        className={`p-1.5 rounded-full transition cursor-pointer ${
                          currentRoomIdx === allRooms.length - 1
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                        title="Sposta stanza dopo (a destra / giù)"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {onOpenRoomSettings && (
                      <button
                        onClick={() => onOpenRoomSettings(roomName)}
                        className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-amber-300 text-xs font-semibold border border-white/15 transition cursor-pointer flex items-center gap-1.5"
                        title="Personalizza sfondo, icona o dispositivi di questa stanza"
                      >
                        <Sliders className="w-3.5 h-3.5 text-amber-400" />
                        <span>Personalizza</span>
                      </button>
                    )}

                    {onTurnOnRoom && (
                      <button
                        onClick={() => onTurnOnRoom(roomName)}
                        className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition cursor-pointer"
                      >
                        Accendi Tutto
                      </button>
                    )}

                    {onTurnOffRoom && (
                      <button
                        onClick={() => onTurnOffRoom(roomName)}
                        className="px-3 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold border border-rose-500/30 transition cursor-pointer"
                      >
                        Spegni Tutto
                      </button>
                    )}

                    {/* Direct Room Delete Button */}
                    <button
                      type="button"
                      onClick={() => setRoomToDeleteConfirm(roomName)}
                      className="p-2 rounded-full bg-rose-600/15 hover:bg-rose-600/30 text-rose-300 hover:text-rose-200 border border-rose-500/30 transition cursor-pointer"
                      title="Elimina questa stanza"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Device Cards Grid for this Room */}
                <div className="relative z-10">
                  {stats.devices.length === 0 ? (
                    <div className="py-8 text-center bg-black/30 rounded-2xl border border-dashed border-white/10">
                      <p className="text-xs text-slate-400">Nessun dispositivo assegnato a questa stanza.</p>
                      {onOpenRoomSettings && (
                        <button
                          onClick={() => onOpenRoomSettings(roomName)}
                          className="mt-2 text-xs text-amber-400 hover:underline font-semibold"
                        >
                          Assegna dispositivi o modifica stanza →
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {stats.devices.map((dev) => {
                        const isWide = isWideDeviceCard(dev);
                        return (
                          <div key={dev.id} className={isWide ? 'col-span-full' : ''}>
                            <DeviceCard
                              device={dev}
                              onTogglePower={onTogglePower}
                              onUpdateState={onUpdateState}
                              onClickDetail={onClickDetail}
                              onDeleteDevice={onDeleteDevice}
                              onToggleChannel={onToggleChannel}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
