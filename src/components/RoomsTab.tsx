import React, { useState } from 'react';
import { SmartDevice, RoomName } from '../types';
import { DeviceCard } from './DeviceCard';
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
  Sparkles,
  Layers,
  Edit3
} from 'lucide-react';

interface RoomsTabProps {
  devices: SmartDevice[];
  customRooms?: string[];
  onTogglePower: (device: SmartDevice) => void;
  onUpdateState: (deviceId: string, newState: Partial<SmartDevice['state']>) => void;
  onClickDetail: (device: SmartDevice) => void;
  onDeleteDevice?: (id: string) => void;
  onOpenAddRoomModal: () => void;
  onTurnOffRoom?: (roomName: string) => void;
  onTurnOnRoom?: (roomName: string) => void;
}

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
  onTogglePower,
  onUpdateState,
  onClickDetail,
  onDeleteDevice,
  onOpenAddRoomModal,
  onTurnOffRoom,
  onTurnOnRoom,
}) => {
  // Aggregate all unique room names (excluding 'Tutti')
  const allRooms = React.useMemo(() => {
    const base = ['Salotto', 'Cucina', 'Camera da Letto', 'Bagno', 'Studio', 'Ingresso', 'Giardino', 'Garage'];
    const fromDevices = devices.map((d) => d.room).filter(Boolean);
    const combined = Array.from(new Set([...base, ...customRooms, ...fromDevices]));
    return combined;
  }, [devices, customRooms]);

  const [activeRoomView, setActiveRoomView] = useState<string | 'all'>('all');

  const getRoomIcon = (name: string) => {
    if (DEFAULT_ROOM_ICONS[name]) return DEFAULT_ROOM_ICONS[name];
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
    <div className="space-y-8 text-slate-100">
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

        <div className="flex items-center gap-2">
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
      <div className="space-y-8">
        {roomsToDisplay.map((roomName) => {
          const stats = getRoomStats(roomName);

          return (
            <div
              key={roomName}
              className="bg-black/25 backdrop-blur-xl border border-white/10 rounded-[28px] p-5 sm:p-6 space-y-4 shadow-xl relative overflow-hidden"
            >
              {/* Room Card Top Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
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

                {/* Quick Batch Actions for Room */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
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
              {stats.devices.length === 0 ? (
                <div className="py-8 text-center bg-black/20 rounded-2xl border border-dashed border-white/10">
                  <p className="text-xs text-slate-400">Nessun dispositivo assegnato a questa stanza.</p>
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
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
