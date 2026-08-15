import React, { useState } from 'react';
import { SmartDevice, DeviceSchedule } from '../types';
import {
  Clock,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Power,
  ChevronRight,
  Shuffle,
  Timer,
  Repeat,
  Sparkles,
  Zap,
  Info,
} from 'lucide-react';

interface DeviceScheduleSectionProps {
  device: SmartDevice;
  onUpdateSchedules: (schedules: DeviceSchedule[]) => void;
  onToggleChannel?: (device: SmartDevice, channelDp: string, nextValue?: boolean) => void;
  onTogglePower?: (device: SmartDevice) => void;
}

const ALL_DAYS = [
  { id: 'Lun', label: 'Lun', full: 'Lunedì' },
  { id: 'Mar', label: 'Mar', full: 'Martedì' },
  { id: 'Mer', label: 'Mer', full: 'Mercoledì' },
  { id: 'Gio', label: 'Gio', full: 'Giovedì' },
  { id: 'Ven', label: 'Ven', full: 'Venerdì' },
  { id: 'Sab', label: 'Sab', full: 'Sabato' },
  { id: 'Dom', label: 'Dom', full: 'Domenica' },
];

export const DeviceScheduleSection: React.FC<DeviceScheduleSectionProps> = ({
  device,
  onUpdateSchedules,
}) => {
  // Top Smart Life sub-menu tab selection
  const [smartLifeSubTab, setSmartLifeSubTab] = useState<'countdown' | 'schedule' | 'circulate' | 'random' | 'inching'>('schedule');

  // Countdown specific state
  const [countdownMinutes, setCountdownMinutes] = useState<number>(15);
  const [countdownTargetPower, setCountdownTargetPower] = useState<boolean>(false);
  const [countdownChannel, setCountdownChannel] = useState<string>('switch_1');
  const [countdownActive, setCountdownActive] = useState<boolean>(false);

  // Inching specific state
  const [inchingEnabled, setInchingEnabled] = useState<boolean>(false);
  const [inchingSeconds, setInchingSeconds] = useState<number>(2);

  // Add Schedule Modal / Form state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  // Form fields
  const [timeValue, setTimeValue] = useState<string>('07:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']);
  const [targetAction, setTargetAction] = useState<boolean>(true); // true = ON, false = OFF
  const [targetChannel, setTargetChannel] = useState<string>('switch_1');
  const [customLabel, setCustomLabel] = useState<string>('');

  const schedules: DeviceSchedule[] = device.schedules || [];

  // Determine available channels for this device
  const is4ChannelRelay =
    device.category === 'switch' &&
    (device.name.toLowerCase().includes('irrigaz') ||
      device.name.toLowerCase().includes('solenoide') ||
      device.customIcon === 'droplet' ||
      device.customIcon === 'irrigation' ||
      Boolean(device.state.switch?.gangs && device.state.switch.gangs.length >= 4));

  const availableChannels = is4ChannelRelay
    ? [
        { dp: 'switch_1', name: 'Canale 1 - Lato Cancellone' },
        { dp: 'switch_2', name: 'Canale 2 - Centrale' },
        { dp: 'switch_3', name: 'Canale 3 - Lato Cancelletto' },
        { dp: 'switch_4', name: 'Canale 4 - Switch 4' },
      ]
    : [
        { dp: device.channel || device.dpCode || 'switch_1', name: 'Interruttore / Presa Principale' },
      ];

  const handleToggleSchedule = (id: string, currentEnabled: boolean) => {
    const updated = schedules.map((sc) =>
      sc.id === id ? { ...sc, enabled: !currentEnabled } : sc
    );
    onUpdateSchedules(updated);
  };

  const handleDeleteSchedule = (id: string) => {
    const updated = schedules.filter((sc) => sc.id !== id);
    onUpdateSchedules(updated);
  };

  const handleOpenAdd = () => {
    setEditingScheduleId(null);
    setTimeValue('07:00');
    setSelectedDays(['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']);
    setTargetAction(true);
    setTargetChannel(availableChannels[0]?.dp || 'switch_1');
    setCustomLabel('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (sc: DeviceSchedule) => {
    setEditingScheduleId(sc.id);
    setTimeValue(sc.time);
    setSelectedDays(sc.days);
    setTargetAction(sc.action);
    setTargetChannel(sc.channel || availableChannels[0]?.dp || 'switch_1');
    setCustomLabel(sc.label || '');
    setIsAddModalOpen(true);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeValue) return;

    if (editingScheduleId) {
      const updated = schedules.map((sc) =>
        sc.id === editingScheduleId
          ? {
              ...sc,
              time: timeValue,
              days: selectedDays.length > 0 ? selectedDays : ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
              action: targetAction,
              channel: targetChannel,
              label: customLabel || undefined,
            }
          : sc
      );
      onUpdateSchedules(updated);
    } else {
      const newSchedule: DeviceSchedule = {
        id: `sched-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        deviceId: device.id,
        time: timeValue,
        days: selectedDays.length > 0 ? selectedDays : ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
        action: targetAction,
        enabled: true,
        channel: targetChannel,
        label: customLabel || undefined,
      };
      onUpdateSchedules([...schedules, newSchedule]);
    }

    setIsAddModalOpen(false);
    setEditingScheduleId(null);
  };

  const toggleDay = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const getDaysSummary = (days: string[]) => {
    if (!days || days.length === 0 || days.length === 7) return 'Ogni Giorno (Everyday)';
    if (days.length === 5 && !days.includes('Sab') && !days.includes('Dom')) return 'Lun - Ven (Giorni feriali)';
    if (days.length === 2 && days.includes('Sab') && days.includes('Dom')) return 'Weekend (Sab - Dom)';
    return days.join(', ');
  };

  const getChannelName = (dpCode?: string) => {
    if (!dpCode) return 'Principale';
    const found = availableChannels.find((ch) => ch.dp === dpCode);
    return found ? found.name : dpCode;
  };

  return (
    <div className="space-y-4">
      {/* Top Smart Life Sub-Tabs Navigation Bar */}
      <div className="bg-[#0A0A0B] p-1.5 rounded-2xl border border-white/5 flex items-center justify-between overflow-x-auto gap-1 scrollbar-none">
        {[
          { id: 'countdown', label: 'Countdown', icon: Timer },
          { id: 'schedule', label: 'Schedule', icon: Clock, badge: schedules.length > 0 ? schedules.length : undefined },
          { id: 'circulate', label: 'Circulate', icon: Repeat },
          { id: 'random', label: 'Random', icon: Shuffle },
          { id: 'inching', label: 'Inching', icon: Zap },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = smartLifeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSmartLifeSubTab(tab.id as any)}
              className={`flex-1 min-w-[76px] py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-slate-950 text-cyan-400' : 'bg-cyan-500/20 text-cyan-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SCHEDULE VIEW (ACTIVE DEFAULT) */}
      {smartLifeSubTab === 'schedule' && (
        <div className="space-y-4">
          {/* Header Info & Add Button */}
          <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">Programmazioni Orarie e Timer</h4>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {is4ChannelRelay
                  ? 'Gestisci le accensioni e gli spegnimenti automatici per le 4 zone di irrigazione.'
                  : 'Pianifica le fasce orarie di accensione o spegnimento automatico del dispositivo.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Schedule</span>
            </button>
          </div>

          {/* Schedule List */}
          {schedules.length === 0 ? (
            <div className="bg-[#0A0A0B] p-8 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h5 className="text-sm font-bold text-white mb-1">Nessuna Programmazione Attiva</h5>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Crea una programmazione oraria per automatizzare l'accensione o lo spegnimento di questo dispositivo o dei singoli canali relè.
              </p>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="bg-white/10 hover:bg-white/15 text-white font-bold text-xs px-4 py-2 rounded-xl transition border border-white/10 flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Crea la prima programmazione</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {schedules.map((sc) => {
                const isActionOn = sc.action;
                return (
                  <div
                    key={sc.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      sc.enabled
                        ? 'bg-[#0f171d] border-cyan-500/30 text-white'
                        : 'bg-[#0A0A0B] border-white/5 text-slate-400 opacity-60'
                    }`}
                  >
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => handleOpenEdit(sc)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-2xl font-black tracking-tight text-white">
                          {sc.time}
                        </span>

                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                            isActionOn
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          <Power className="w-2.5 h-2.5" />
                          <span>{isActionOn ? 'Accendi (ON)' : 'Spegni (OFF)'}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                        <span className="text-slate-300 font-medium flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{getDaysSummary(sc.days)}</span>
                        </span>

                        {is4ChannelRelay && (
                          <span className="text-cyan-300 font-bold bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.2 rounded-md font-mono text-[10px] flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            <span>{getChannelName(sc.channel)}</span>
                          </span>
                        )}

                        {sc.label && (
                          <span className="text-slate-400 italic text-[11px]">
                            • {sc.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Toggle and Delete Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Switch toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleSchedule(sc.id, sc.enabled)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                          sc.enabled ? 'bg-cyan-500' : 'bg-white/10'
                        }`}
                        title={sc.enabled ? 'Disattiva programmazione' : 'Attiva programmazione'}
                      >
                        <div
                          className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            sc.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSchedule(sc.id)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                        title="Elimina programmazione"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* COUNTDOWN VIEW */}
      {smartLifeSubTab === 'countdown' && (
        <div className="bg-[#0A0A0B] p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Conto alla Rovescia (Countdown)</h4>
              <p className="text-xs text-slate-400">
                Esegue l'azione specificata al termine del tempo impostato.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Durata (Minuti)</label>
              <input
                type="number"
                min="1"
                max="720"
                value={countdownMinutes}
                onChange={(e) => setCountdownMinutes(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#121214] border border-white/10 text-white font-mono text-center px-3 py-2.5 rounded-xl focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Azione al Termine</label>
              <select
                value={countdownTargetPower ? 'on' : 'off'}
                onChange={(e) => setCountdownTargetPower(e.target.value === 'on')}
                className="w-full bg-[#121214] border border-white/10 text-white px-3 py-2.5 rounded-xl focus:border-cyan-500 focus:outline-none cursor-pointer text-xs"
              >
                <option value="off">Spegni (Power OFF)</option>
                <option value="on">Accendi (Power ON)</option>
              </select>
            </div>

            {is4ChannelRelay && (
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Canale Target</label>
                <select
                  value={countdownChannel}
                  onChange={(e) => setCountdownChannel(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 text-white px-3 py-2.5 rounded-xl focus:border-cyan-500 focus:outline-none cursor-pointer text-xs"
                >
                  {availableChannels.map((ch) => (
                    <option key={ch.dp} value={ch.dp}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCountdownActive(!countdownActive)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition flex items-center gap-2 ${
                countdownActive
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20'
              }`}
            >
              <Timer className="w-4 h-4" />
              <span>{countdownActive ? 'Annulla Conto alla Rovescia' : 'Avvia Countdown'}</span>
            </button>

            {countdownActive && (
              <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-500/30 px-3 py-1.5 rounded-xl">
                ⏳ In esecuzione: {countdownMinutes}:00 restanti
              </span>
            )}
          </div>
        </div>
      )}

      {/* CIRCULATE VIEW */}
      {smartLifeSubTab === 'circulate' && (
        <div className="bg-[#0A0A0B] p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Modalità Circolazione (Circulate)</h4>
              <p className="text-xs text-slate-400">
                Alterna ciclicamente periodi di accensione (ON) e periodi di spegnimento (OFF).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
              <label className="font-bold text-emerald-400 block">Tempo di Accensione (ON Duration)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={10}
                  min={1}
                  className="w-20 bg-[#121214] border border-white/10 text-white font-mono text-center px-2 py-1.5 rounded-lg"
                />
                <span className="text-slate-300">Minuti</span>
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
              <label className="font-bold text-rose-400 block">Tempo di Spegnimento (OFF Duration)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={30}
                  min={1}
                  className="w-20 bg-[#121214] border border-white/10 text-white font-mono text-center px-2 py-1.5 rounded-lg"
                />
                <span className="text-slate-300">Minuti</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-300 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>Ideale per l'irrigazione a cicli o ventilazione programmata continua.</span>
          </div>
        </div>
      )}

      {/* RANDOM VIEW */}
      {smartLifeSubTab === 'random' && (
        <div className="bg-[#0A0A0B] p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Modalità Casuale (Anti-Intrusione / Random)</h4>
              <p className="text-xs text-slate-400">
                Accende e spegne il dispositivo casualmente durante una fascia oraria per simulare presenza.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Dalle ore</label>
              <input
                type="time"
                defaultValue="20:00"
                className="w-full bg-[#121214] border border-white/10 text-white px-3 py-2 rounded-xl font-mono text-center"
              />
            </div>
            <div>
              <label className="font-bold text-slate-300 block mb-1">Alle ore</label>
              <input
                type="time"
                defaultValue="23:30"
                className="w-full bg-[#121214] border border-white/10 text-white px-3 py-2 rounded-xl font-mono text-center"
              />
            </div>
          </div>
        </div>
      )}

      {/* INCHING VIEW */}
      {smartLifeSubTab === 'inching' && (
        <div className="bg-[#0A0A0B] p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Modalità Inching (Auto-Spegnimento a Impulso)</h4>
                <p className="text-xs text-slate-400">
                  Spegne automaticamente il relè pochi secondi dopo ogni accensione manuale.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInchingEnabled(!inchingEnabled)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                inchingEnabled ? 'bg-cyan-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  inchingEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {inchingEnabled && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2 text-xs">
              <label className="font-bold text-slate-300 block">Tempo di Inching (Secondi)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={inchingSeconds}
                  onChange={(e) => setInchingSeconds(parseInt(e.target.value, 10) || 1)}
                  className="w-24 bg-[#121214] border border-white/10 text-white font-mono text-center px-3 py-2 rounded-xl"
                />
                <span className="text-slate-300">Secondi prima dell'auto-OFF</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT SCHEDULE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Clock className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">
                  {editingScheduleId ? 'Modifica Programmazione' : 'Nuova Programmazione (Add Schedule)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
              {/* 1. Time Selector */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">
                  1. Seleziona Orario (Ora : Minuti)
                </label>
                <input
                  type="time"
                  required
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  className="w-full bg-[#1a1a1e] border border-white/10 text-white font-mono text-2xl font-black text-center py-3 rounded-2xl focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* 2. Target Channel (if 4-channel switch) */}
              {is4ChannelRelay && (
                <div>
                  <label className="font-bold text-slate-300 block mb-1.5">
                    2. Canale Relè / Zona Target
                  </label>
                  <select
                    value={targetChannel}
                    onChange={(e) => setTargetChannel(e.target.value)}
                    className="w-full bg-[#1a1a1e] border border-white/10 text-white font-medium px-3 py-2.5 rounded-xl focus:border-cyan-500 focus:outline-none cursor-pointer"
                  >
                    {availableChannels.map((ch) => (
                      <option key={ch.dp} value={ch.dp}>
                        {ch.name} ({ch.dp})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 3. Desired State (ON / OFF) */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">
                  {is4ChannelRelay ? '3.' : '2.'} Azione Desiderata
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetAction(true)}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${
                      targetAction
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Power className="w-4 h-4 text-emerald-400" />
                    <span>Accendi (ON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAction(false)}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${
                      !targetAction
                        ? 'bg-rose-500/20 border-rose-400 text-rose-300 shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Power className="w-4 h-4 text-rose-400" />
                    <span>Spegni (OFF)</span>
                  </button>
                </div>
              </div>

              {/* 4. Repeat Days */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-300 block">
                    {is4ChannelRelay ? '4.' : '3.'} Ripetizione Giorni
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDays(['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'])}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      Tutti
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDays(['Lun', 'Mar', 'Mer', 'Gio', 'Ven'])}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      Lun-Ven
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {ALL_DAYS.map((d) => {
                    const isSelected = selectedDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                            : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5'
                        }`}
                        title={d.full}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Custom Label / Note (Optional) */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Etichetta Promemoria (Opzionale)
                </label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="es. Irrigazione Mattutina Prato"
                  className="w-full bg-[#1a1a1e] border border-white/10 text-white px-3 py-2 rounded-xl focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 font-bold cursor-pointer transition"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black cursor-pointer transition shadow-lg shadow-cyan-500/20"
                >
                  {editingScheduleId ? 'Salva Modifiche' : 'Crea Programmazione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
