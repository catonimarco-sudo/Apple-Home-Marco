import React, { useState, useEffect, useRef } from 'react';
import { SmartDevice } from '../types';
import { getTuyaConfig, saveTuyaConfig, TuyaCameraConfig, requestTuyaWebRTCStream, startWebRTCStream } from '../tuyaConfig';
import { 
  X, 
  Power, 
  Zap, 
  Thermometer, 
  Camera, 
  Lock, 
  Unlock, 
  Sliders, 
  Clock, 
  Sparkles, 
  Settings, 
  Wifi, 
  Info, 
  Volume2,
  VolumeX,
  Maximize,
  Loader2, 
  ShieldCheck, 
  Play, 
  RotateCw, 
  Compass,
  CheckCircle2,
  Trash2,
  Edit3,
  Save,
  Check,
  Lightbulb,
  Fan,
  Wind,
  Plug,
  Key,
  Video,
  ChevronDown,
  Plus,
  Minus,
  Flame,
  Sun
} from 'lucide-react';

// Helper function to compress and resize custom uploaded icons to 300x300 max
const compressImageFile = (file: File, maxWidth = 300, maxHeight = 300): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve((event.target?.result as string) || '');
        }
      };
      img.onerror = () => resolve((event.target?.result as string) || '');
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

interface DeviceDetailModalProps {
  device: SmartDevice | null;
  onClose: () => void;
  onUpdateDevice: (updated: SmartDevice) => void;
  onDeleteDevice: (deviceId: string) => void;
  availableRooms?: string[];
  onTogglePower?: (device: SmartDevice) => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  device,
  onClose,
  onUpdateDevice,
  onDeleteDevice,
  availableRooms = [],
  onTogglePower,
}) => {
  const [activeTab, setActiveTab] = useState<'control' | 'edit' | 'schedule' | 'info'>('control');
  const [timerMinutes, setTimerMinutes] = useState<number>(30);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  
  // Editable Fields
  const [editName, setEditName] = useState<string>(device?.name || '');
  const [editRoom, setEditRoom] = useState<string>(device?.room || '');

  // Computed all known rooms
  const allKnownRooms = React.useMemo(() => {
    const defaults = ['Salotto', 'Cucina', 'Camera da Letto', 'Bagno', 'Studio', 'Ingresso', 'Giardino', 'Garage'];
    const list = Array.from(new Set([...defaults, ...availableRooms, device?.room || ''])).filter(Boolean);
    return list;
  }, [availableRooms, device?.room]);
  const [editCategory, setEditCategory] = useState<SmartDevice['category']>(device?.category || 'plug');
  const [editVendor, setEditVendor] = useState<string>(device?.vendor || '');
  const [editTuyaId, setEditTuyaId] = useState<string>(device?.tuyaDeviceId || '');
  const [editIp, setEditIp] = useState<string>(device?.ipAddress || '');
  const [editChannel, setEditChannel] = useState<string>(
    device?.channel || device?.dpCode || (device?.category === 'gate' || device?.category === 'pulsed_switch' ? 'switch_1' : 'switch_1')
  );
  const [editDpCodeCustom, setEditDpCodeCustom] = useState<string>(device?.dpCode || '');
  const [editCustomIcon, setEditCustomIcon] = useState<string>(device?.customIcon || '');
  const [editCustomImageUrl, setEditCustomImageUrl] = useState<string>(device?.customImageUrl || '');
  const [editCurrentTemp, setEditCurrentTemp] = useState<string>(() => {
    const cur = device?.state.thermostat?.currentTemp;
    if (cur !== undefined && cur !== null) {
      return (cur > 100 ? cur / 10 : cur).toString();
    }
    return '31.0';
  });
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Tuya WebRTC Credentials & Live Streaming State
  const [tuyaWebRTCConfig, setTuyaWebRTCConfig] = useState<TuyaCameraConfig>(() =>
    getTuyaConfig(device?.tuyaDeviceId || device?.id || '')
  );
  const [tuyaSavedSuccess, setTuyaSavedSuccess] = useState<boolean>(false);
  const [activeStreamUrl, setActiveStreamUrl] = useState<string>(() => {
    const cfg = getTuyaConfig(device?.tuyaDeviceId || device?.id || '');
    return cfg.streamUrl || '';
  });
  const [isFetchingStream, setIsFetchingStream] = useState<boolean>(false);
  const [streamStatusMsg, setStreamStatusMsg] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (device) {
      setEditName(device.name);
      setEditRoom(device.room);
      setEditCategory(device.category);
      setEditVendor(device.vendor);
      setEditTuyaId(device.tuyaDeviceId || '');
      setEditIp(device.ipAddress || '');
      setEditChannel(device.channel || device.dpCode || 'switch_1');
      setEditDpCodeCustom(device.dpCode || '');
      setEditCustomIcon(device.customIcon || '');
      setEditCustomImageUrl(device.customImageUrl || '');
      const cur = device.state.thermostat?.currentTemp;
      if (cur !== undefined && cur !== null) {
        setEditCurrentTemp((cur > 100 ? cur / 10 : cur).toString());
      } else {
        setEditCurrentTemp('31.0');
      }
      setShowDeleteConfirm(false);

      const devId = device.tuyaDeviceId || device.id;
      const cfg = getTuyaConfig(devId);
      if (!cfg.deviceId && devId) {
        cfg.deviceId = devId;
      }
      setTuyaWebRTCConfig(cfg);
      if (cfg.streamUrl) {
        setActiveStreamUrl(cfg.streamUrl);
      }
    }
  }, [device]);

  if (!device) return null;

  const handleFetchStreamFromBackend = async (configToUse?: TuyaCameraConfig) => {
    const cfg = configToUse || tuyaWebRTCConfig;
    setIsFetchingStream(true);
    setStreamStatusMsg('Chiamata in corso a /api/tuya-stream e negoziazione RTCPeerConnection...');
    
    try {
      const result = await requestTuyaWebRTCStream(cfg);
      if (result.success) {
        const streamUrl = result.streamUrl || 'webrtc-stream-active';
        setActiveStreamUrl(streamUrl);
        saveTuyaConfig({ ...cfg, streamUrl }, cfg.deviceId || device.id);

        setStreamStatusMsg(result.message || 'Sessione WebRTC creata con successo! Inizializzazione video...');
        setTuyaSavedSuccess(true);

        // Bind WebRTC tracks / media stream directly to the video element
        setTimeout(async () => {
          if (videoRef.current) {
            await startWebRTCStream(videoRef.current, result, device.name);
          }
        }, 100);

        setTimeout(() => setTuyaSavedSuccess(false), 3000);
      } else {
        setStreamStatusMsg(`Avviso: ${result.message}`);
      }
    } catch (err: any) {
      setStreamStatusMsg(`Errore durante la connessione a /api/tuya-stream: ${err?.message || String(err)}`);
    } finally {
      setIsFetchingStream(false);
    }
  };

  const handleSaveTuyaCredentials = async () => {
    const devId = tuyaWebRTCConfig.deviceId || device.tuyaDeviceId || device.id;
    saveTuyaConfig(tuyaWebRTCConfig, devId);

    // Update tuyaDeviceId on the device object
    if (onUpdateDevice && tuyaWebRTCConfig.deviceId) {
      onUpdateDevice({
        ...device,
        tuyaDeviceId: tuyaWebRTCConfig.deviceId,
      });
    }

    await handleFetchStreamFromBackend(tuyaWebRTCConfig);
  };

  const handleSaveFullEdit = () => {
    const finalChannel = editChannel || 'switch_1';
    const customDpTrimmed = editDpCodeCustom.trim();
    const finalDpCode = customDpTrimmed || finalChannel;

    let updatedState = { ...device.state };
    if (editCategory === 'thermostat' || device.category === 'thermostat') {
      const parsedCurrentTemp = parseFloat(editCurrentTemp) || 31.0;
      updatedState = {
        ...updatedState,
        thermostat: {
          ...(device.state.thermostat || { power: true, targetTemp: 22, humidity: 48, mode: 'heat', fanSpeed: 'auto' }),
          currentTemp: parsedCurrentTemp,
        },
      };
    }

    const updated: SmartDevice = {
      ...device,
      name: editName,
      room: editRoom,
      category: editCategory,
      vendor: editVendor,
      tuyaDeviceId: editTuyaId,
      ipAddress: editIp,
      customIcon: editCustomIcon || '',
      customImageUrl: editCustomImageUrl || '',
      channel: finalChannel,
      dpCode: finalDpCode,
      state: updatedState,
    };
    onUpdateDevice(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Quick State Handler
  const handleStateChange = (updatedPartial: Partial<SmartDevice['state']>) => {
    onUpdateDevice({
      ...device,
      state: {
        ...device.state,
        ...updatedPartial,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121214] border border-white/5 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              {device.category === 'plug' && <Zap className="w-5 h-5" />}
              {device.category === 'light' && <Lightbulb className="w-5 h-5 fill-current" />}
              {device.category === 'thermostat' && <Thermometer className="w-5 h-5" />}
              {device.category === 'camera' && <Camera className="w-5 h-5" />}
              {device.category === 'lock' && <Lock className="w-5 h-5" />}
              {device.category === 'vacuum' && <Volume2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{device.name}</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className="p-1 text-amber-400/80 hover:text-amber-300 hover:bg-amber-400/10 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                  title="Modifica Nome Dispositivo"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Modifica Nome</span>
                </button>
                {device.transferredFromSmartLife && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Smart Life Sync
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Stanza: {device.room} • Vendor: {device.vendor}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-white/5 bg-[#0A0A0B] px-5 gap-4">
          <button
            onClick={() => setActiveTab('control')}
            className={`py-3 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'control'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Controlli
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`py-3 text-xs font-bold border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === 'edit'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Modifica Parametri</span>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-3 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'schedule'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Timer & Programmazione
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`py-3 text-xs font-bold border-b-2 cursor-pointer transition ${
              activeTab === 'info'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Info Hardware
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {activeTab === 'control' && (
            <div className="space-y-6">
              {/* Plug Specifics */}
              {device.category === 'plug' && device.state.plug && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#0A0A0B] p-3.5 rounded-2xl border border-white/5 text-center">
                      <span className="text-xs text-slate-400 block">Potenza Attuale</span>
                      <span className="text-xl font-bold font-mono text-amber-400">
                        {device.state.plug.power ? `${device.state.plug.watts} W` : '0 W'}
                      </span>
                    </div>
                    <div className="bg-[#0A0A0B] p-3.5 rounded-2xl border border-white/5 text-center">
                      <span className="text-xs text-slate-400 block">Tensione (V)</span>
                      <span className="text-xl font-bold font-mono text-emerald-400">
                        {device.state.plug.voltage} V
                      </span>
                    </div>
                    <div className="bg-[#0A0A0B] p-3.5 rounded-2xl border border-white/5 text-center">
                      <span className="text-xs text-slate-400 block">Consumo Totale</span>
                      <span className="text-xl font-bold font-mono text-emerald-400">
                        {device.state.plug.totalKwh} kWh
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Alimentazione Presa</h4>
                      <p className="text-xs text-slate-400">Interruttore rele smart Tuya 16A</p>
                    </div>
                    <button
                      onClick={() =>
                        handleStateChange({
                          plug: { ...device.state.plug!, power: !device.state.plug?.power },
                        })
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        device.state.plug.power
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                      <span>{device.state.plug.power ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Light Specifics */}
              {device.category === 'light' && device.state.light && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 flex justify-between">
                      <span>Luminosità (%)</span>
                      <span className="text-emerald-400">{device.state.light.brightness}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={device.state.light.brightness}
                      onChange={(e) =>
                        handleStateChange({
                          light: {
                            ...device.state.light!,
                            brightness: parseInt(e.target.value, 10),
                            power: true,
                          },
                        })
                      }
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                  </div>

                  {/* Preset Colors */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">Tonalità e Colori RGB</label>
                    <div className="flex items-center gap-3">
                      {['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ffffff'].map((hex) => (
                        <button
                          key={hex}
                          onClick={() =>
                            handleStateChange({
                              light: { ...device.state.light!, color: hex, mode: 'color', power: true },
                            })
                          }
                          className="w-8 h-8 rounded-full border-2 border-white/10 hover:scale-110 transition cursor-pointer shadow-md"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Thermostat / Clima Controls */}
              {(device.category === 'thermostat' || device.name.toLowerCase().includes('termostato') || device.name.toLowerCase().includes('caldaia')) && (
                <div className="space-y-4">
                  {/* Temperatures Overview Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                        <Thermometer className="w-4 h-4 text-emerald-400" />
                        <span>Ambiente Reale</span>
                      </div>
                      <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                        {(() => {
                          const cur = device.state.thermostat?.currentTemp;
                          if (cur !== undefined && cur !== null) {
                            const val = cur > 100 ? cur / 10 : cur;
                            return `${val.toFixed(1)}°C`;
                          }
                          return '21.0°C';
                        })()}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 font-mono">Sensore Tuya (temp_current)</span>
                    </div>

                    <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                        <Flame className="w-4 h-4 text-amber-400" />
                        <span>Impostata (Target)</span>
                      </div>
                      <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                        {(() => {
                          const tgt = device.state.thermostat?.targetTemp;
                          if (tgt !== undefined && tgt !== null) {
                            const val = tgt > 100 ? tgt / 10 : tgt;
                            return `${val.toFixed(1)}°C`;
                          }
                          return '22.0°C';
                        })()}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 font-mono">Set Point (temp_set)</span>
                    </div>

                    <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center col-span-2 sm:col-span-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                        <Wind className="w-4 h-4 text-cyan-400" />
                        <span>Umidità Relativa</span>
                      </div>
                      <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-400">
                        {device.state.thermostat?.humidity || 50}%
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 font-mono">Umidità Ambiente</span>
                    </div>
                  </div>

                  {/* Target Temperature Adjustment Bar */}
                  <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-amber-400" />
                        <span>Regola Temperatura Target</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          handleStateChange({
                            thermostat: {
                              ...(device.state.thermostat || { currentTemp: 21, targetTemp: 22, humidity: 50, mode: 'heat', fanSpeed: 'auto' }),
                              power: !device.state.thermostat?.power,
                            },
                          })
                        }
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          device.state.thermostat?.power
                            ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                            : 'bg-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{device.state.thermostat?.power ? 'ACCESO' : 'SPENTO'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-6 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          const curTgt = device.state.thermostat?.targetTemp || 22.0;
                          const norm = curTgt > 100 ? curTgt / 10 : curTgt;
                          const newTgt = Math.max(10, Math.round((norm - 0.5) * 10) / 10);
                          handleStateChange({
                            thermostat: {
                              ...(device.state.thermostat || { currentTemp: 21, targetTemp: 22, humidity: 50, mode: 'heat', fanSpeed: 'auto', power: true }),
                              targetTemp: newTgt,
                              power: true,
                            },
                          });
                        }}
                        className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xl font-bold border border-white/10 hover:border-amber-400/50 transition cursor-pointer active:scale-95"
                        title="Diminuisci 0.5°C"
                      >
                        <Minus className="w-6 h-6" />
                      </button>

                      <div className="text-center">
                        <span className="text-4xl font-black text-white font-mono tracking-tight">
                          {(() => {
                            const tgt = device.state.thermostat?.targetTemp;
                            if (tgt !== undefined && tgt !== null) {
                              const val = tgt > 100 ? tgt / 10 : tgt;
                              return `${val.toFixed(1)}°C`;
                            }
                            return '22.0°C';
                          })()}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">Temperatura Desiderata</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const curTgt = device.state.thermostat?.targetTemp || 22.0;
                          const norm = curTgt > 100 ? curTgt / 10 : curTgt;
                          const newTgt = Math.min(35, Math.round((norm + 0.5) * 10) / 10);
                          handleStateChange({
                            thermostat: {
                              ...(device.state.thermostat || { currentTemp: 21, targetTemp: 22, humidity: 50, mode: 'heat', fanSpeed: 'auto', power: true }),
                              targetTemp: newTgt,
                              power: true,
                            },
                          });
                        }}
                        className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xl font-bold border border-white/10 hover:border-amber-400/50 transition cursor-pointer active:scale-95"
                        title="Aumenta 0.5°C"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <input
                        type="range"
                        min="10"
                        max="35"
                        step="0.5"
                        value={(() => {
                          const tgt = device.state.thermostat?.targetTemp || 22;
                          return tgt > 100 ? tgt / 10 : tgt;
                        })()}
                        onChange={(e) =>
                          handleStateChange({
                            thermostat: {
                              ...(device.state.thermostat || { currentTemp: 21, targetTemp: 22, humidity: 50, mode: 'heat', fanSpeed: 'auto', power: true }),
                              targetTemp: parseFloat(e.target.value),
                              power: true,
                            },
                          })
                        }
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>10°C (Min)</span>
                        <span>22.5°C (Comfort)</span>
                        <span>35°C (Max)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Camera Live Stream & Tuya WebRTC Config */}
              {(device.category === 'camera' || device.customIcon === 'camera' || device.name.toLowerCase().includes('telecamera')) && (
                <div className="space-y-4">
                  {/* Tuya WebRTC Credentials Card */}
                  <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Key className="w-4 h-4" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Credenziali Tuya WebRTC Streaming Live</h4>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 font-mono">
                        {tuyaWebRTCConfig.clientId ? 'Credenziali Inserite' : 'Incolla Credenziali'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] text-slate-300 font-bold block mb-1">Tuya Client ID</label>
                        <input
                          type="text"
                          value={tuyaWebRTCConfig.clientId}
                          onChange={(e) => setTuyaWebRTCConfig({ ...tuyaWebRTCConfig, clientId: e.target.value })}
                          placeholder="Client ID Tuya IoT"
                          className="w-full bg-[#121214] border border-white/10 px-2.5 py-1.5 rounded-xl text-white font-mono focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-300 font-bold block mb-1">Tuya Client Secret</label>
                        <input
                          type="password"
                          value={tuyaWebRTCConfig.clientSecret}
                          onChange={(e) => setTuyaWebRTCConfig({ ...tuyaWebRTCConfig, clientSecret: e.target.value })}
                          placeholder="Client Secret Tuya IoT"
                          className="w-full bg-[#121214] border border-white/10 px-2.5 py-1.5 rounded-xl text-white font-mono focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-300 font-bold block mb-1">Camera Device ID</label>
                        <input
                          type="text"
                          value={tuyaWebRTCConfig.deviceId || device.tuyaDeviceId || ''}
                          onChange={(e) => setTuyaWebRTCConfig({ ...tuyaWebRTCConfig, deviceId: e.target.value })}
                          placeholder="Device ID (es. eb9...)"
                          className="w-full bg-[#121214] border border-white/10 px-2.5 py-1.5 rounded-xl text-white font-mono focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-300 font-bold block mb-1">Tuya Region</label>
                        <select
                          value={tuyaWebRTCConfig.region || 'eu'}
                          onChange={(e) => setTuyaWebRTCConfig({ ...tuyaWebRTCConfig, region: e.target.value as any })}
                          className="w-full bg-[#121214] border border-white/10 px-2.5 py-1.5 rounded-xl text-white focus:border-amber-400 focus:outline-none"
                        >
                          <option value="eu">eu (Central Europe Data Center)</option>
                          <option value="us">us (Western America Data Center)</option>
                          <option value="cn">cn (China Data Center)</option>
                          <option value="in">in (India Data Center)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleSaveTuyaCredentials}
                        className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-4 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md"
                      >
                        {tuyaSavedSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Credenziali Tuya WebRTC Salvate!</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Salva Configurazione Tuya WebRTC</span>
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-slate-400">
                        Configurato in <code className="text-amber-300">tuyaConfig.ts</code> / <code className="text-amber-300">localStorage</code>
                      </p>
                    </div>
                  </div>

                  {/* Native HTML5 / WebRTC Stream Player */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-slate-200">Streaming Video WebRTC / HTML5 Nativo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleFetchStreamFromBackend()}
                          disabled={isFetchingStream}
                          className="text-[11px] bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-400/30 font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          {isFetchingStream ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                          <span>Richiedi Flusso /api/tuya-stream</span>
                        </button>
                      </div>
                    </div>

                    {/* HTML5 Native Video Frame */}
                    <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl min-h-[360px] flex items-center justify-center group">
                      {activeStreamUrl ? (
                        <>
                          <video
                            id="tuya-video"
                            ref={videoRef}
                            src={activeStreamUrl && activeStreamUrl !== 'webrtc-stream-active' ? activeStreamUrl : undefined}
                            autoPlay={true}
                            playsInline={true}
                            controls={true}
                            muted={isMuted}
                            className="w-full h-[460px] object-cover bg-black"
                          />
                          <div className="absolute top-4 right-4 z-20">
                            <button
                              type="button"
                              onClick={() => setIsMuted(!isMuted)}
                              className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md transition cursor-pointer flex items-center gap-1.5 shadow-xl hover:border-amber-400 text-xs font-semibold px-3"
                              title={isMuted ? 'Attiva Audio' : 'Disattiva Audio (Mute)'}
                            >
                              {isMuted ? (
                                <>
                                  <VolumeX className="w-4 h-4 text-rose-400" />
                                  <span>Audio Disattivato</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-4 h-4 text-emerald-400" />
                                  <span>Audio Attivo</span>
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="relative w-full h-[460px] bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-3 overflow-hidden">
                          {device.customImageUrl ? (
                            <img
                              src={device.customImageUrl}
                              alt={device.name}
                              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-xs"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                              <Video className="w-8 h-8" />
                            </div>
                          )}

                          <div className="relative z-10 space-y-3 max-w-md bg-black/70 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl">
                            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mx-auto">
                              <Camera className="w-6 h-6" />
                            </div>
                            <div>
                              <h5 className="text-sm font-bold text-white">Lettore WebRTC / HTML5 Nativo</h5>
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                Clicca su <strong className="text-amber-300">"Salva Configurazione Tuya WebRTC"</strong> per chiamare l'endpoint backend <code className="text-amber-300 font-mono">/api/tuya-stream</code>, ottenere la sessione WebRTC e avviare il flusso video direttamente in questo riquadro.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handleSaveTuyaCredentials}
                              disabled={isFetchingStream}
                              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 mx-auto shadow-lg"
                            >
                              {isFetchingStream ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Connessione a /api/tuya-stream...</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 fill-current" />
                                  <span>Avvia Flusso Tuya WebRTC Live</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Video Status Message Overlay */}
                      {streamStatusMsg && (
                        <div className="absolute top-3 left-3 right-3 z-20 bg-slate-900/90 backdrop-blur-md border border-white/10 px-3.5 py-2 rounded-xl text-[11px] font-mono text-amber-300 flex items-center justify-between shadow-lg">
                          <span className="truncate max-w-[88%]">{streamStatusMsg}</span>
                          <button
                            type="button"
                            onClick={() => setStreamStatusMsg('')}
                            className="text-slate-400 hover:text-white font-bold ml-2 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Floating Video Controls Bar */}
                      {activeStreamUrl && (
                        <div className="absolute bottom-3 left-3 right-3 z-20 bg-black/60 backdrop-blur-md p-2.5 rounded-xl border border-white/10 flex items-center justify-between opacity-90 group-hover:opacity-100 transition">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">WebRTC Live Stream</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsMuted(!isMuted)}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                              title={isMuted ? 'Attiva Audio' : 'Disattiva Audio'}
                            >
                              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (videoRef.current) {
                                  if (videoRef.current.requestFullscreen) {
                                    videoRef.current.requestFullscreen();
                                  }
                                }
                              }}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                              title="Schermo Intero"
                            >
                              <Maximize className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Lock Controls */}
              {device.category === 'lock' && device.state.lock && (
                <div className="bg-[#0A0A0B] p-5 rounded-2xl border border-white/5 flex flex-col items-center gap-3 text-center">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white ${
                      device.state.lock.locked ? 'bg-emerald-600' : 'bg-amber-600 animate-pulse'
                    }`}
                  >
                    {device.state.lock.locked ? <Lock className="w-8 h-8" /> : <Unlock className="w-8 h-8" />}
                  </div>
                  <h4 className="text-base font-bold text-white">
                    {device.state.lock.locked ? 'Serratura In Sicurezza' : 'Serratura Aperta'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Ultimo sblocco: {device.state.lock.lastAccessUser || 'Admin'} ({device.state.lock.lastAccessTime})
                  </p>
                  <button
                    onClick={() =>
                      handleStateChange({
                        lock: { ...device.state.lock!, locked: !device.state.lock?.locked },
                      })
                    }
                    className={`mt-2 px-6 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                      device.state.lock.locked
                        ? 'bg-amber-500 hover:bg-amber-400 text-black'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    }`}
                  >
                    {device.state.lock.locked ? 'Sblocca Serratura' : 'Blocca Serratura'}
                  </button>
                </div>
              )}

              {/* Gate / Cancelletto / Varco / Pulsed Switch Impulse Controls */}
              {(device.category === 'gate' || 
                device.category === 'pulsed_switch' || 
                device.customIcon === 'gate' || 
                device.customIcon === 'pulsed_switch' ||
                device.name.toLowerCase().includes('cancelletto') ||
                device.name.toLowerCase().includes('cancello') ||
                device.name.toLowerCase().includes('varco')) && (
                <div className="bg-[#0A0A0B] p-5 rounded-2xl border border-white/5 flex flex-col items-center gap-3 text-center">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                      device.state.switch?.power ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105' : 'bg-white/10 text-amber-400'
                    }`}
                  >
                    <Key className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {device.state.switch?.power ? 'Impulso in corso (ON...)' : 'Controllo Impulso / Varco (OFF)'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Pressione impulso ON con Auto-OFF automatico dopo 1.5 secondi (1500 ms)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onTogglePower) {
                        onTogglePower(device);
                      } else {
                        handleStateChange({
                          switch: { ...device.state.switch!, power: true, gangs: [true] }
                        });
                        setTimeout(() => {
                          handleStateChange({
                            switch: { ...device.state.switch!, power: false, gangs: [false] }
                          });
                        }, 1500);
                      }
                    }}
                    className={`mt-2 px-6 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 ${
                      device.state.switch?.power
                        ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                        : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    <span>{device.state.switch?.power ? 'Impulso Attivo (Auto-OFF 1.5s)...' : 'Invia Impulso Apertura'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'edit' && (
            <div className="bg-[#0A0A0B] p-5 rounded-2xl border border-white/5 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>Modifica Informazioni e Parametri del Dispositivo</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Nome Dispositivo</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-white font-medium focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold block">Stanza / Ubicazione</label>
                    <span className="text-[10px] text-amber-400 font-medium">Scegli a tendina o digita</span>
                  </div>

                  <div className="space-y-2">
                    {/* Dropdown with all existing rooms */}
                    <div className="relative">
                      <select
                        value={allKnownRooms.includes(editRoom) ? editRoom : '__custom__'}
                        onChange={(e) => {
                          if (e.target.value !== '__custom__') {
                            setEditRoom(e.target.value);
                          }
                        }}
                        className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-white font-medium focus:border-emerald-500 focus:outline-none cursor-pointer appearance-none pr-8 text-xs"
                      >
                        <option value="" disabled>-- Seleziona una Stanza Esistente --</option>
                        {allKnownRooms.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                        <option value="__custom__">✏️ Inserisci / Modifica testo libero...</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Direct text input with datalist auto-complete */}
                    <input
                      type="text"
                      list="modal-existing-rooms-list"
                      value={editRoom}
                      onChange={(e) => setEditRoom(e.target.value)}
                      placeholder="es. Salotto, Cucina, Bagno, Smart Home..."
                      className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-white font-medium focus:border-emerald-500 focus:outline-none placeholder-slate-600 text-xs"
                    />
                    <datalist id="modal-existing-rooms-list">
                      {allKnownRooms.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>

                    {/* Quick selection tags */}
                    <div className="flex flex-wrap gap-1">
                      {allKnownRooms.slice(0, 7).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setEditRoom(r)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer border ${
                            editRoom === r
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Categoria Dispositivo</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-white font-medium focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="plug">Presa Smart (Plug)</option>
                    <option value="light">Illuminazione (Light/RGB)</option>
                    <option value="thermostat">Termostato (Thermostat)</option>
                    <option value="camera">Telecamera (Camera IP)</option>
                    <option value="lock">Serratura Smart (Lock)</option>
                    <option value="sensor">Sensore (Sensor)</option>
                    <option value="vacuum">Robot Aspirapolvere</option>
                    <option value="curtains">Tenda / Tapparella</option>
                    <option value="switch">Interruttore Relè</option>
                    <option value="gate">Apricancello / Relè Impulsivo</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Produttore / Vendor</label>
                  <input
                    type="text"
                    value={editVendor}
                    onChange={(e) => setEditVendor(e.target.value)}
                    placeholder="es. Smart Life, Tuya, Sonoff"
                    className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-white font-medium focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Tuya Device ID</label>
                  <input
                    type="text"
                    value={editTuyaId}
                    onChange={(e) => setEditTuyaId(e.target.value)}
                    placeholder="es. tuya_992109283"
                    className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Indirizzo IP Locale</label>
                  <input
                    type="text"
                    value={editIp}
                    onChange={(e) => setEditIp(e.target.value)}
                    placeholder="192.168.1.108"
                    className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {(editCategory === 'thermostat' || device.category === 'thermostat') && (
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Temperatura Ambiente Reale Rilevata (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={editCurrentTemp}
                      onChange={(e) => setEditCurrentTemp(e.target.value)}
                      placeholder="31.0"
                      className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-emerald-400 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Visualizzata su display (come i 31°C rilevati dal sensore fisico a muro).
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Canale / Switch ID (DP Code Tuya)</label>
                  <select
                    value={editChannel || 'switch_1'}
                    onChange={(e) => setEditChannel(e.target.value)}
                    className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-white font-medium focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="switch_1">Canale 1 / Singolo (switch_1)</option>
                    <option value="switch">Generico / Singolo (switch)</option>
                    <option value="switch_2">Canale 2 (switch_2)</option>
                    <option value="switch_3">Canale 3 (switch_3)</option>
                    <option value="switch_4">Canale 4 (switch_4)</option>
                    <option value="button_1">Pulsante 1 (button_1)</option>
                    <option value="button">Pulsante (button)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    Codice Comando Tuya (DP Code Custom)
                  </label>
                  <input
                    type="text"
                    value={editDpCodeCustom}
                    onChange={(e) => setEditDpCodeCustom(e.target.value)}
                    placeholder="es. switch, doorcontrol_1, trigger, button_1"
                    className="w-full bg-[#121214] border border-white/10 px-3 py-2 rounded-xl text-white font-mono focus:border-emerald-500 focus:outline-none placeholder-slate-600 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Opzionale: sovrascrive il canale standard se compilato.
                  </p>
                </div>

                {/* Custom Photo / Image Upload Section */}
                <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 space-y-3 col-span-2 sm:col-span-1">
                  <label className="text-xs font-bold text-amber-300 block uppercase tracking-wider">
                    Carica Foto Personalizzata Dispositivo
                  </label>
                  <div className="flex items-center gap-3">
                    {editCustomImageUrl ? (
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-amber-400/60 shadow-md">
                        <img src={editCustomImageUrl} alt="Custom Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditCustomImageUrl('')}
                          className="absolute top-0 right-0 bg-rose-600 text-white text-[10px] w-5 h-5 flex items-center justify-center font-black rounded-bl cursor-pointer hover:bg-rose-500"
                          title="Rimuovi Foto"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center text-slate-400">
                        <Camera className="w-5 h-5 text-amber-400" />
                        <span className="text-[9px]">No foto</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer border border-amber-400/30 transition flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        <span>Carica Foto...</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const compressed = await compressImageFile(file);
                              if (compressed) {
                                setEditCustomImageUrl(compressed);
                              }
                            }
                            // Reset target value so same file can be re-selected if needed
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-slate-400">Supporta PNG, JPG, WebP</span>
                    </div>
                  </div>
                </div>

                {/* Custom Icon Selection Section */}
                <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 space-y-3 col-span-2 sm:col-span-1">
                  <label className="text-xs font-bold text-amber-300 block uppercase tracking-wider">
                    Cambia Icona Dispositivo
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: '', label: 'Default' },
                      { id: 'lightbulb', label: 'Luce' },
                      { id: 'plug', label: 'Presa' },
                      { id: 'power', label: 'Interruttore' },
                      { id: 'camera', label: 'Telecamera' },
                      { id: 'fan', label: 'Ventilatore' },
                      { id: 'air-vent', label: 'Condizionatore' },
                      { id: 'thermometer', label: 'Termostato' },
                      { id: 'tv', label: 'TV' },
                      { id: 'lock', label: 'Serratura' },
                      { id: 'shield', label: 'Sensore' },
                    ].map((iconOpt) => (
                      <button
                        key={iconOpt.id}
                        type="button"
                        onClick={() => {
                          setEditCustomIcon(iconOpt.id);
                          setEditCustomImageUrl(''); // Clear photo so selected icon displays immediately
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                          editCustomIcon === iconOpt.id && !editCustomImageUrl
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                            : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {iconOpt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleSaveFullEdit}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {isSaved ? (
                    <>
                      <Check className="w-4 h-4 text-black" />
                      <span>Modifiche Salvate in Firestore Cloud!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salva Modifiche in Tempo Reale</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-400">
                  Le modifiche verranno sincronizzate in live su tutti i client connessi.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Clock className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-white">Timer di Spegnimento Automatico</h4>
                </div>
                <p className="text-xs text-slate-400">
                  Imposta un conto alla rovescia dopo il quale il dispositivo si spegnerà automaticamente.
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(parseInt(e.target.value, 10))}
                    className="w-24 bg-[#121214] border border-white/10 text-white font-mono text-center px-3 py-2 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-300">Minuti</span>

                  <button
                    onClick={() => setTimerRunning(!timerRunning)}
                    className={`ml-auto px-4 py-2 rounded-xl font-bold text-xs cursor-pointer transition ${
                      timerRunning
                        ? 'bg-rose-500 text-white'
                        : 'bg-emerald-500 text-black hover:bg-emerald-400'
                    }`}
                  >
                    {timerRunning ? 'Annulla Timer' : 'Avvia Timer'}
                  </button>
                </div>

                {timerRunning && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                    <span>Timer attivo per {device.name}</span>
                    <span className="font-mono font-bold">{timerMinutes}:00 restanti</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-3 text-xs">
              <div className="bg-[#0A0A0B] p-4 rounded-2xl border border-white/5 space-y-2">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Tuya Device ID:</span>
                  <span className="font-mono text-emerald-400 font-bold">{device.tuyaDeviceId || 'N/D'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Indirizzo IP Locale:</span>
                  <span className="font-mono text-white">{device.ipAddress || '192.168.1.108'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Indirizzo MAC:</span>
                  <span className="font-mono text-white">{device.macAddress || 'DC:4F:22:1A:8B:00'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Versione Firmware Tuya:</span>
                  <span className="font-mono text-white">{device.firmwareVersion || 'v2.1.0'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Migrato da Smart Life:</span>
                  <span className="text-emerald-400 font-bold">
                    {device.transferredFromSmartLife ? `Sì (${device.transferredAt || 'Recentemente'})` : 'No'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0A0A0B] border-t border-white/5 flex items-center justify-between">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 p-2 rounded-xl">
              <span className="text-xs text-rose-300 font-bold">Confermi eliminazione?</span>
              <button
                type="button"
                onClick={() => {
                  onDeleteDevice(device.id);
                  onClose();
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg cursor-pointer shadow-md transition"
              >
                Sì, Elimina per sempre
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition"
              >
                Annulla
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Elimina dispositivo</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer border border-white/10"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
