import React, { useRef } from 'react';
import { RoomName, SmartDevice } from '../types';
import { 
  LayoutGrid, 
  Tv, 
  Utensils, 
  Bed, 
  Bath, 
  Trees, 
  Warehouse, 
  Monitor, 
  DoorOpen, 
  Plus, 
  Home, 
  Coffee, 
  Flame, 
  Waves, 
  Sun,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface RoomFilterProps {
  selectedRoom: RoomName | 'Tutti';
  onSelectRoom: (room: RoomName | 'Tutti') => void;
  devices: SmartDevice[];
  customRooms?: string[];
  onOpenAddRoomModal?: () => void;
}

const DEFAULT_ROOM_ICONS: Record<string, React.ReactNode> = {
  'Tutti': <LayoutGrid className="w-4 h-4" />,
  'Salotto': <Tv className="w-4 h-4" />,
  'Cucina': <Utensils className="w-4 h-4" />,
  'Camera da Letto': <Bed className="w-4 h-4" />,
  'Bagno': <Bath className="w-4 h-4" />,
  'Studio': <Monitor className="w-4 h-4" />,
  'Ingresso': <DoorOpen className="w-4 h-4" />,
  'Giardino': <Trees className="w-4 h-4" />,
  'Garage': <Warehouse className="w-4 h-4" />,
};

export const RoomFilter: React.FC<RoomFilterProps> = ({
  selectedRoom,
  onSelectRoom,
  devices,
  customRooms = [],
  onOpenAddRoomModal,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Aggregate all unique room names from default, custom, and devices
  const allRooms = React.useMemo(() => {
    const base = ['Tutti', 'Salotto', 'Cucina', 'Camera da Letto', 'Bagno', 'Studio', 'Ingresso', 'Giardino', 'Garage'];
    const fromDevices = devices.map((d) => d.room).filter(Boolean);
    const combined = Array.from(new Set([...base, ...customRooms, ...fromDevices]));
    return combined;
  }, [devices, customRooms]);

  const getRoomCount = (roomName: string) => {
    if (roomName === 'Tutti') return devices.length;
    return devices.filter((d) => d.room === roomName).length;
  };

  const getRoomIcon = (name: string) => {
    if (DEFAULT_ROOM_ICONS[name]) return DEFAULT_ROOM_ICONS[name];
    const lower = name.toLowerCase();
    if (lower.includes('cucina')) return <Utensils className="w-4 h-4" />;
    if (lower.includes('camera') || lower.includes('letto')) return <Bed className="w-4 h-4" />;
    if (lower.includes('bagno')) return <Bath className="w-4 h-4" />;
    if (lower.includes('salotto') || lower.includes('tv') || lower.includes('soggiorno')) return <Tv className="w-4 h-4" />;
    if (lower.includes('giardino') || lower.includes('terrazz')) return <Trees className="w-4 h-4" />;
    if (lower.includes('garage') || lower.includes('cantina')) return <Warehouse className="w-4 h-4" />;
    if (lower.includes('studio') || lower.includes('ufficio')) return <Monitor className="w-4 h-4" />;
    if (lower.includes('balcone')) return <Sun className="w-4 h-4" />;
    if (lower.includes('piscina')) return <Waves className="w-4 h-4" />;
    if (lower.includes('taverna')) return <Flame className="w-4 h-4" />;
    if (lower.includes('relax')) return <Coffee className="w-4 h-4" />;
    return <Home className="w-4 h-4" />;
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative flex items-center gap-1.5 w-full">
      {/* Scroll Left Button */}
      <button
        type="button"
        onClick={() => handleScroll('left')}
        className="p-2 rounded-full bg-black/40 hover:bg-black/80 text-slate-300 hover:text-white border border-white/15 backdrop-blur-md transition-all cursor-pointer shadow-md flex-shrink-0 hover:border-amber-400/50 hover:scale-105 active:scale-95 z-10"
        title="Scorri stanze a sinistra"
        aria-label="Scorri stanze a sinistra"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Scrollable Rooms Bar */}
      <div 
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar select-none scroll-smooth flex-1"
      >
        {allRooms.map((roomName) => {
          const count = getRoomCount(roomName);
          const isSelected = selectedRoom === roomName;

          return (
            <button
              key={roomName}
              onClick={() => onSelectRoom(roomName)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap border flex-shrink-0 ${
                isSelected
                  ? 'bg-white text-slate-950 border-white font-bold shadow-lg shadow-white/10 scale-[1.02]'
                  : 'bg-black/30 hover:bg-black/45 text-slate-200 border-white/15 backdrop-blur-md hover:border-white/25'
              }`}
            >
              <span className={isSelected ? 'text-amber-500' : 'text-slate-300'}>
                {getRoomIcon(roomName)}
              </span>
              <span>{roomName}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-white/10 text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        {onOpenAddRoomModal && (
          <button
            onClick={onOpenAddRoomModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 transition cursor-pointer whitespace-nowrap shadow-sm flex-shrink-0"
            title="Aggiungi una nuova stanza"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova Stanza</span>
          </button>
        )}
      </div>

      {/* Scroll Right Button */}
      <button
        type="button"
        onClick={() => handleScroll('right')}
        className="p-2 rounded-full bg-black/40 hover:bg-black/80 text-slate-300 hover:text-white border border-white/15 backdrop-blur-md transition-all cursor-pointer shadow-md flex-shrink-0 hover:border-amber-400/50 hover:scale-105 active:scale-95 z-10"
        title="Scorri stanze a destra"
        aria-label="Scorri stanze a destra"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

