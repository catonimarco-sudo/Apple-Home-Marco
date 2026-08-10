import React, { useState } from 'react';
import { SmartDevice, RoomName, DeviceCategory } from '../types';
import { X, Plus, Zap, SunMedium, Thermometer, Camera, Lock, Volume2, ShieldAlert, Sliders } from 'lucide-react';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDevice: (newDevice: SmartDevice) => void;
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({
  isOpen,
  onClose,
  onAddDevice,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<DeviceCategory>('plug');
  const [room, setRoom] = useState<RoomName>('Salotto');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newDev: SmartDevice = {
      id: `dev-manual-${Date.now()}`,
      tuyaDeviceId: `tuya_manual_${Math.random().toString(36).substring(2, 8)}`,
      name,
      category,
      room,
      vendor: 'Smart Life (Tuya)',
      isOnline: true,
      signalStrength: -55,
      transferredFromSmartLife: false,
      state: {
        plug: category === 'plug' ? { power: true, watts: 45, voltage: 230, current: 0.2, totalKwh: 1.2 } : undefined,
        light: category === 'light' ? { power: true, brightness: 80, color: '#3b82f6', colorTemp: 4000, mode: 'color' } : undefined,
        thermostat: category === 'thermostat' ? { power: true, currentTemp: 21.0, targetTemp: 22.0, humidity: 50, mode: 'heat', fanSpeed: 'auto' } : undefined,
      },
    };

    onAddDevice(newDev);
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-[#121214] border border-white/5 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl text-slate-100"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-400" />
            <span>Aggiungi Nuovo Dispositivo</span>
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-bold block mb-1">Nome Dispositivo</label>
            <input
              type="text"
              required
              placeholder="es. Luce Scrivania, Presa TV"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-white/10 px-3 py-2 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">Categoria Hardware</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DeviceCategory)}
              className="w-full bg-[#0A0A0B] border border-white/10 px-3 py-2 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="plug">Presa Intelligente / Relay</option>
              <option value="light">Luce / Lampadina / Strip LED RGB</option>
              <option value="thermostat">Termostato / Caldaia / Clima</option>
              <option value="camera">Telecamera HD / Videosorveglianza</option>
              <option value="lock">Serratura Smart / Controllo Accessi</option>
              <option value="sensor">Sensore Movimento / Porta / Allagamento</option>
              <option value="vacuum">Robot Aspirapolvere</option>
              <option value="curtains">Tapparella / Tenda Motorizzata</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-bold block mb-1">Assegna alla Stanza</label>
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value as RoomName)}
              className="w-full bg-[#0A0A0B] border border-white/10 px-3 py-2 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="Salotto">Salotto</option>
              <option value="Cucina">Cucina</option>
              <option value="Camera da Letto">Camera da Letto</option>
              <option value="Bagno">Bagno</option>
              <option value="Studio">Studio</option>
              <option value="Ingresso">Ingresso</option>
              <option value="Giardino">Giardino</option>
              <option value="Garage">Garage</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-5 py-2 rounded-xl cursor-pointer"
          >
            Aggiungi Dispositivo
          </button>
        </div>
      </form>
    </div>
  );
};
