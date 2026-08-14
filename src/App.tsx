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
import { RoomsTab } from './components/RoomsTab';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { AddDeviceModal } from './components/AddDeviceModal';
import { AddRoomModal } from './components/AddRoomModal';
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
  AlertCircle,
  Layers, 
  Info,
  ShieldCheck,
  ChevronRight,
  GripVertical,
  Move,
  RotateCcw,
  ExternalLink,
  X
} from 'lucide-react';

export default function App() {
  // Devices and Automations synced real-time from Firestore Cloud DB
  const [devices, setDevices] = useState<SmartDevice[]>(INITIAL_DEVICES);
  const [automations, setAutomations] = useState<AutomationRule[]>(INITIAL_AUTOMATIONS);

  // Tuya Cloud Quota Alert Banner state
  const [tuyaQuotaBannerVisible, setTuyaQuotaBannerVisible] = useState(false);

  // UI Navigation & Filters
  const [activeTab, setActiveTab] = useState<'devices' | 'rooms' | 'automations' | 'energy' | 'ai'>('devices');
  const [selectedRoom, setSelectedRoom] = useState<RoomName | 'Tutti'>('Tutti');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Custom Rooms list (persisted in localStorage)
  const [customRooms, setCustomRooms] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('smartlife_hub_custom_rooms');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modals & Drawers
  const [selectedDevice, setSelectedDevice] = useState<SmartDevice | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState<boolean>(false);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState<boolean>(false);
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

  const showToast = (msg: string, duration = 3000) => {
    setToastMessage(msg);
    const timeoutDuration = msg.includes('⚠️') || msg.length > 50 ? 6500 : duration;
    setTimeout(() => setToastMessage(null), timeoutDuration);
  };

  // Device Action Handlers - Persisted to Firestore Cloud DB & Tuya Cloud OpenAPI
  const handleTogglePower = async (device: SmartDevice) => {
    const d = device;
    const newDev = { ...d, state: { ...d.state } };

    const isGateOrImpulse = d.category === 'gate' || d.category === 'pulsed_switch' || d.customIcon === 'gate' || d.customIcon === 'pulsed_switch';

    if (isGateOrImpulse) {
      const isCancelletto = (device.name || '').toLowerCase().includes('cancelletto');
      let dpCode = isCancelletto ? 'switch' : 'switch_1';
      if (d.dpCode && d.dpCode.trim()) {
        dpCode = d.dpCode.trim();
      } else if (d.channel && d.channel !== '1' && d.channel !== 'default') {
        dpCode = d.channel;
      }

      const tuyaId = d.tuyaDeviceId || d.id;

      // Fallback al Toggle Inverso: Se il pulsante risulta già nello stato true, invia sequenzialmente false e poi true
      const isCurrentlyTrue = d.state.switch?.power ?? d.state.switch?.gangs?.[0] ?? (d.state as any)?.power ?? false;
      const step1Value = !isCurrentlyTrue;
      const step2Value = isCurrentlyTrue;

      // Step 1: Pressione
      const step1Dev: SmartDevice = {
        ...d,
        state: {
          ...d.state,
          switch: {
            ...(d.state.switch || { gangs: [step1Value] }),
            power: step1Value,
            gangs: [step1Value],
          },
          ...((d.state as any)?.power !== undefined ? { power: step1Value } : {}),
        },
      };

      setDevices((prev) => prev.map((item) => (item.id === device.id ? step1Dev : item)));
      showToast(`Inviato impulso a "${device.name}" (${step1Value ? 'Pressione ON...' : 'Pressione Inversa OFF...'})`);

      if (tuyaId) {
        sendTuyaCommand(tuyaId, [{ code: dpCode, value: step1Value }], undefined, undefined, {
          category: d.category,
          isGate: true,
          dpCode,
          deviceName: d.name,
        })
          .then((res) => {
            console.log('Tuya Response Gate Step 1:', res);
            if (!res.success && res.message && (res.message.includes('60001001') || res.message.toLowerCase().includes('quota') || res.message.includes('28841002'))) {
              setTuyaQuotaBannerVisible(true);
            }
          })
          .catch((err) => console.warn('Tuya gate Step 1 command notice:', err));
      }

      try {
        await saveDeviceToDb(step1Dev);
      } catch (dbErr) {
        console.warn('Firestore sync warning:', dbErr);
      }

      // Step 2: Rilascio dopo 500ms
      setTimeout(async () => {
        if (tuyaId) {
          sendTuyaCommand(tuyaId, [{ code: dpCode, value: step2Value }], undefined, undefined, {
            category: d.category,
            isGate: true,
            dpCode,
            deviceName: d.name,
          })
            .then((res) => {
              console.log('Tuya Response Gate Step 2:', res);
              if (!res.success && res.message && (res.message.includes('60001001') || res.message.toLowerCase().includes('quota') || res.message.includes('28841002'))) {
                setTuyaQuotaBannerVisible(true);
              }
            })
            .catch((err) => console.warn('Tuya gate Step 2 command notice:', err));
        }

        const step2Dev: SmartDevice = {
          ...d,
          state: {
            ...d.state,
            switch: {
              ...(d.state.switch || { gangs: [step2Value] }),
              power: step2Value,
              gangs: [step2Value],
            },
            ...((d.state as any)?.power !== undefined ? { power: step2Value } : {}),
          },
        };

        setDevices((prev) => prev.map((item) => (item.id === device.id ? step2Dev : item)));

        try {
          await saveDeviceToDb(step2Dev);
        } catch (dbErr) {
          console.warn('Firestore sync warning:', dbErr);
        }
      }, 500);

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
        const res = await sendTuyaCommand(tuyaId, commandCode, commandValue, undefined, {
          category: d.category,
          dpCode: d.dpCode || commandCode,
          deviceName: d.name,
        });
        if (res.success) {
          showToast(`Stato aggiornato Tuya: ${device.name} ${commandValue ? 'Acceso' : 'Spento'}`);
        } else {
          // Do NOT rollback local state! Keep user's state toggled and log Tuya response
          console.warn('Tuya Cloud command notice:', res.message);
          if (res.message && (res.message.includes('60001001') || res.message.toLowerCase().includes('quota') || res.message.includes('28841002'))) {
            setTuyaQuotaBannerVisible(true);
          }
          showToast(`${device.name} ${commandValue ? 'Acceso' : 'Spento'}`);
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

  // Custom Room Handlers
  const handleAddRoom = async (newRoomName: string, _iconName: string, assignedDeviceIds: string[]) => {
    const updatedCustom = Array.from(new Set([...customRooms, newRoomName]));
    setCustomRooms(updatedCustom);
    try {
      localStorage.setItem('smartlife_hub_custom_rooms', JSON.stringify(updatedCustom));
    } catch (e) {
      console.warn('Could not persist custom rooms:', e);
    }

    if (assignedDeviceIds.length > 0) {
      const updatedDevices = devices.map((d) =>
        assignedDeviceIds.includes(d.id) ? { ...d, room: newRoomName as RoomName } : d
      );
      setDevices(updatedDevices);
      const changed = updatedDevices.filter((d) => assignedDeviceIds.includes(d.id));
      await saveBatchDevicesToDb(changed);
    }

    showToast(`Stanza "${newRoomName}" creata con successo!`);
  };

  const handleTurnOffRoom = async (roomName: string) => {
    const roomDevices = devices.filter((d) => d.room === roomName);
    const updated = devices.map((d) => {
      if (d.room === roomName) {
        return {
          ...d,
          state: {
            ...d.state,
            plug: d.state.plug ? { ...d.state.plug, power: false, watts: 0 } : undefined,
            light: d.state.light ? { ...d.state.light, power: false } : undefined,
            switch: d.state.switch ? { ...d.state.switch, power: false, gangs: d.state.switch.gangs.map(() => false) } : undefined,
          },
        };
      }
      return d;
    });

    setDevices(updated);
    showToast(`Tutti i dispositivi in "${roomName}" sono stati spenti.`);
    
    // Sync to cloud
    const toSave = updated.filter((d) => d.room === roomName);
    await saveBatchDevicesToDb(toSave);
  };

  const handleTurnOnRoom = async (roomName: string) => {
    const updated = devices.map((d) => {
      if (d.room === roomName) {
        return {
          ...d,
          state: {
            ...d.state,
            plug: d.state.plug ? { ...d.state.plug, power: true, watts: Math.max(d.state.plug.watts, 60) } : undefined,
            light: d.state.light ? { ...d.state.light, power: true, brightness: d.state.light.brightness || 80 } : undefined,
            switch: d.state.switch ? { ...d.state.switch, power: true, gangs: d.state.switch.gangs.map(() => true) } : undefined,
          },
        };
      }
      return d;
    });

    setDevices(updated);
    showToast(`Tutti i dispositivi in "${roomName}" sono stati accesi.`);
    
    // Sync to cloud
    const toSave = updated.filter((d) => d.room === roomName);
    await saveBatchDevicesToDb(toSave);
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
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl font-semibold text-xs shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-200 ${
          toastMessage.includes('⚠️') || toastMessage.includes('Errore')
            ? 'bg-amber-950/95 text-amber-100 border border-amber-500/50 backdrop-blur-md max-w-md'
            : 'bg-white text-slate-950 border border-amber-300'
        }`}>
          {toastMessage.includes('⚠️') ? (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span className="leading-tight">{toastMessage}</span>
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
        onOpenAddRoomModal={() => setIsAddRoomModalOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalActiveCount={totalActiveCount}
        totalWatts={totalWatts}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        
        {/* Tuya Cloud Quota Exceeded Banner */}
        {tuyaQuotaBannerVisible && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 border border-amber-500/30 text-amber-200 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <Zap className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-sm text-amber-100 flex items-center gap-2">
                  <span>Quota API Tuya Esaurita (Errore 60001001)</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono uppercase">IoT Core Trial</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  Il periodo di prova gratuito di <strong>IoT Core</strong> su Tuya Developer Cloud è terminato. L'app continua a funzionare perfettamente in <strong>modalità simulata / locale</strong>. Per riattivare il controllo hardware reale in tempo reale:
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <a
                href="https://iot.tuya.com"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md"
              >
                <span>Estendi Prova su iot.tuya.com</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Istruzioni
              </button>
              <button
                onClick={() => setTuyaQuotaBannerVisible(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Nascondi avviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
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
              customRooms={customRooms}
              onOpenAddRoomModal={() => setIsAddRoomModalOpen(true)}
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
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`text-xs font-bold px-3 py-1 rounded-full border transition cursor-pointer flex items-center gap-1.5 ${
                      isEditMode
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                    }`}
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>{isEditMode ? 'Fine Modifica' : 'Modifica Layout'}</span>
                  </button>

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
                        } ${
                          isEditMode ? 'animate-pulse ring-1 ring-amber-400/40' : ''
                        }`}
                      >
                        {/* Drag Handle Overlay Badge */}
                        <div
                          className={`absolute top-2 left-2 z-30 transition-opacity bg-black/75 backdrop-blur-md p-1 rounded-lg border border-white/20 text-slate-300 cursor-grab active:cursor-grabbing hover:text-amber-400 shadow-md ${
                            isEditMode ? 'opacity-100' : 'opacity-0 group-hover/drag:opacity-100'
                          }`}
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

        {/* TAB 2: Rooms View */}
        {activeTab === 'rooms' && (
          <RoomsTab
            devices={devices}
            customRooms={customRooms}
            onTogglePower={handleTogglePower}
            onUpdateState={handleUpdateDeviceState}
            onClickDetail={(d) => setSelectedDevice(d)}
            onOpenAddRoomModal={() => setIsAddRoomModalOpen(true)}
            onTurnOffRoom={handleTurnOffRoom}
            onTurnOnRoom={handleTurnOnRoom}
          />
        )}

        {/* TAB 3: Automations */}
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

        {/* TAB 4: Energy */}
        {activeTab === 'energy' && (
          <EnergyTab 
            devices={devices} 
            onTogglePower={handleTogglePower}
          />
        )}

        {/* TAB 5: AI Assistant */}
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
        availableRooms={Array.from(new Set([...customRooms, ...devices.map((d) => d.room).filter(Boolean)]))}
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

      <AddRoomModal
        isOpen={isAddRoomModalOpen}
        onClose={() => setIsAddRoomModalOpen(false)}
        onAddRoom={handleAddRoom}
        devices={devices}
        existingRooms={Array.from(new Set([...customRooms, ...devices.map((d) => d.room).filter(Boolean)]))}
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
