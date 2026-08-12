import React, { useState, useEffect, useMemo } from 'react';
import { SmartDevice, AutomationRule, RoomName } from './types';
import { INITIAL_DEVICES, INITIAL_AUTOMATIONS } from './data/mockDevices';
import { Navbar } from './components/Navbar';
import { RoomFilter } from './components/RoomFilter';
import { DeviceCard } from './components/DeviceCard';
import { DeviceDetailModal } from './components/DeviceDetailModal';
import { SmartLifeTransferModal } from './components/SmartLifeTransferModal';
import { AutomationsTab } from './components/AutomationsTab';
import { EnergyTab } from './components/EnergyTab';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { AddDeviceModal } from './components/AddDeviceModal';
import { WallpaperModal } from './components/WallpaperModal';
import { 
  subscribeToDevices, 
  subscribeToAutomations, 
  saveDeviceToDb, 
  updateDeviceStateInDb, 
  deleteDeviceFromDb, 
  saveBatchDevicesToDb, 
  saveAutomationToDb, 
  deleteAutomationFromDb, 
  seedInitialDataIfEmpty 
} from './services/firebaseService';
import { sendTuyaCommand } from './services/smartLifeService';
import { 
  Sparkles, 
  RefreshCw, 
  Plus, 
  Sliders, 
  Zap, 
  Cpu, 
  CheckCircle2, 
  Layers, 
  Info,
  ShieldCheck,
  ChevronRight,
  GripVertical,
  Move,
  RotateCcw
} from 'lucide-react';

export default function App() {
  // Devices and Automations synced real-time from Firestore Cloud DB
  const [devices, setDevices] = useState<SmartDevice[]>(INITIAL_DEVICES);
  const [automations, setAutomations] = useState<AutomationRule[]>(INITIAL_AUTOMATIONS);

  // UI Navigation & Filters
  const [activeTab, setActiveTab] = useState<'devices' | 'automations' | 'energy' | 'ai'>('devices');
  const [selectedRoom, setSelectedRoom] = useState<RoomName | 'Tutti'>('Tutti');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [selectedDevice, setSelectedDevice] = useState<SmartDevice | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState<boolean>(false);
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState<boolean>(false);
  const [wallpaperUrl, setWallpaperUrl] = useState<string>(() => {
    return localStorage.getItem('smartlife_hub_wallpaper') || '';
  });

  const handleSelectWallpaper = (url: string) => {
    setWallpaperUrl(url);
    if (url) {
      localStorage.setItem('smartlife_hub_wallpaper', url);
    } else {
      localStorage.removeItem('smartlife_hub_wallpaper');
    }
  };

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time Firestore Sync Effect
  useEffect(() => {
    let unsubscribeDevices: (() => void) | undefined;
    let unsubscribeAutomations: (() => void) | undefined;

    async function initFirestoreRealtime() {
      await seedInitialDataIfEmpty(INITIAL_DEVICES, INITIAL_AUTOMATIONS);

      unsubscribeDevices = subscribeToDevices((updatedDevices) => {
        if (updatedDevices) {
          setDevices(updatedDevices);
        }
      });

      unsubscribeAutomations = subscribeToAutomations((updatedAutomations) => {
        if (updatedAutomations) {
          setAutomations(updatedAutomations);
        }
      });
    }

    initFirestoreRealtime();

    return () => {
      if (unsubscribeDevices) unsubscribeDevices();
      if (unsubscribeAutomations) unsubscribeAutomations();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Device Action Handlers - Persisted to Firestore Cloud DB & Tuya Cloud OpenAPI
  const handleTogglePower = async (device: SmartDevice) => {
    const d = device;
    const newDev = { ...d, state: { ...d.state } };

    const isGateOrImpulse = d.category === 'gate' || d.category === 'pulsed_switch' || d.customIcon === 'gate' || d.customIcon === 'pulsed_switch';

    if (isGateOrImpulse) {
      let cmdCode = 'switch_1';
      const configuredChannel = d.channel || d.dpCode;
      if (configuredChannel && configuredChannel !== '1' && configuredChannel !== 'default') {
        cmdCode = configuredChannel;
      }

      // 1. Immediate UI update to ON state ("In apertura...")
      const activeDev: SmartDevice = {
        ...d,
        state: {
          ...d.state,
          switch: {
            ...(d.state.switch || { gangs: [true] }),
            power: true,
            gangs: [true],
          },
          ...((d.state as any)?.power !== undefined ? { power: true } : {}),
        },
      };

      setDevices((prev) => prev.map((item) => (item.id === device.id ? activeDev : item)));
      showToast(`Inviato impulso a "${device.name}" (In apertura...)`);

      const tuyaId = d.tuyaDeviceId || d.id;
      if (tuyaId) {
        sendTuyaCommand(tuyaId, cmdCode, true).catch((err) => console.warn('Tuya gate ON command notice:', err));
      }

      try {
        await saveDeviceToDb(activeDev);
      } catch (dbErr) {
        console.warn('Firestore sync warning:', dbErr);
      }

      // 2. Automatic reset back to false after 1 second (1000 ms)
      setTimeout(async () => {
        const resetDev: SmartDevice = {
          ...d,
          state: {
            ...d.state,
            switch: {
              ...(d.state.switch || { gangs: [false] }),
              power: false,
              gangs: [false],
            },
            ...((d.state as any)?.power !== undefined ? { power: false } : {}),
          },
        };

        setDevices((prev) => prev.map((item) => (item.id === device.id ? resetDev : item)));

        if (tuyaId) {
          sendTuyaCommand(tuyaId, cmdCode, false).catch((err) => console.warn('Tuya gate OFF command notice:', err));
        }

        try {
          await saveDeviceToDb(resetDev);
        } catch (dbErr) {
          console.warn('Firestore sync warning:', dbErr);
        }
      }, 1000);

      return;
    }

    let commandCode = 'switch_1';
    let commandValue: boolean = true;

    if (d.category === 'plug') {
      const currentPower = d.state.plug?.power ?? false;
      const nextPower = !currentPower;
      commandCode = 'switch_1';
      commandValue = nextPower;
      newDev.state.plug = {
        totalKwh: 12.5,
        voltage: 220,
        current: nextPower ? 0.5 : 0,
        ...(d.state.plug || {}),
        power: nextPower,
        watts: nextPower ? 120.0 : 0,
      };
    } else if (d.category === 'light') {
      const currentPower = d.state.light?.power ?? false;
      const nextPower = !currentPower;
      commandCode = 'switch_led';
      commandValue = nextPower;
      newDev.state.light = {
        brightness: 100,
        color: '#ffffff',
        colorTemp: 4000,
        mode: 'white',
        ...(d.state.light || {}),
        power: nextPower,
      };
    } else if (d.category === 'thermostat') {
      const currentPower = d.state.thermostat?.power ?? false;
      const nextPower = !currentPower;
      commandCode = 'switch';
      commandValue = nextPower;
      newDev.state.thermostat = {
        currentTemp: 20,
        targetTemp: 21,
        humidity: 50,
        mode: 'heat',
        fanSpeed: 'auto',
        ...(d.state.thermostat || {}),
        power: nextPower,
      };
    } else if (d.category === 'lock') {
      const currentLocked = d.state.lock?.locked ?? true;
      const nextLocked = !currentLocked;
      commandCode = 'switch_1';
      commandValue = !nextLocked;
      newDev.state.lock = {
        battery: 100,
        doorClosed: true,
        ...(d.state.lock || {}),
        locked: nextLocked,
      };
    } else if (d.category === 'vacuum') {
      const currentStatus = d.state.vacuum?.status || 'docked';
      const nextStatus = currentStatus === 'docked' ? 'cleaning' : 'docked';
      commandCode = 'switch_1';
      commandValue = nextStatus === 'cleaning';
      newDev.state.vacuum = {
        battery: 100,
        suctionPower: 'standard',
        cleanedAreaSqm: 25,
        cleaningTimeMinutes: 30,
        ...(d.state.vacuum || {}),
        status: nextStatus,
      };
    } else if (d.category === 'switch') {
      const currentPower = d.state.switch?.power ?? false;
      const nextPower = !currentPower;
      commandCode = 'switch_1';
      commandValue = nextPower;
      newDev.state.switch = {
        ...(d.state.switch || { gangs: [false] }),
        power: nextPower,
        gangs: (d.state.switch?.gangs || [false]).map(() => nextPower),
      };
    } else {
      // General fallback toggle
      const genPower = !(d.state as any)?.power;
      commandCode = 'switch_1';
      commandValue = genPower;
      (newDev.state as any).power = genPower;
    }

    // Override commandCode if a specific Tuya channel/switch ID is configured (e.g. switch_1, switch_2, switch_3, switch_4)
    const configuredChannel = d.channel || d.dpCode;
    if (configuredChannel && configuredChannel !== '1' && configuredChannel !== 'default') {
      commandCode = configuredChannel;
    }

    // 1. Immediate UI update (changes card color, icon, and 'Accesa'/'Spenta' label instantly)
    setDevices((prev) => prev.map((item) => (item.id === device.id ? newDev : item)));

    // Persist immediately to Firestore DB
    try {
      await saveDeviceToDb(newDev);
    } catch (dbErr) {
      console.warn('Firestore sync warning:', dbErr);
    }

    // 2. Dispatch real Tuya Cloud OpenAPI command via /api/tuya-command
    const tuyaId = d.tuyaDeviceId || d.id;
    if (tuyaId) {
      try {
        const res = await sendTuyaCommand(tuyaId, commandCode, commandValue);
        if (res.success) {
          showToast(`Stato aggiornato Tuya: ${device.name} ${commandValue ? 'Acceso' : 'Spento'}`);
        } else {
          // Do NOT rollback local state! Keep user's state toggled and log Tuya response
          console.warn('Tuya Cloud command notice:', res.message);
          showToast(`${device.name} ${commandValue ? 'Acceso' : 'Spento'} (Stato Locale)`);
        }
      } catch (err: any) {
        console.warn('Tuya network warning:', err);
        showToast(`${device.name} ${commandValue ? 'Acceso' : 'Spento'} (Stato Locale)`);
      }
    } else {
      showToast(`Stato di "${device.name}" aggiornato (${commandValue ? 'Acceso' : 'Spento'}).`);
    }
  };

  const handleUpdateDeviceState = async (deviceId: string, updatedStatePartial: Partial<SmartDevice['state']>) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? { ...d, state: { ...d.state, ...updatedStatePartial } }
          : d
      )
    );

    const targetDev = devices.find((d) => d.id === deviceId);
    if (targetDev) {
      const mergedState = { ...targetDev.state, ...updatedStatePartial };
      await updateDeviceStateInDb(deviceId, mergedState);

      const tuyaId = targetDev.tuyaDeviceId || targetDev.id;
      if (tuyaId) {
        if (updatedStatePartial.light?.brightness !== undefined) {
          sendTuyaCommand(tuyaId, 'bright_value', updatedStatePartial.light.brightness);
        } else if (updatedStatePartial.thermostat?.targetTemp !== undefined) {
          sendTuyaCommand(tuyaId, 'temp_set', Math.round(updatedStatePartial.thermostat.targetTemp * 10));
        }
      }
    }
  };

  const handleUpdateDevice = async (updatedDevice: SmartDevice) => {
    setDevices((prev) => prev.map((d) => (d.id === updatedDevice.id ? updatedDevice : d)));
    setSelectedDevice(updatedDevice);
    showToast(`Dispositivo "${updatedDevice.name}" modificato.`);

    await saveDeviceToDb(updatedDevice);
  };

  const handleDeleteDevice = async (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    setSelectedDevice(null);
    showToast('Dispositivo rimosso da SmartLife Hub.');

    await deleteDeviceFromDb(deviceId);
  };

  const handleImportDevices = async (newDevices: SmartDevice[]) => {
    setDevices((prev) => {
      const existingTuyaIds = new Set(
        prev.map((d) => (d.tuyaDeviceId || d.id || '').toLowerCase()).filter(Boolean)
      );
      const existingNameRooms = new Set(
        prev.map((d) => `${d.name.toLowerCase().trim()}_${d.room.toLowerCase().trim()}`)
      );

      const uniqueNewDevices = newDevices.filter((d) => {
        const tuyaKey = (d.tuyaDeviceId || d.id || '').toLowerCase();
        const nameRoomKey = `${d.name.toLowerCase().trim()}_${d.room.toLowerCase().trim()}`;
        if (existingTuyaIds.has(tuyaKey) || existingNameRooms.has(nameRoomKey)) {
          return false;
        }
        return true;
      });

      if (uniqueNewDevices.length === 0) {
        showToast(`Tutti i ${newDevices.length} dispositivi sono già presenti nella dashboard. Nessun duplicato aggiunto.`);
        return prev;
      }

      const skippedCount = newDevices.length - uniqueNewDevices.length;
      if (skippedCount > 0) {
        showToast(`Aggiunti ${uniqueNewDevices.length} nuovi dispositivi (${skippedCount} già presenti ignorati).`);
      } else {
        showToast(`Trasferiti ${uniqueNewDevices.length} dispositivi da Smart Life!`);
      }

      saveBatchDevicesToDb(uniqueNewDevices);
      return [...uniqueNewDevices, ...prev];
    });
  };

  const handleExecuteTapToRun = async (rule: AutomationRule) => {
    for (const act of rule.actions) {
      const targetDev = devices.find((dev) => dev.id === act.deviceId);
      if (targetDev) {
        const copy = { ...targetDev, state: { ...targetDev.state } };
        let cmdCode = 'switch_1';
        let cmdValue: boolean = true;

        if (act.targetState['plug.power'] !== undefined && copy.state.plug) {
          cmdValue = act.targetState['plug.power'];
          copy.state.plug = { ...copy.state.plug, power: cmdValue, watts: cmdValue ? 110 : 0 };
        }
        if (act.targetState['light.power'] !== undefined && copy.state.light) {
          cmdCode = 'switch_led';
          cmdValue = act.targetState['light.power'];
          copy.state.light = { ...copy.state.light, power: cmdValue };
        }
        if (act.targetState['lock.locked'] !== undefined && copy.state.lock) {
          cmdValue = !act.targetState['lock.locked'];
          copy.state.lock = { ...copy.state.lock, locked: act.targetState['lock.locked'] };
        }

        setDevices((prev) => prev.map((d) => (d.id === copy.id ? copy : d)));
        await saveDeviceToDb(copy);

        const tuyaId = copy.tuyaDeviceId || copy.id;
        if (tuyaId) {
          sendTuyaCommand(tuyaId, cmdCode, cmdValue);
        }
      }
    }
    showToast(`Scena "${rule.title}" eseguita.`);
  };

  // Custom Drag-and-Drop Order for Dashboard Devices (saved in localStorage 'dashboard_device_order')
  const [deviceOrder, setDeviceOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dashboard_device_order');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [draggedDeviceId, setDraggedDeviceId] = useState<string | null>(null);
  const [dragOverDeviceId, setDragOverDeviceId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedDeviceId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDeviceId !== id) {
      setDragOverDeviceId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent, id: string) => {
    if (dragOverDeviceId === id) {
      setDragOverDeviceId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedDeviceId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggedDeviceId(null);
      setDragOverDeviceId(null);
      return;
    }

    const currentIds = filteredDevices.map((d) => d.id);
    const sourceIndex = currentIds.indexOf(sourceId);
    const targetIndex = currentIds.indexOf(targetId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const updatedIds = [...currentIds];
      const [moved] = updatedIds.splice(sourceIndex, 1);
      updatedIds.splice(targetIndex, 0, moved);

      // Merge with all device IDs to ensure non-visible filtered devices keep their ordering
      const allDeviceIds = devices.map((d) => d.id);
      const fullOrder = Array.from(new Set([...updatedIds, ...deviceOrder, ...allDeviceIds]));

      setDeviceOrder(fullOrder);
      try {
        localStorage.setItem('dashboard_device_order', JSON.stringify(fullOrder));
      } catch (err) {
        console.warn('LocalStorage save error:', err);
      }
      showToast('Nuovo ordine dispositivi salvato!');
    }

    setDraggedDeviceId(null);
    setDragOverDeviceId(null);
  };

  const handleDragEnd = () => {
    setDraggedDeviceId(null);
    setDragOverDeviceId(null);
  };

  const handleResetDeviceOrder = () => {
    setDeviceOrder([]);
    localStorage.removeItem('dashboard_device_order');
    showToast('Ordine originale dei dispositivi ripristinato.');
  };

  // Filtered & Custom Ordered devices list
  const filteredDevices = useMemo(() => {
    const list = devices.filter((dev) => {
      const matchesRoom = selectedRoom === 'Tutti' || dev.room === selectedRoom;
      const matchesSearch =
        dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dev.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dev.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRoom && matchesSearch;
    });

    if (deviceOrder.length > 0) {
      list.sort((a, b) => {
        const indexA = deviceOrder.indexOf(a.id);
        const indexB = deviceOrder.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
    }

    return list;
  }, [devices, selectedRoom, searchQuery, deviceOrder]);

  const totalActiveCount = devices.filter(
    (d) =>
      d.state.plug?.power ||
      d.state.light?.power ||
      d.state.thermostat?.power ||
      !d.state.lock?.locked
  ).length;

  const totalWatts = devices.reduce((sum, d) => {
    if (d.category === 'plug' && d.state.plug?.power) {
      return sum + (d.state.plug.watts || 0);
    }
    if (d.category === 'light' && d.state.light?.power) {
      return sum + (d.state.light.brightness * 0.12);
    }
    return sum;
  }, 0);

  return (
    <div 
      className="min-h-screen bg-[#080b11] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950 relative overflow-x-hidden bg-cover bg-center bg-fixed transition-all duration-300"
      style={wallpaperUrl ? { backgroundImage: `url(${wallpaperUrl})` } : {}}
    >
      {/* Background Ambient Overlay or Orbs */}
      {wallpaperUrl ? (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-none" />
      ) : (
        <>
          <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
          <div className="fixed bottom-1/3 right-10 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />
        </>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-slate-950 px-5 py-3 rounded-full font-extrabold text-xs shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom duration-200 border border-amber-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenTransferModal={() => setIsTransferModalOpen(true)}
        onOpenAiDrawer={() => setIsAiDrawerOpen(true)}
        onOpenAddDeviceModal={() => setIsAddDeviceModalOpen(true)}
        onOpenWallpaperModal={() => setIsWallpaperModalOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalActiveCount={totalActiveCount}
        totalWatts={totalWatts}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        
        {/* TAB 1: Devices Dashboard */}
        {activeTab === 'devices' && (
          <div className="space-y-6">
            
            {/* Apple Home Favorite Scenes Row */}
            <div>
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Scene Preferite</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {automations.map((scene, idx) => {
                  const isActive = idx === 2; // "A casa" pill highlight like Apple Home
                  return (
                    <button
                      key={scene.id}
                      onClick={() => handleExecuteTapToRun(scene)}
                      className={`p-3 rounded-2xl flex items-center gap-2.5 shadow-sm border transition text-left cursor-pointer active:scale-95 ${
                        isActive
                          ? 'bg-white/95 backdrop-blur-md border-white/60 shadow-md text-gray-900'
                          : 'bg-emerald-100/60 backdrop-blur-md border-white/20 text-emerald-950 hover:bg-emerald-100/80'
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl ${isActive ? 'bg-orange-500/20 text-orange-600' : 'bg-emerald-800/10 text-emerald-800'}`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold leading-tight line-clamp-1">{scene.title}</h4>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Room Filter Navigation */}
            <RoomFilter
              selectedRoom={selectedRoom}
              onSelectRoom={setSelectedRoom}
              devices={devices}
            />

            {/* Device Cards Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {selectedRoom === 'Tutti' ? 'Tutti i Dispositivi' : `Stanza: ${selectedRoom}`} ({filteredDevices.length})
                  </span>
                  <span className="text-[10px] text-amber-300/80 normal-case font-normal hidden sm:inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    <Move className="w-3 h-3 text-amber-400" /> Trascina per riordinare
                  </span>
                </h3>

                <div className="flex items-center gap-2">
                  {deviceOrder.length > 0 && (
                    <button
                      onClick={handleResetDeviceOrder}
                      className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-full border border-white/10 transition"
                      title="Ripristina ordine predefinito"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="hidden sm:inline">Ripristina Ordine</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsTransferModalOpen(true)}
                    className="text-xs text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1.5 cursor-pointer bg-amber-400/10 hover:bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400/20 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sincronizza Tuya</span>
                  </button>
                </div>
              </div>

              {filteredDevices.length === 0 ? (
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[26px] p-12 text-center space-y-3">
                  <p className="text-sm text-slate-400">Nessun dispositivo trovato per i filtri selezionati.</p>
                  <button
                    onClick={() => setIsTransferModalOpen(true)}
                    className="bg-amber-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-full transition cursor-pointer hover:bg-amber-300"
                  >
                    Importa da Smart Life / Tuya
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {filteredDevices.map((dev) => {
                    const isDragging = draggedDeviceId === dev.id;
                    const isDragOver = dragOverDeviceId === dev.id;
                    const isCamera = dev.category === 'camera' || dev.customIcon === 'camera' || dev.name.toLowerCase().includes('telecamera') || dev.name.toLowerCase().includes('camera');

                    return (
                      <div
                        key={dev.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, dev.id)}
                        onDragOver={(e) => handleDragOver(e, dev.id)}
                        onDragLeave={(e) => handleDragLeave(e, dev.id)}
                        onDrop={(e) => handleDrop(e, dev.id)}
                        onDragEnd={handleDragEnd}
                        className={`relative group/drag transition-all duration-200 rounded-[26px] ${
                          isCamera ? 'col-span-full' : ''
                        } ${
                          isDragging ? 'opacity-40 scale-95 border-2 border-dashed border-amber-400' : ''
                        } ${
                          isDragOver ? 'ring-2 ring-amber-400 scale-[1.02] shadow-2xl z-20' : ''
                        }`}
                      >
                        {/* Drag Handle Overlay Badge */}
                        <div
                          className="absolute top-2 left-2 z-30 opacity-0 group-hover/drag:opacity-100 transition-opacity bg-black/70 backdrop-blur-md p-1 rounded-lg border border-white/20 text-slate-300 cursor-grab active:cursor-grabbing hover:text-amber-400 shadow-md"
                          title="Trascina per spostare la card"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        <DeviceCard
                          device={dev}
                          onTogglePower={handleTogglePower}
                          onUpdateState={handleUpdateDeviceState}
                          onClickDetail={(d) => setSelectedDevice(d)}
                          onDeleteDevice={handleDeleteDevice}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Automations */}
        {activeTab === 'automations' && (
          <AutomationsTab
            automations={automations}
            devices={devices}
            onExecuteTapToRun={handleExecuteTapToRun}
            onToggleAutomation={async (id) => {
              const target = automations.find((a) => a.id === id);
              if (target) {
                const updated = { ...target, enabled: !target.enabled };
                setAutomations((prev) =>
                  prev.map((a) => (a.id === id ? updated : a))
                );
                showToast('Stato automazione aggiornato.');
                await saveAutomationToDb(updated);
              }
            }}
            onAddAutomation={async (newRule) => {
              setAutomations((prev) => [newRule, ...prev]);
              showToast('Nuova automazione creata.');
              await saveAutomationToDb(newRule);
            }}
            onDeleteAutomation={async (id) => {
              setAutomations((prev) => prev.filter((a) => a.id !== id));
              showToast('Automazione rimossa.');
              await deleteAutomationFromDb(id);
            }}
          />
        )}

        {/* TAB 3: Energy */}
        {activeTab === 'energy' && <EnergyTab devices={devices} />}

        {/* TAB 4: AI Assistant */}
        {activeTab === 'ai' && (
          <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 shadow-xl max-w-3xl mx-auto space-y-4">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 p-2.5 shadow-lg flex items-center justify-center text-emerald-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Assistente AI Gemini per SmartLife Hub</h2>
                <p className="text-xs text-slate-400">
                  Gestione avanzata domotica, supporto al trasferimento Smart Life e ottimizzazione energetica
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              L'Assistente AI Gemini è pronto per esserti d'aiuto! Clicca sul pulsante in basso per aprire l'interfaccia di conversazione oppure utilizza la barra laterale rapida.
            </p>

            <button
              onClick={() => setIsAiDrawerOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-6 py-3 rounded-2xl transition shadow-lg cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Apri Conversazione con Gemini AI</span>
            </button>
          </div>
        )}
      </main>

      {/* MODALS & DRAWERS */}
      <DeviceDetailModal
        device={selectedDevice}
        onClose={() => setSelectedDevice(null)}
        onUpdateDevice={handleUpdateDevice}
        onDeleteDevice={handleDeleteDevice}
      />

      <SmartLifeTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onImportDevices={handleImportDevices}
      />

      <AIAssistantDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        devices={devices}
        automations={automations}
        onOpenTransferModal={() => {
          setIsAiDrawerOpen(false);
          setIsTransferModalOpen(true);
        }}
      />

      <AddDeviceModal
        isOpen={isAddDeviceModalOpen}
        onClose={() => setIsAddDeviceModalOpen(false)}
        onAddDevice={async (newDev) => {
          setDevices((prev) => [newDev, ...prev]);
          showToast(`Dispositivo "${newDev.name}" aggiunto.`);
          await saveDeviceToDb(newDev);
        }}
      />

      <WallpaperModal
        isOpen={isWallpaperModalOpen}
        onClose={() => setIsWallpaperModalOpen(false)}
        currentWallpaper={wallpaperUrl}
        onSelectWallpaper={handleSelectWallpaper}
      />
    </div>
  );
}
