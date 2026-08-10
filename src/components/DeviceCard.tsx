import React, { useState, useEffect } from 'react';
import { SmartDevice } from '../types';
import { getTuyaConfig, saveTuyaConfig, TuyaCameraConfig } from '../tuyaConfig';
import { 
  Power, 
  Zap, 
  Thermometer, 
  Camera, 
  Lock, 
  Unlock, 
  Lightbulb, 
  ShieldAlert, 
  Sliders,
  Tv,
  Settings,
  Fan,
  Wind,
  Plug,
  Play,
  Bell,
  HardDrive,
  ChevronRight,
  Video,
  Key,
  Save,
  Check
} from 'lucide-react';

interface DeviceCardProps {
  device: SmartDevice;
  onTogglePower: (device: SmartDevice) => void;
  onUpdateState: (deviceId: string, updatedState: Partial<SmartDevice['state']>) => void;
  onClickDetail: (device: SmartDevice) => void;
  onDeleteDevice?: (deviceId: string) => void;
}

// Camera Live View Card component matching Smart Life / Tuya screenshot layout
const CameraCard: React.FC<{
  device: SmartDevice;
  onClickDetail: (device: SmartDevice) => void;
}> = ({ device, onClickDetail }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showWebIframe, setShowWebIframe] = useState<boolean>(false);
  const [showTuyaConfigModal, setShowTuyaConfigModal] = useState<boolean>(false);
  const [tuyaForm, setTuyaForm] = useState<TuyaCameraConfig>(() => getTuyaConfig());
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [timeStr, setTimeStr] = useState<string>('');
  const [snapshotNotice, setSnapshotNotice] = useState<boolean>(false);

  useEffect(() => {
    const loaded = getTuyaConfig();
    if (!loaded.deviceId && device.tuyaDeviceId) {
      loaded.deviceId = device.tuyaDeviceId;
    }
    setTuyaForm(loaded);
  }, [device.tuyaDeviceId]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const year = now.getFullYear();
      const month = pad(now.getMonth() + 1);
      const day = pad(now.getDate());
      const hours = pad(now.getHours());
      const mins = pad(now.getMinutes());
      const secs = pad(now.getSeconds());
      setTimeStr(`${year}-${month}-${day} ${hours}:${mins}:${secs}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveTuyaConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveTuyaConfig(tuyaForm);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setShowTuyaConfigModal(false);
    }, 1500);
  };

  const handleSnapshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSnapshotNotice(true);
    setTimeout(() => setSnapshotNotice(false), 2200);
  };

  const bgImage = device.customImageUrl || 'https://images.unsplash.com/photo-1558036117-15d82a90b9b1?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2 bg-[#121214] rounded-[24px] border border-white/10 overflow-hidden shadow-xl flex flex-col group transition hover:border-amber-400/40">
      {/* Video Container Frame */}
      <div className="relative w-full h-[220px] sm:h-[260px] bg-black overflow-hidden select-none">
        {showTuyaConfigModal ? (
          <div className="absolute inset-0 z-30 bg-[#0d0d10] p-4 overflow-y-auto text-left text-xs text-white">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Video className="w-4 h-4" />
                <span>Configurazione Tuya WebRTC & Credenziali</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTuyaConfigModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTuyaConfig} className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-0.5">Tuya Client ID (Access ID)</label>
                <input
                  type="text"
                  value={tuyaForm.clientId}
                  onChange={(e) => setTuyaForm({ ...tuyaForm, clientId: e.target.value })}
                  placeholder="Incolla Client ID Tuya IoT"
                  className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-0.5">Tuya Client Secret</label>
                <input
                  type="password"
                  value={tuyaForm.clientSecret}
                  onChange={(e) => setTuyaForm({ ...tuyaForm, clientSecret: e.target.value })}
                  placeholder="Incolla Client Secret Tuya IoT"
                  className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-0.5">Device ID Telecamera</label>
                  <input
                    type="text"
                    value={tuyaForm.deviceId || device.tuyaDeviceId || ''}
                    onChange={(e) => setTuyaForm({ ...tuyaForm, deviceId: e.target.value })}
                    placeholder="Device ID (es. eb9...)"
                    className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-0.5">Data Center Region</label>
                  <select
                    value={tuyaForm.region}
                    onChange={(e) => setTuyaForm({ ...tuyaForm, region: e.target.value as any })}
                    className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-amber-400 focus:outline-none"
                  >
                    <option value="eu">Europe (EU)</option>
                    <option value="us">America (US)</option>
                    <option value="cn">China (CN)</option>
                    <option value="in">India (IN)</option>
                  </select>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <button
                  type="submit"
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvato!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Salva Credenziali WebRTC</span>
                    </>
                  )}
                </button>
                <span className="text-[10px] text-slate-400">Salvato in locale sicuro</span>
              </div>
            </form>
          </div>
        ) : showWebIframe ? (
          <div className="relative w-full h-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowWebIframe(false);
              }}
              className="absolute top-2 right-2 z-20 bg-black/80 hover:bg-black text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-white/20 shadow-lg cursor-pointer"
            >
              ✕ Chiudi Web IPC
            </button>
            <iframe
              src="https://ipc-eu.ismartlife.me"
              title={`Web IPC - ${device.name}`}
              className="w-full h-full border-0"
              style={{ width: '100%', height: '100%', border: 0 }}
              allow="fullscreen"
            />
          </div>
        ) : (
          <>
            {/* Background Stream Image / Canvas Simulation */}
            <img
              src={bgImage}
              alt={device.name}
              className={`w-full h-full object-cover transition-all duration-700 ${isPlaying ? 'brightness-90 contrast-105' : 'brightness-50 grayscale'}`}
            />

            {/* Dark Overlay Gradients for Readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/60 pointer-events-none" />

            {/* Top Header Overlay */}
            <div className="absolute top-0 left-0 right-0 p-3.5 flex items-start justify-between z-10">
              <div>
                <p className="text-[11px] font-mono text-slate-300 font-semibold tracking-wider drop-shadow-md">
                  {timeStr}
                </p>
                <h4 className="text-sm font-bold text-white drop-shadow-md leading-tight mt-0.5">
                  {device.name}
                </h4>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTuyaConfigModal(true);
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition cursor-pointer flex items-center gap-1"
                  title="Configura Credenziali Tuya WebRTC"
                >
                  <Key className="w-3 h-3" />
                  <span>Tuya WebRTC</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWebIframe(true);
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/40 hover:bg-black/60 text-slate-200 border border-white/10 transition cursor-pointer"
                  title="Apri Piattaforma Web IPC in Iframe"
                >
                  🌐 Web IPC
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickDetail(device);
                  }}
                  className="text-[11px] font-bold text-white/90 hover:text-amber-300 flex items-center gap-1 bg-black/40 hover:bg-black/60 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-md transition cursor-pointer"
                >
                  <span>Dettagli</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Center Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlaying(!isPlaying);
                }}
                className="w-14 h-14 rounded-full border-2 border-white/90 bg-black/35 backdrop-blur-md flex items-center justify-center text-white hover:scale-105 active:scale-95 transition cursor-pointer shadow-2xl hover:border-amber-400"
                title={isPlaying ? 'Pausa Flusso Live' : 'Riproduci Flusso Live'}
              >
                <Play className={`w-7 h-7 fill-white text-white ml-1 ${isPlaying ? 'opacity-100' : 'opacity-70'}`} />
              </button>
            </div>

            {/* Live Indicator Pill */}
            {isPlaying && (
              <div className="absolute bottom-3 left-3.5 z-10 flex items-center gap-1.5 bg-rose-600/90 text-white px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider border border-rose-400/40 backdrop-blur-md animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                LIVE
              </div>
            )}
          </>
        )}

        {/* Snapshot Taken Toast */}
        {snapshotNotice && (
          <div className="absolute inset-x-0 top-12 mx-auto w-max z-20 bg-emerald-500 text-black text-xs font-black px-4 py-1.5 rounded-full shadow-2xl animate-in fade-in slide-in-from-top duration-200">
            📸 Foto scattata e salvata!
          </div>
        )}
      </div>

      {/* Bottom Actions Toolbar matching screenshot */}
      <div className="bg-[#18181b] border-t border-white/5 py-2.5 px-2 grid grid-cols-4 gap-1 text-center select-none">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            alert('Messaggi Telecamera: Nessun movimento sospetto rilevato.');
          }}
          className="flex flex-col items-center gap-1 text-slate-300 hover:text-white group/btn cursor-pointer py-1 rounded-xl hover:bg-white/5 transition"
        >
          <div className="relative">
            <Bell className="w-5 h-5 text-slate-300 group-hover/btn:text-amber-400 transition" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-slate-900" />
          </div>
          <span className="text-[10px] font-semibold tracking-tight">Messaggi</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            alert('Archiviazione: 128GB Scheda SD attiva e sincronizzata con Cloud Tuya.');
          }}
          className="flex flex-col items-center gap-1 text-slate-300 hover:text-white group/btn cursor-pointer py-1 rounded-xl hover:bg-white/5 transition"
        >
          <div className="relative">
            <HardDrive className="w-5 h-5 text-slate-300 group-hover/btn:text-amber-400 transition" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-slate-900" />
          </div>
          <span className="text-[10px] font-semibold tracking-tight truncate max-w-[75px]">Archiviazione...</span>
        </button>

        <button
          type="button"
          onClick={handleSnapshot}
          className="flex flex-col items-center gap-1 text-slate-300 hover:text-white group/btn cursor-pointer py-1 rounded-xl hover:bg-white/5 transition"
        >
          <Camera className="w-5 h-5 text-slate-300 group-hover/btn:text-amber-400 transition" />
          <span className="text-[10px] font-semibold tracking-tight">Scatta Foto</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClickDetail(device);
          }}
          className="flex flex-col items-center gap-1 text-slate-300 hover:text-white group/btn cursor-pointer py-1 rounded-xl hover:bg-white/5 transition"
        >
          <Settings className="w-5 h-5 text-slate-300 group-hover/btn:text-amber-400 transition" />
          <span className="text-[10px] font-semibold tracking-tight">Impostazione</span>
        </button>
      </div>
    </div>
  );
};

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onTogglePower,
  onClickDetail,
}) => {
  const { category, name, state } = device;

  const isCamera = category === 'camera' || device.customIcon === 'camera' || name.toLowerCase().includes('telecamera') || name.toLowerCase().includes('camera');

  if (isCamera) {
    return <CameraCard device={device} onClickDetail={onClickDetail} />;
  }

  // Determine main power status correctly per device category
  const isPowerOn = (() => {
    switch (category) {
      case 'light':
        return Boolean(state.light?.power);
      case 'plug':
        return Boolean(state.plug?.power);
      case 'switch':
        return Boolean(state.switch?.power);
      case 'thermostat':
        return Boolean(state.thermostat?.power);
      case 'camera':
        return Boolean(state.camera?.power);
      case 'lock':
        return Boolean(state.lock && !state.lock.locked);
      case 'sensor':
        return Boolean(state.sensor?.triggered);
      case 'vacuum':
        return state.vacuum?.status === 'cleaning';
      default:
        return Boolean((state as any)?.power);
    }
  })();

  // Apple Home Subtitle status text
  const getStatusText = () => {
    if (!isPowerOn) {
      if (category === 'lock') return 'Bloccata (OFF)';
      return 'OFF';
    }

    if (category === 'light' && state.light) {
      return state.light.brightness ? `${state.light.brightness}%` : 'ON';
    }
    if (category === 'plug' && state.plug) {
      return state.plug.watts ? `${state.plug.watts} W` : 'ON';
    }
    if (category === 'thermostat' && state.thermostat) {
      return `${state.thermostat.targetTemp}°C`;
    }
    if (category === 'lock') {
      return 'Sbloccata (ON)';
    }
    if (category === 'sensor') {
      return state.sensor?.triggered ? 'Allarme' : 'OK';
    }
    if (category === 'vacuum') {
      return state.vacuum?.status === 'cleaning' ? 'In pulizia' : 'OFF';
    }
    return 'ON';
  };

  // Apple Home Icon getter
  const renderIcon = () => {
    // 1. Custom Image Photo if uploaded by user
    if (device.customImageUrl && device.customImageUrl.trim() !== '') {
      return (
        <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 shadow-sm flex items-center justify-center bg-black/20">
          <img 
            src={device.customImageUrl} 
            alt={name} 
            className="w-full h-full object-cover" 
          />
        </div>
      );
    }

    // 2. Circular Badge styling like Apple Home:
    // When ON: Solid yellow circle with white/dark icon inside
    // When OFF: Dark circle with bright yellow/amber filled icon inside
    const badgeClasses = isPowerOn
      ? 'w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center shadow-sm transition-all'
      : 'w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center transition-all';

    const iconColor = isPowerOn 
      ? 'fill-slate-900 text-slate-900' 
      : 'fill-amber-400 text-amber-400 drop-shadow-sm';

    const iconType = device.customIcon || category;

    if (iconType === 'light' || iconType === 'lightbulb') {
      return (
        <div className={badgeClasses}>
          <Lightbulb className={`w-5 h-5 ${iconColor}`} />
        </div>
      );
    }
    if (iconType === 'plug' || iconType === 'zap') {
      return (
        <div className={badgeClasses}>
          <Plug className={`w-5 h-5 ${isPowerOn ? 'text-slate-900 font-bold' : 'text-amber-400 font-bold'}`} />
        </div>
      );
    }
    if (iconType === 'fan') {
      return (
        <div className={badgeClasses}>
          <Fan className={`w-5 h-5 ${isPowerOn ? 'text-slate-900 animate-spin' : 'text-amber-400'}`} />
        </div>
      );
    }
    if (iconType === 'air-vent' || iconType === 'wind') {
      return (
        <div className={badgeClasses}>
          <Wind className={`w-5 h-5 ${iconColor}`} />
        </div>
      );
    }
    if (iconType === 'camera') {
      return (
        <div className={badgeClasses}>
          <Camera className={`w-5 h-5 ${iconColor}`} />
        </div>
      );
    }
    if (iconType === 'switch' || iconType === 'power') {
      return (
        <div className={badgeClasses}>
          <Power className={`w-5 h-5 ${isPowerOn ? 'text-slate-900 font-bold' : 'text-amber-400 font-bold'}`} />
        </div>
      );
    }
    if (iconType === 'thermostat' || iconType === 'thermometer') {
      return (
        <div className={badgeClasses}>
          <span className={`text-xs font-black ${isPowerOn ? 'text-slate-900' : 'text-amber-400'}`}>
            {state.thermostat?.currentTemp ? `${Math.round(state.thermostat.currentTemp)}°` : '20°'}
          </span>
        </div>
      );
    }
    if (iconType === 'lock') {
      return (
        <div className={badgeClasses}>
          {state.lock?.locked ? (
            <Lock className={`w-5 h-5 ${isPowerOn ? 'text-slate-900' : 'text-amber-400'}`} />
          ) : (
            <Unlock className={`w-5 h-5 ${isPowerOn ? 'text-slate-900' : 'text-amber-400'}`} />
          )}
        </div>
      );
    }
    if (iconType === 'tv') {
      return (
        <div className={badgeClasses}>
          <Tv className={`w-5 h-5 ${iconColor}`} />
        </div>
      );
    }
    if (iconType === 'sensor' || iconType === 'shield') {
      return (
        <div className={badgeClasses}>
          <ShieldAlert className={`w-5 h-5 ${iconColor}`} />
        </div>
      );
    }
    return (
      <div className={badgeClasses}>
        <Sliders className={`w-5 h-5 ${iconColor}`} />
      </div>
    );
  };

  return (
    <div
      onClick={() => onTogglePower(device)}
      className={`group relative p-3.5 rounded-[22px] flex flex-col justify-between h-[116px] transition-all duration-200 cursor-pointer select-none active:scale-[0.96] ${
        isPowerOn
          ? 'bg-white text-slate-900 border border-slate-100/80 shadow-md hover:shadow-lg hover:bg-white'
          : 'bg-black/25 backdrop-blur-md border border-white/15 text-white hover:bg-black/35 shadow-sm'
      }`}
    >
      {/* Top Row: Icon on left, settings gear on right */}
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-center">
          {renderIcon()}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClickDetail(device);
          }}
          className={`p-1 rounded-full transition-colors ${
            isPowerOn 
              ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' 
              : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Impostazioni e Dettagli"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Row: Title and Status */}
      <div className="pr-1">
        <p className={`font-bold text-xs leading-tight line-clamp-2 ${
          isPowerOn ? 'text-slate-900' : 'text-white'
        }`}>
          {name}
        </p>
        <p className={`text-[11px] mt-0.5 font-semibold ${
          isPowerOn ? 'text-slate-500' : 'text-slate-300/80'
        }`}>
          {getStatusText()}
        </p>
      </div>
    </div>
  );
};
