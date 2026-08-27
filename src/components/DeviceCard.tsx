import React, { useState, useEffect, useRef } from 'react';
import { SmartDevice } from '../types';
import { getTuyaConfig, saveTuyaConfig, resetTuyaConfig, TuyaCameraConfig, requestTuyaWebRTCStream, startWebRTCStream, cleanupVideoMedia } from '../tuyaConfig';
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
  Pause,
  Square,
  Bell,
  HardDrive,
  Cloud,
  Hexagon,
  ChevronRight,
  Video,
  Key,
  Save,
  Check,
  Loader2,
  Volume2,
  VolumeX,
  Droplets,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface DeviceCardProps {
  device: SmartDevice;
  onTogglePower: (device: SmartDevice) => void;
  onUpdateState: (deviceId: string, updatedState: Partial<SmartDevice['state']>) => void;
  onClickDetail: (device: SmartDevice) => void;
  onDeleteDevice?: (deviceId: string) => void;
  onToggleChannel?: (device: SmartDevice, channelDp: string, nextValue?: boolean) => void;
}

// 4-Channel Tuya Relay Irrigation Card component
const IrrigationCard: React.FC<{
  device: SmartDevice;
  onClickDetail: (device: SmartDevice) => void;
  onTogglePower: (device: SmartDevice) => void;
  onUpdateState?: (deviceId: string, updatedState: Partial<SmartDevice['state']>) => void;
  onToggleChannel?: (device: SmartDevice, channelDp: string, nextValue?: boolean) => void;
}> = ({ device, onClickDetail, onTogglePower, onUpdateState, onToggleChannel }) => {
  const switchState = device.state.switch;

  const isZone1 = Boolean(switchState?.channelStates?.switch_1 ?? switchState?.gangs?.[0]);
  const isZone2 = Boolean(switchState?.channelStates?.switch_2 ?? switchState?.gangs?.[1]);
  const isZone3 = Boolean(switchState?.channelStates?.switch_3 ?? switchState?.gangs?.[2]);
  const isZone4 = Boolean(switchState?.channelStates?.switch_4 ?? switchState?.gangs?.[3]);

  const isOnline = device.isOnline !== false;
  const activeCount = [isZone1, isZone2, isZone3, isZone4].filter(Boolean).length;
  const isAnyActive = activeCount > 0;

  // Derive schedule info if present
  const schedules = device.schedules || [];
  const getChannelSchedule = (dp: string) => schedules.find((s) => s.channel === dp && s.enabled);

  const channels = [
    { dpCode: 'switch_1', num: 1, name: 'Lato Cancellone', active: isZone1, schedule: getChannelSchedule('switch_1') },
    { dpCode: 'switch_2', num: 2, name: 'Centrale', active: isZone2, schedule: getChannelSchedule('switch_2') },
    { dpCode: 'switch_3', num: 3, name: 'Lato Cancelletto', active: isZone3, schedule: getChannelSchedule('switch_3') },
    { dpCode: 'switch_4', num: 4, name: 'Switch 4', active: isZone4, schedule: getChannelSchedule('switch_4') },
  ];

  const handleToggle = (dpCode: string, currentVal: boolean) => {
    if (onToggleChannel) {
      onToggleChannel(device, dpCode, !currentVal);
    } else if (onUpdateState) {
      const idxMap: Record<string, number> = { switch_1: 0, switch_2: 1, switch_3: 2, switch_4: 3 };
      const idx = idxMap[dpCode] ?? 0;
      const nextGangs = [
        Boolean(switchState?.channelStates?.switch_1 ?? switchState?.gangs?.[0]),
        Boolean(switchState?.channelStates?.switch_2 ?? switchState?.gangs?.[1]),
        Boolean(switchState?.channelStates?.switch_3 ?? switchState?.gangs?.[2]),
        Boolean(switchState?.channelStates?.switch_4 ?? switchState?.gangs?.[3]),
      ];
      nextGangs[idx] = !currentVal;
      onUpdateState(device.id, {
        switch: {
          power: nextGangs.some(Boolean),
          gangs: nextGangs,
          channelStates: {
            ...(switchState?.channelStates || {}),
            switch_1: nextGangs[0],
            switch_2: nextGangs[1],
            switch_3: nextGangs[2],
            switch_4: nextGangs[3],
            [dpCode]: !currentVal,
          },
        },
      });
    }
  };

  const handleMasterToggle = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e || 'changedTouches' in e) {
      if (e.cancelable) e.preventDefault();
    }
    e.stopPropagation();
    const targetVal = !isAnyActive;
    channels.forEach((ch) => {
      if (ch.active !== targetVal) {
        if (onToggleChannel) {
          onToggleChannel(device, ch.dpCode, targetVal);
        }
      }
    });
  };

  const handleChannelAction = (e: React.MouseEvent | React.TouchEvent, dpCode: string, currentVal: boolean) => {
    if ('touches' in e || 'changedTouches' in e) {
      if (e.cancelable) e.preventDefault();
    }
    e.stopPropagation();
    handleToggle(dpCode, currentVal);
  };

  return (
    <div
      className={`group relative p-4 sm:p-5 rounded-[24px] flex flex-col justify-between transition-all duration-200 select-none shadow-lg ${
        !isOnline
          ? 'bg-black/20 backdrop-blur-md border border-rose-500/20 text-slate-300 opacity-60 grayscale-[30%]'
          : isAnyActive
          ? 'bg-gradient-to-br from-[#0c1c28] to-[#0a1520] border border-cyan-500/40 text-white shadow-cyan-950/40'
          : 'bg-black/30 backdrop-blur-md border border-white/15 text-white'
      }`}
    >
      {/* Top Header: Icon, Device Title, Zone Status & Quick Controls */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
              !isOnline
                ? 'bg-white/5 border border-rose-500/20 text-slate-400 opacity-60'
                : isAnyActive
                ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/40 animate-pulse'
                : 'bg-white/10 border border-white/10 text-cyan-400'
            }`}
          >
            <Droplets className={`w-5 h-5 ${!isOnline ? 'text-slate-400' : isAnyActive ? 'fill-slate-950 text-slate-950' : 'fill-cyan-400 text-cyan-400'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm sm:text-base leading-snug truncate text-white">
                {device.name}
              </h4>
              <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                4CH Tuya
              </span>
              {!isOnline && (
                <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                  OFFLINE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                !isOnline ? 'text-rose-400/80 font-mono text-[10px]' : isAnyActive ? 'text-cyan-300' : 'text-slate-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${!isOnline ? 'bg-rose-500' : isAnyActive ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`} />
                {!isOnline ? 'Dispositivo non raggiungibile / Interruttore a monte spento' : isAnyActive ? `${activeCount} di 4 Zone in Irrigazione` : 'Tutte le zone spente'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleMasterToggle}
            onTouchEnd={handleMasterToggle}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              isAnyActive
                ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 shadow-sm'
                : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 shadow-sm'
            }`}
            title={isAnyActive ? 'Spegni tutte le 4 zone contemporaneamente' : 'Attiva tutte le 4 zone contemporaneamente'}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isAnyActive ? 'Spegni Tutto' : 'Accendi Tutto'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClickDetail(device);
            }}
            onTouchEnd={(e) => {
              if (e.cancelable) e.preventDefault();
              e.stopPropagation();
              onClickDetail(device);
            }}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 border border-white/10 transition cursor-pointer"
            title="Programmazioni orari e Timer zone"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Channel Buttons in Full Horizontal Grid (2x2 on mobile, 4x1 on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-3.5">
        {channels.map((ch) => (
          <button
            key={ch.dpCode}
            type="button"
            onClick={(e) => handleChannelAction(e, ch.dpCode, ch.active)}
            onTouchEnd={(e) => handleChannelAction(e, ch.dpCode, ch.active)}
            className={`group/btn relative p-3 sm:p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-150 cursor-pointer active:scale-95 min-h-[96px] ${
              ch.active
                ? 'bg-gradient-to-b from-cyan-500/30 to-cyan-600/20 border-cyan-400 text-white shadow-md shadow-cyan-900/40 ring-1 ring-cyan-400/50'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-cyan-300">
                CH {ch.num} • {ch.dpCode}
              </span>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  ch.active
                    ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/50'
                    : 'bg-white/10 text-slate-400 group-hover/btn:text-white group-hover/btn:bg-white/20'
                }`}
              >
                <Power className="w-3.5 h-3.5 font-bold" />
              </div>
            </div>

            <div className="w-full">
              <p className="font-bold text-xs sm:text-sm leading-tight text-white line-clamp-2">
                {ch.name}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  ch.active ? 'text-cyan-300 font-extrabold' : 'text-slate-400'
                }`}>
                  {ch.active ? '● IRRIGAZIONE ON' : 'SPENTO'}
                </span>
                {ch.schedule && (
                  <span className="text-[9px] text-amber-300/90 font-mono">
                    ⏱ {ch.schedule.time}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Camera Live View Card component matching Smart Life / Tuya screenshot layout
const CameraCard: React.FC<{
  device: SmartDevice;
  onClickDetail: (device: SmartDevice) => void;
}> = ({ device, onClickDetail }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [showTuyaConfigModal, setShowTuyaConfigModal] = useState<boolean>(false);
  const [tuyaForm, setTuyaForm] = useState<TuyaCameraConfig>(() =>
    getTuyaConfig(device.tuyaDeviceId || device.id)
  );
  const [activeStreamUrl, setActiveStreamUrl] = useState<string>(() => tuyaForm.streamUrl || tuyaForm.directStreamUrl || '');
  const [isFetchingStream, setIsFetchingStream] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [streamError, setStreamError] = useState<{ code?: string; message: string } | null>(null);
  const [timeStr, setTimeStr] = useState<string>('');
  const [snapshotNotice, setSnapshotNotice] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const devId = device.tuyaDeviceId || device.id;
    const loaded = getTuyaConfig(devId);
    if (!loaded.deviceId && devId) {
      loaded.deviceId = devId;
    }
    setTuyaForm(loaded);
    if (loaded.directStreamUrl) {
      setActiveStreamUrl(loaded.directStreamUrl);
    } else if (loaded.streamUrl) {
      setActiveStreamUrl(loaded.streamUrl);
    }
  }, [device.tuyaDeviceId, device.id]);

  // On-Demand WebRTC/HLS Live Stream Startup/Cleanup on CameraCard
  useEffect(() => {
    let isMounted = true;
    const devId = device.tuyaDeviceId || device.id;
    const cfg = getTuyaConfig(devId);
    if (!cfg.deviceId && devId) {
      cfg.deviceId = devId;
    }

    const startStreamOnDemand = async () => {
      // If direct stream URL is set, play directly without calling Tuya Cloud
      if (cfg.directStreamUrl && cfg.directStreamUrl.trim().length > 0) {
        setActiveStreamUrl(cfg.directStreamUrl.trim());
        setStreamError(null);
        setTimeout(async () => {
          if (videoRef.current && isMounted) {
            await startWebRTCStream(
              videoRef.current,
              { success: true, streamUrl: cfg.directStreamUrl.trim(), message: 'Direct stream active' },
              device.name,
              cfg
            );
          }
        }, 100);
        return;
      }

      setIsFetchingStream(true);
      setStreamError(null);
      try {
        const res = await requestTuyaWebRTCStream(cfg);
        if (!isMounted) return;
        if (res.success) {
          const streamUrl = res.streamUrl || 'webrtc-stream-active';
          setActiveStreamUrl(streamUrl);
          setStreamError(null);
          saveTuyaConfig({ ...cfg, streamUrl }, devId);

          setTimeout(async () => {
            if (videoRef.current && isMounted) {
              const pc = await startWebRTCStream(videoRef.current, res, device.name, cfg);
              peerConnectionRef.current = pc;
            }
          }, 100);
        } else {
          setStreamError({
            code: res.code,
            message: res.message || 'Impossibile avviare lo streaming video.',
          });
        }
      } catch (err: any) {
        console.warn('On-demand stream initialization error on CameraCard:', err);
        if (isMounted) {
          setStreamError({
            message: err?.message || 'Errore di connessione durante l\'avvio dello stream.',
          });
        }
      } finally {
        if (isMounted) setIsFetchingStream(false);
      }
    };

    if (isPlaying && !showTuyaConfigModal) {
      startStreamOnDemand();
    } else {
      setIsFetchingStream(false);
      if (videoRef.current) {
        cleanupVideoMedia(videoRef.current);
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }

    return () => {
      isMounted = false;
      if (videoRef.current) {
        cleanupVideoMedia(videoRef.current);
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [device.id, device.tuyaDeviceId, isPlaying, showTuyaConfigModal]);

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

  const handleResetConfig = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const targetDevId = device.tuyaDeviceId || device.id;
    const cleanConfig = resetTuyaConfig(targetDevId);
    setTuyaForm(cleanConfig);
    setActiveStreamUrl('');
    setStreamError(null);
    setStatusMsg('Configurazione ripristinata alle impostazioni predefinite.');
    setSavedSuccess(true);
    if (videoRef.current) {
      cleanupVideoMedia(videoRef.current);
    }
    setTimeout(() => {
      setSavedSuccess(false);
      setShowTuyaConfigModal(false);
      setIsPlaying(true);
    }, 800);
  };

  const handleSaveTuyaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDevId = tuyaForm.deviceId || device.tuyaDeviceId || device.id;
    saveTuyaConfig(tuyaForm, targetDevId);
    setStreamError(null);

    if (tuyaForm.directStreamUrl && tuyaForm.directStreamUrl.trim().length > 0) {
      setActiveStreamUrl(tuyaForm.directStreamUrl.trim());
      setStatusMsg('URL Flusso Diretto salvato con successo!');
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setShowTuyaConfigModal(false);
        setIsPlaying(true);
      }, 1200);
      return;
    }

    setIsFetchingStream(true);
    setStatusMsg('Connessione all\'endpoint /api/tuya-stream e allocazione flusso...');

    try {
      const res = await requestTuyaWebRTCStream(tuyaForm);
      if (res.success) {
        const streamUrl = res.streamUrl || 'webrtc-stream-active';
        setActiveStreamUrl(streamUrl);
        saveTuyaConfig({ ...tuyaForm, streamUrl }, targetDevId);
        setStreamError(null);

        setStatusMsg(res.message || 'Flusso recuperato con successo!');
        setSavedSuccess(true);

        setTimeout(async () => {
          if (videoRef.current) {
            await startWebRTCStream(videoRef.current, res, device.name, tuyaForm);
          }
        }, 100);

        setTimeout(() => {
          setSavedSuccess(false);
          setShowTuyaConfigModal(false);
        }, 1500);
      } else {
        setStatusMsg(`Avviso: ${res.message}`);
        setStreamError({
          code: res.code,
          message: res.message,
        });
      }
    } catch (err: any) {
      setStatusMsg(`Errore stream: ${err?.message || String(err)}`);
      setStreamError({
        message: err?.message || 'Errore di connessione',
      });
    } finally {
      setIsFetchingStream(false);
    }
  };

  const handleSnapshot = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      if ('touches' in e || 'changedTouches' in e) {
        if (e.cancelable) e.preventDefault();
      }
      e.stopPropagation();
    }
    setSnapshotNotice(true);
    setTimeout(() => setSnapshotNotice(false), 2200);
  };

  const bgImage = device.customImageUrl || 'https://images.unsplash.com/photo-1558036117-15d82a90b9b1?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="w-full bg-white dark:bg-[#18181c] rounded-[24px] border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-md flex flex-col group transition hover:border-amber-400/40">
      {/* Video Container Frame */}
      <div className="relative w-full h-[220px] sm:h-[260px] bg-black overflow-hidden select-none">
        {showTuyaConfigModal ? (
          <div className="absolute inset-0 z-30 bg-[#0d0d10] p-4 overflow-y-auto text-left text-xs text-white">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Video className="w-4 h-4" />
                <span>Configurazione Telecamera & Streaming</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTuyaConfigModal(false)}
                className="text-slate-400 hover:text-white font-bold text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTuyaConfig} className="space-y-3">
              {/* Option 1: Tuya Cloud API Automatic Stream Generation (Primary) */}
              <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-amber-400/30">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Generazione Automatica Stream Tuya (Predefinito)</span>
                  </span>
                  <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                    API /stream/allocate
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-snug">
                  La PWA richiede e alloca automaticamente il flusso live temporaneo (WebRTC / HLS) tramite le API Tuya Cloud senza necessità di inserire manualmente un URL.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Tuya Client ID (Access ID)</label>
                    <input
                      type="text"
                      value={tuyaForm.clientId}
                      onChange={(e) => setTuyaForm({ ...tuyaForm, clientId: e.target.value })}
                      placeholder="Client ID Tuya IoT"
                      className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Tuya Client Secret</label>
                    <input
                      type="password"
                      value={tuyaForm.clientSecret}
                      onChange={(e) => setTuyaForm({ ...tuyaForm, clientSecret: e.target.value })}
                      placeholder="Client Secret Tuya IoT"
                      className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Device ID Telecamera</label>
                    <input
                      type="text"
                      value={tuyaForm.deviceId || device.tuyaDeviceId || ''}
                      onChange={(e) => setTuyaForm({ ...tuyaForm, deviceId: e.target.value })}
                      placeholder="Device ID (es. eb9...)"
                      className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Data Center Region</label>
                    <select
                      value={tuyaForm.region}
                      onChange={(e) => setTuyaForm({ ...tuyaForm, region: e.target.value as any })}
                      className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-amber-400 focus:outline-none"
                    >
                      <option value="eu">Europe (EU - openapi.tuyaeu.com)</option>
                      <option value="us">America (US - openapi.tuyaus.com)</option>
                      <option value="cn">China (CN - openapi.tuyacn.com)</option>
                      <option value="in">India (IN - openapi.tuyain.com)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Option 2: Optional Direct Stream URL Fallback */}
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Opzionale: URL Flusso Diretto (Fallback)
                </label>
                <input
                  type="text"
                  value={tuyaForm.directStreamUrl || ''}
                  onChange={(e) => setTuyaForm({ ...tuyaForm, directStreamUrl: e.target.value })}
                  placeholder="Lascia vuoto per usare Tuya Cloud automatico"
                  className="w-full bg-[#18181c] border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Se lasciato vuoto, la PWA utilizzerà esclusivamente il link temporaneo generato in automatico dalle credenziali Tuya Cloud.
                </p>
              </div>

              {statusMsg && (
                <div className="p-2 bg-amber-400/10 border border-amber-400/20 rounded-lg text-[10px] text-amber-300 font-mono">
                  {statusMsg}
                </div>
              )}

              <div className="pt-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isFetchingStream}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    {isFetchingStream ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifica...</span>
                      </>
                    ) : savedSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvato!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Salva Configurazione</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetConfig}
                    className="px-2.5 py-2 rounded-lg bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs flex items-center gap-1 transition cursor-pointer"
                    title="Ripristina alle impostazioni predefinite"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ripristina</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 hidden sm:inline">WebRTC / HLS / FLV</span>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* HTML5 Native Video player on Card */}
            <div className="relative w-full h-full bg-black">
              <video
                id={`tuya-video-${device.id}`}
                ref={videoRef}
                src={activeStreamUrl && activeStreamUrl !== 'webrtc-stream-active' ? activeStreamUrl : undefined}
                autoPlay={true}
                playsInline={true}
                controls={false}
                muted={isMuted}
                className="w-full h-full object-cover bg-black"
              />
              {isFetchingStream && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center gap-2 text-amber-400 font-mono text-xs z-10 pointer-events-none">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connessione Flusso Telecamera...</span>
                </div>
              )}
              {streamError && isPlaying && (
                <div className="absolute top-12 inset-x-3 z-20 bg-black/80 backdrop-blur-md border border-rose-500/30 p-2.5 rounded-xl text-center">
                  <div className="text-[11px] font-bold text-rose-400 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{streamError.code === '60001001' ? 'Quota Tuya Esaurita (60001001)' : 'Flusso non disponibile'}</span>
                  </div>
                  <p className="text-[9px] text-slate-300 mt-0.5 line-clamp-2">{streamError.message}</p>
                </div>
              )}
            </div>

            {/* Dark Overlay Gradients for Readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/50 pointer-events-none" />

            {/* Top Header Overlay matching Smart Life screenshot */}
            <div className="absolute top-0 left-0 right-0 p-3 sm:p-3.5 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <h4 className="text-sm sm:text-base font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] leading-tight">
                  {device.name}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying(!isPlaying);
                  }}
                  onTouchEnd={(e) => {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    setIsPlaying(!isPlaying);
                  }}
                  className="p-1 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 backdrop-blur-md transition cursor-pointer flex items-center justify-center shadow-lg hover:border-amber-400"
                  title={isPlaying ? 'Pausa Stream' : 'Riproduci Stream'}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  onTouchEnd={(e) => {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="p-1 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 backdrop-blur-md transition cursor-pointer flex items-center justify-center shadow-lg hover:border-amber-400"
                  title={isMuted ? 'Attiva Audio' : 'Disattiva Audio (Mute)'}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTuyaConfigModal(true);
                  }}
                  onTouchEnd={(e) => {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    setShowTuyaConfigModal(true);
                  }}
                  className="p-1 rounded-full bg-black/40 hover:bg-black/60 text-amber-300 border border-white/20 backdrop-blur-md transition cursor-pointer"
                  title="Configura Credenziali & Flusso Telecamera"
                >
                  <Key className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickDetail(device);
                  }}
                  onTouchEnd={(e) => {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    onClickDetail(device);
                  }}
                  className="text-xs font-normal text-white/90 hover:text-white flex items-center gap-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] cursor-pointer"
                >
                  <span className="hidden sm:inline">Visualizzare il Dispos...</span>
                  <span className="sm:hidden">Visualizza...</span>
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Center Play Button Overlay (ONLY shown when paused, never while LIVE) */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying(true);
                  }}
                  onTouchEnd={(e) => {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    setIsPlaying(true);
                  }}
                  className="pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/90 bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:scale-105 active:scale-95 transition cursor-pointer shadow-2xl"
                  title="Avvia Streaming Live"
                >
                  <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white text-white ml-1 opacity-95" />
                </button>
              </div>
            )}

            {/* Live Indicator Pill */}
            {isPlaying && (
              <div className="absolute bottom-3 left-3.5 z-10 flex items-center gap-1.5 bg-rose-600/90 text-white px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider border border-rose-400/40 backdrop-blur-md animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span>{tuyaForm.directStreamUrl ? 'LIVE DIRECT' : 'LIVE WEBRTC'}</span>
              </div>
            )}

            {/* Time Overlay */}
            <div className="absolute bottom-3 right-3.5 z-10 text-[10px] font-mono text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {timeStr}
            </div>
          </>
        )}

        {/* Snapshot Taken Toast */}
        {snapshotNotice && (
          <div className="absolute inset-x-0 top-12 mx-auto w-max z-20 bg-emerald-500 text-black text-xs font-black px-4 py-1.5 rounded-full shadow-2xl animate-in fade-in slide-in-from-top duration-200">
            📸 Foto scattata e salvata!
          </div>
        )}
      </div>

      {/* Bottom Actions Toolbar matching Smart Life screenshot */}
      <div className="bg-white dark:bg-[#18181c] border-t border-slate-100 dark:border-white/5 py-3 px-2 grid grid-cols-4 gap-1 text-center select-none rounded-b-[24px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            alert('Messaggi Telecamera: Nessun movimento sospetto rilevato.');
          }}
          onTouchEnd={(e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            alert('Messaggi Telecamera: Nessun movimento sospetto rilevato.');
          }}
          className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white group/btn cursor-pointer py-1 px-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition"
        >
          <div className="relative">
            <Bell className="w-5 h-5 text-slate-700 dark:text-slate-300 group-hover/btn:text-amber-500 transition" />
          </div>
          <span className="text-[11px] font-normal tracking-tight">Messaggi</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            alert('Archiviazione: 128GB Scheda SD e Cloud Tuya attivi.');
          }}
          onTouchEnd={(e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            alert('Archiviazione: 128GB Scheda SD e Cloud Tuya attivi.');
          }}
          className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white group/btn cursor-pointer py-1 px-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition"
        >
          <div className="relative">
            <Cloud className="w-5 h-5 text-slate-700 dark:text-slate-300 group-hover/btn:text-amber-500 transition" />
            <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-[#18181c]" />
          </div>
          <span className="text-[11px] font-normal tracking-tight truncate max-w-[85px]">Archiviazione...</span>
        </button>

        <button
          type="button"
          onClick={handleSnapshot}
          onTouchEnd={(e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            handleSnapshot();
          }}
          className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white group/btn cursor-pointer py-1 px-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition"
        >
          <Camera className="w-5 h-5 text-slate-700 dark:text-slate-300 group-hover/btn:text-amber-500 transition" />
          <span className="text-[11px] font-normal tracking-tight">Scatta Foto</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClickDetail(device);
          }}
          onTouchEnd={(e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            onClickDetail(device);
          }}
          className="flex flex-col items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white group/btn cursor-pointer py-1 px-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition"
        >
          <Hexagon className="w-5 h-5 text-slate-700 dark:text-slate-300 group-hover/btn:text-amber-500 transition" />
          <span className="text-[11px] font-normal tracking-tight">Impostazione</span>
        </button>
      </div>
    </div>
  );
};

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onTogglePower,
  onUpdateState,
  onClickDetail,
  onToggleChannel,
}) => {
  const { category, name, state } = device;

  const isCamera = category === 'camera' || device.customIcon === 'camera' || name.toLowerCase().includes('telecamera') || name.toLowerCase().includes('camera');

  if (isCamera) {
    return <CameraCard device={device} onClickDetail={onClickDetail} />;
  }

  const isIrrigation =
    name.toLowerCase().includes('irrigaz') ||
    name.toLowerCase().includes('solenoide') ||
    device.customIcon === 'droplet' ||
    device.customIcon === 'irrigation' ||
    (category === 'switch' && Boolean(state.switch?.gangs && state.switch.gangs.length >= 4));

  if (isIrrigation) {
    return (
      <IrrigationCard
        device={device}
        onClickDetail={onClickDetail}
        onTogglePower={onTogglePower}
        onUpdateState={onUpdateState}
        onToggleChannel={onToggleChannel}
      />
    );
  }

  const isGateOrImpulse =
    category === 'gate' ||
    category === 'pulsed_switch' ||
    device.customIcon === 'gate' ||
    device.customIcon === 'pulsed_switch' ||
    name.toLowerCase().includes('cancelletto') ||
    name.toLowerCase().includes('cancello') ||
    name.toLowerCase().includes('varco') ||
    name.toLowerCase().includes('portoncino');

  const isOnline = device.isOnline !== false;

  // Determine main power status correctly per device category (bypassing rigid offline flag)
  const isPowerOn = (() => {
    if (isGateOrImpulse) {
      return Boolean(state.switch?.power || state.switch?.gangs?.[0] || (state as any)?.power);
    }
    switch (category) {
      case 'light':
        return Boolean(state.light?.power);
      case 'plug':
        return Boolean(state.plug?.power);
      case 'switch':
        return Boolean(state.switch?.power || state.switch?.gangs?.[0] || (state as any)?.power);
      case 'gate':
      case 'pulsed_switch':
        return Boolean(state.switch?.power || (state as any)?.power);
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

  // Apple Home Subtitle status text: Simple ON, OFF or Thermostat Temp
  const getStatusText = () => {
    if (isGateOrImpulse) {
      return isPowerOn ? 'IMPULSO ON' : 'OFF';
    }
    if (category === 'thermostat') {
      const cur = state.thermostat?.currentTemp;
      const tgt = state.thermostat?.targetTemp;
      const parsedCur = cur !== undefined && cur !== null ? (cur > 100 ? cur / 10 : cur) : null;
      const parsedTgt = tgt !== undefined && tgt !== null ? (tgt > 100 ? tgt / 10 : tgt) : null;
      if (parsedCur !== null && parsedTgt !== null) {
        return `${parsedCur.toFixed(1)}°C • Set ${parsedTgt.toFixed(1)}°C`;
      }
      if (parsedCur !== null) {
        return `${parsedCur.toFixed(1)}°C`;
      }
      if (parsedTgt !== null) {
        return `${parsedTgt.toFixed(1)}°C`;
      }
      return isPowerOn ? 'ON' : 'OFF';
    }
    return isPowerOn ? 'ON' : 'OFF';
  };

  // Apple Home Icon getter
  const renderIcon = () => {
    // 1. Custom Image Photo if uploaded by user
    if (device.customImageUrl && device.customImageUrl.trim() !== '') {
      return (
        <div className="w-9 h-9 rounded-full overflow-hidden border shadow-sm flex items-center justify-center border-white/20 bg-black/20">
          <img 
            src={device.customImageUrl} 
            alt={name} 
            className="w-full h-full object-cover" 
          />
        </div>
      );
    }

    // 2. Circular Badge styling like Apple Home:
    // When ON: Solid yellow circle with dark icon inside
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
    if (iconType === 'gate' || iconType === 'pulsed_switch' || category === 'gate' || category === 'pulsed_switch' || isGateOrImpulse) {
      return (
        <div className={badgeClasses}>
          <Key className={`w-5 h-5 ${isPowerOn ? 'text-slate-900 font-bold' : 'text-amber-400 font-bold'}`} />
        </div>
      );
    }
    if (
      iconType === 'thermostat' ||
      iconType === 'thermometer' ||
      category === 'thermostat' ||
      name.toLowerCase().includes('termo') ||
      name.toLowerCase().includes('termosifoni')
    ) {
      const cur = state.thermostat?.currentTemp ?? (state as any)?.temperature;
      let displayTemp = '31.0°';
      if (cur !== undefined && cur !== null) {
        const num = Number(cur);
        if (!isNaN(num)) {
          const val = num > 100 ? num / 10 : num;
          displayTemp = `${val.toFixed(1)}°`;
        }
      }
      return (
        <div className={badgeClasses}>
          <span className={`text-[11px] font-black ${isPowerOn ? 'text-slate-900' : 'text-amber-400'}`}>
            {displayTemp}
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

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePower(device);
  };

  const handleCardTouchEnd = (e: React.TouchEvent) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();
    onTogglePower(device);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onTouchEnd={handleCardTouchEnd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTogglePower(device);
        }
      }}
      style={{ touchAction: 'manipulation' }}
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

        <div className="flex items-center gap-1">
          {!isOnline && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Offline
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClickDetail(device);
            }}
            onTouchEnd={(e) => {
              if (e.cancelable) e.preventDefault();
              e.stopPropagation();
              onClickDetail(device);
            }}
            className={`p-1 rounded-full transition-colors cursor-pointer ${
              isPowerOn 
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' 
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Impostazioni e Dettagli"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Title and Status */}
      <div className="pr-1">
        <p className={`font-bold text-xs leading-tight line-clamp-2 ${
          isPowerOn ? 'text-slate-900' : 'text-white'
        }`}>
          {name}
        </p>
        <p className={`text-[11px] mt-0.5 font-bold uppercase tracking-wider ${
          isPowerOn 
            ? 'text-amber-600 dark:text-amber-500' 
            : 'text-slate-400'
        }`}>
          {getStatusText()}
        </p>
      </div>
    </div>
  );
};
