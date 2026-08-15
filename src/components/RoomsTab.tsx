import React, { useState, useRef } from 'react';
import { SmartDevice, RoomName, RoomConfig } from '../types';
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
  Image as ImageIcon
} from 'lucide-react';

interface RoomsTabProps {
  devices: SmartDevice[];
  customRooms?: string[];
  deletedRooms?: string[];
  roomConfigs?: Record<string, RoomConfig>;
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
  // Aggregate all unique room names (excluding 'Tutti' and deleted rooms)
  const allRooms = React.useMemo(() => {
    const base = ['Salotto', 'Cucina', 'Camera da Letto', 'Bagno', 'Studio', 'Ingresso', 'Giardino', 'Garage'];
    const fromDevices = devices.map((d) => d.room).filter(Boolean);
    const combined = Array.from(new Set([...base, ...customRooms, ...fromDevices]));
    return combined.filter((r) => !deletedRooms.includes(r));
  }, [devices, customRooms, deletedRooms]);

  const [activeRoomView, setActiveRoomView] = useState<string | 'all'>('all');
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right'>('left');

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
      {/* Apple Home Rooms Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/30 backdrop-blur-xl border border-white/10 p-4 rounded-[26px]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Stanze di Casa</h2>
            <p className="text-xs text-slate-400">
              Visualizza e controlla ogni ambiente come in Apple Home
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

      {/* Room Quick Grid Selector if 'all' is selected */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {allRooms.map((roomName) => {
          const stats = getRoomStats(roomName);
          const isSelected = activeRoomView === roomName;
          return (
            <button
              key={roomName}
              onClick={() => setActiveRoomView(isSelected ? 'all' : roomName)}
              className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 border transition-all cursor-pointer ${
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

            return (
              <div
                key={roomName}
                className="bg-black/30 backdrop-blur-xl border border-white/15 rounded-[28px] p-5 sm:p-6 space-y-4 shadow-xl relative overflow-hidden group/card"
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
                    <div className="p-2.5 rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-400">
                      {getRoomIcon(roomName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
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

                  {/* Quick Batch Actions & Customization for Room */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {onOpenRoomSettings && (
                      <button
                        onClick={() => onOpenRoomSettings(roomName)}
                        className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-amber-300 text-xs font-semibold border border-white/15 transition cursor-pointer flex items-center gap-1.5"
                        title="Personalizza sfondo, icona o elimina questa stanza"
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
                      {stats.devices.map((dev) => (
                        <DeviceCard
                          key={dev.id}
                          device={dev}
                          onTogglePower={onTogglePower}
                          onUpdateState={onUpdateState}
                          onClickDetail={onClickDetail}
                          onDeleteDevice={onDeleteDevice}
                          onToggleChannel={onToggleChannel}
                        />
                      ))}
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
