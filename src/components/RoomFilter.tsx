import React from 'react';
import { RoomName, SmartDevice } from '../types';
import { LayoutGrid, Tv, Utensils, Bed, Bath, Trees, Warehouse, Monitor, DoorOpen } from 'lucide-react';

interface RoomFilterProps {
  selectedRoom: RoomName | 'Tutti';
  onSelectRoom: (room: RoomName | 'Tutti') => void;
  devices: SmartDevice[];
}

const ROOM_LIST: { name: RoomName | 'Tutti'; icon: React.ReactNode }[] = [
  { name: 'Tutti', icon: <LayoutGrid className="w-4 h-4" /> },
  { name: 'Salotto', icon: <Tv className="w-4 h-4" /> },
  { name: 'Cucina', icon: <Utensils className="w-4 h-4" /> },
  { name: 'Camera da Letto', icon: <Bed className="w-4 h-4" /> },
  { name: 'Bagno', icon: <Bath className="w-4 h-4" /> },
  { name: 'Studio', icon: <Monitor className="w-4 h-4" /> },
  { name: 'Ingresso', icon: <DoorOpen className="w-4 h-4" /> },
  { name: 'Giardino', icon: <Trees className="w-4 h-4" /> },
  { name: 'Garage', icon: <Warehouse className="w-4 h-4" /> },
];

export const RoomFilter: React.FC<RoomFilterProps> = ({
  selectedRoom,
  onSelectRoom,
  devices,
}) => {
  const getRoomCount = (roomName: RoomName | 'Tutti') => {
    if (roomName === 'Tutti') return devices.length;
    return devices.filter((d) => d.room === roomName).length;
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar select-none">
      {ROOM_LIST.map((r) => {
        const count = getRoomCount(r.name);
        const isSelected = selectedRoom === r.name;

        return (
          <button
            key={r.name}
            onClick={() => onSelectRoom(r.name)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap shadow-sm border ${
              isSelected
                ? 'bg-white text-gray-900 border-white/60 shadow-md font-bold scale-[1.02]'
                : 'bg-emerald-100/60 hover:bg-emerald-100/80 text-emerald-950 border-white/20 backdrop-blur-md'
            }`}
          >
            {r.icon}
            <span>{r.name}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isSelected
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-emerald-800/10 text-emerald-900'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

