import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SmartDevice, AutomationRule, RoomName, RoomConfig, isWideDeviceCard } from './types';
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
import { RoomSettingsModal } from './components/RoomSettingsModal';
import { WallpaperModal } from './components/WallpaperModal';
import { motion, AnimatePresence } from 'motion/react';
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
import { sendTuyaCommand, pollTuyaDevicesStatus } from './services/smartLifeService';
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
  ChevronLeft,
  GripVertical,
  Move,
  RotateCcw,
  ExternalLink,
  X
} from 'lucide-react';

// ============================================================================
// CONFIGURAZIONE POLLING & SINCRONIZZAZIONE TUYA CLOUD
// ============================================================================
// Flag booleana per abilitare il polling automatico continuo in background (3-5s).
export const ENABLE_AUTO_POLLING = true;

// Intervallo di polling automatico (in ms). Impostato a 4 secondi (4000ms).
export const POLLING_INTERVAL = 4000;

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

  // Deleted Rooms list (persisted in localStorage)
  const [deletedRooms, setDeletedRooms] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('smartlife_hub_deleted_rooms');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Room Configurations (icons & dedicated wallpapers)
  const [roomConfigs, setRoomConfigs] = useState<Record<string, RoomConfig>>(() => {
    try {
      const saved = localStorage.getItem('smartlife_hub_room_configs');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modals & Drawers
  const [selectedDevice, setSelectedDevice] = useState<SmartDevice | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState<boolean>(false);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState<boolean>(false);
  const [isRoomSettingsModalOpen, setIsRoomSettingsModalOpen] = useState<boolean>(false);
  const [editingRoomName, setEditingRoomName] = useState<string>('');
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

  // Status Synchronization from Tuya Cloud (Manual, Interval Polling & Focus Sync)
  // Reflects real physical wall switch toggles, third-party app changes, and detects offline devices
  const devicesRef = useRef(devices);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // Calcolo e tracking dei dispositivi visibili a schermo per ottimizzare le chiamate API
  const visibleDeviceIdsRef = useRef<string[]>([]);
  useEffect(() => {
    let ids: string[] = [];
    const modalId = selectedDevice?.id || selectedDevice?.tuyaDeviceId;

    if (activeTab === 'devices') {
      ids = devices
        .filter((dev) => {
          const matchesRoom = selectedRoom === 'Tutti' || dev.room === selectedRoom;
          const matchesSearch =
            !searchQuery.trim() ||
            dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dev.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dev.category.toLowerCase().includes(searchQuery.toLowerCase());
          return matchesRoom && matchesSearch;
        })
        .map((d) => d.id || d.tuyaDeviceId)
        .filter(Boolean) as string[];
    } else if (activeTab === 'rooms') {
      if (selectedRoom !== 'Tutti') {
        ids = devices
          .filter((d) => d.room === selectedRoom)
          .map((d) => d.id || d.tuyaDeviceId)
          .filter(Boolean) as string[];
      } else {
        ids = devices.map((d) => d.id || d.tuyaDeviceId).filter(Boolean) as string[];
      }
    } else if (activeTab === 'energy') {
      ids = devices
        .filter((d) => d.category === 'plug' || d.category === 'thermostat' || d.energy)
        .map((d) => d.id || d.tuyaDeviceId)
        .filter(Boolean) as string[];
    } else {
      ids = devices.map((d) => d.id || d.tuyaDeviceId).filter(Boolean) as string[];
    }

    if (modalId && !ids.includes(modalId)) {
      ids.push(modalId);
    }
    visibleDeviceIdsRef.current = ids;
  }, [devices, activeTab, selectedRoom, searchQuery, selectedDevice]);

  const isPollingRef = useRef<boolean>(false);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  const handleSyncTuyaStatus = async (isManual = false, explicitTargetIds?: string[]) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    if (isManual) setIsManualSyncing(true);

    try {
      const targetIds = isManual ? undefined : (explicitTargetIds || visibleDeviceIdsRef.current);
      const result = await pollTuyaDevicesStatus(devicesRef.current, targetIds);

      if (result.hasChanges) {
        setDevices(result.updatedDevices);

        // Update active detail modal if the open device changed
        setSelectedDevice((currentSelected) => {
          if (!currentSelected) return null;
          const updated = result.updatedDevices.find((d) => d.id === currentSelected.id);
          return updated ? { ...currentSelected, ...updated } : currentSelected;
        });

        // Sync physical switch changes to Firestore DB seamlessly
        for (const updatedDev of result.updatedDevices) {
          const prevDev = devicesRef.current.find((d) => d.id === updatedDev.id);
          if (
            prevDev &&
            (prevDev.isOnline !== updatedDev.isOnline ||
              JSON.stringify(prevDev.state) !== JSON.stringify(updatedDev.state))
          ) {
            updateDeviceStateInDb(updatedDev.id, updatedDev.state).catch(() => {});
          }
        }
      }

      if (isManual) {
        if (result.hasChanges) {
          showToast(`Sincronizzazione completata: ${result.updatedCount} dispositivi aggiornati.`);
        } else {
          showToast('Dispositivi Tuya già sincronizzati allo stato più recente.');
        }
      }
    } catch {
      // Gestione Errori Silenziosa:
      // Se si verifica un errore durante il polling (es. quota 60001001 o problemi di rete),
      // l'eccezione viene intercettata senza mostrare banner o toast di errore intrusivi.
      if (isManual) {
        showToast('Sincronizzazione completata (stato locale attivo).');
      }
    } finally {
      isPollingRef.current = false;
      if (isManual) setIsManualSyncing(false);
    }
  };

  // Interval Polling: interroga ogni 4 secondi lo stato dei dispositivi visibili
  useEffect(() => {
    if (!ENABLE_AUTO_POLLING) {
      return;
    }

    let isMounted = true;
    const initialTimer = setTimeout(() => {
      if (isMounted && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleSyncTuyaStatus(false);
      }
    }, 1200);

    const pollInterval = setInterval(() => {
      if (isMounted && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleSyncTuyaStatus(false);
      }
    }, POLLING_INTERVAL);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(pollInterval);
    };
  }, []);

  // Focus Sync: Sincronizzazione immediata quando l'utente riapre o riporta l'app in primo piano
  useEffect(() => {
    const handleFocusOrVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleSyncTuyaStatus(false);
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    window.addEventListener('pageshow', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      window.removeEventListener('pageshow', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, []);

  // Aggiornamento on-demand silenzioso al cambio stanza (1 sola chiamata quando si seleziona una nuova stanza)
  const prevRoomRef = useRef(selectedRoom);
  useEffect(() => {
    if (prevRoomRef.current !== selectedRoom) {
      prevRoomRef.current = selectedRoom;
      handleSyncTuyaStatus(false);
    }
  }, [selectedRoom]);

  // Background Schedule Engine (Local / Cloud Timer Dispatcher)
  const lastExecutedSchedulesRef = useRef<Record<string, string>>({}); // scheduleId -> "YYYY-MM-DD-HH:MM"

  useEffect(() => {
    const timerInterval = setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;
      const dayIndex = now.getDay(); // 0 = Sun, 1 = Mon ...
      const dayMap: Record<number, string> = {
        0: 'Dom',
        1: 'Lun',
        2: 'Mar',
        3: 'Mer',
        4: 'Gio',
        5: 'Ven',
        6: 'Sab',
      };
      const currentDayCode = dayMap[dayIndex] || 'Lun';
      const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${currentTimeStr}`;

      devices.forEach((dev) => {
        if (!dev.schedules || dev.schedules.length === 0) return;

        dev.schedules.forEach((sc) => {
          if (!sc.enabled) return;
          if (sc.time !== currentTimeStr) return;
          if (sc.days && sc.days.length > 0 && !sc.days.includes(currentDayCode)) return;

          // Check if already executed in this minute
          if (lastExecutedSchedulesRef.current[sc.id] === dateKey) return;
          lastExecutedSchedulesRef.current[sc.id] = dateKey;

          // Execute action
          console.log(`[Schedule Engine] Executing schedule ${sc.id} for device ${dev.name}: ${sc.action ? 'ON' : 'OFF'} on channel ${sc.channel || 'default'}`);

          if (sc.channel && (sc.channel.startsWith('switch_') || sc.channel.startsWith('button_'))) {
            handleToggleChannel(dev, sc.channel, sc.action);
          } else {
            // Main device power
            const currentP = dev.state.plug?.power ?? dev.state.light?.power ?? dev.state.switch?.power ?? false;
            if (currentP !== sc.action) {
              handleTogglePower(dev);
            }
          }

          showToast(`⏰ Timer eseguito: ${dev.name} ${sc.action ? 'Acceso (ON)' : 'Spento (OFF)'}`);
        });
      });
    }, 10000); // check every 10 seconds

    return () => clearInterval(timerInterval);
  }, [devices]);

  const showToast = (msg: string, duration = 3000) => {
    setToastMessage(msg);
    const timeoutDuration = msg.includes('⚠️') || msg.length > 50 ? 6500 : duration;
    setTimeout(() => setToastMessage(null), timeoutDuration);
  };

  // Device Action Handlers - Persisted to Firestore Cloud DB & Tuya Cloud OpenAPI
  const handleTogglePower = async (device: SmartDevice) => {
    const d = device;
    const newDev = { ...d, state: { ...d.state } };

    const isCancelletto =
      (device.name || '').toLowerCase().includes('cancelletto') ||
      (device.id || '').toLowerCase().includes('cancelletto') ||
      (device.tuyaDeviceId || '').toLowerCase().includes('cancelletto');

    const isGateOrImpulse =
      isCancelletto ||
      d.category === 'gate' ||
      d.category === 'pulsed_switch' ||
      d.customIcon === 'gate' ||
      d.customIcon === 'pulsed_switch' ||
      (device.name || '').toLowerCase().includes('cancello') ||
      (device.name || '').toLowerCase().includes('varco') ||
      (device.name || '').toLowerCase().includes('portoncino');

    if (isGateOrImpulse) {
      let dpCode = isCancelletto ? 'switch' : 'switch_1';
      if (d.dpCode && d.dpCode.trim()) {
        dpCode = d.dpCode.trim();
      } else if (d.channel && d.channel !== '1' && d.channel !== 'default') {
        dpCode = d.channel;
      }

      const tuyaId = d.tuyaDeviceId || d.id;

      // 1. Invia subito il comando di accensione ("value": true / "switch": true)
      const step1Dev: SmartDevice = {
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

      setDevices((prev) => prev.map((item) => (item.id === device.id ? step1Dev : item)));
      if (selectedDevice && selectedDevice.id === device.id) {
        setSelectedDevice(step1Dev);
      }
      showToast(`Inviato impulso a "${device.name}" (ON...)`);

      if (tuyaId) {
        sendTuyaCommand(tuyaId, [{ code: dpCode, value: true }], undefined, undefined, {
          category: d.category,
          isGate: true,
          dpCode,
          deviceName: d.name,
        })
          .then((res) => {
            console.log('Tuya Response Gate Step 1 (ON):', res);
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

      // 2. Attendi 1.5 secondi (1500 ms)
      // 3. Invia automaticamente il comando di spegnimento ("switch": false) e riporta lo stato UI su OFF
      setTimeout(async () => {
        if (tuyaId) {
          sendTuyaCommand(tuyaId, [{ code: dpCode, value: false }], undefined, undefined, {
            category: d.category,
            isGate: true,
            dpCode,
            deviceName: d.name,
          })
            .then((res) => {
              console.log('Tuya Response Gate Step 2 (Auto-OFF):', res);
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
              ...(d.state.switch || { gangs: [false] }),
              power: false,
              gangs: [false],
            },
            ...((d.state as any)?.power !== undefined ? { power: false } : {}),
          },
        };

        setDevices((prev) => prev.map((item) => (item.id === device.id ? step2Dev : item)));
        if (selectedDevice && selectedDevice.id === device.id) {
          setSelectedDevice(step2Dev);
        }

        try {
          await saveDeviceToDb(step2Dev);
        } catch (dbErr) {
          console.warn('Firestore sync warning:', dbErr);
        }
      }, 1500);

      return;
    }

    let commandCode = 'switch_1';
    let commandValue: boolean = true;

    if (d.category === 'plug' || (d as any).tuyaCategory === 'cz' || (d as any).tuyaCategory === 'socket' || (d.name || '').toLowerCase().includes('presa')) {
      const currentPower = d.state.plug?.power ?? false;
      const nextPower = !currentPower;
      commandCode = 'switch_go';
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

  const handleToggleChannel = async (device: SmartDevice, channelDp: string, nextValue?: boolean) => {
    const dpMap: Record<string, number> = { switch_1: 0, switch_2: 1, switch_3: 2, switch_4: 3 };
    const idx = dpMap[channelDp] !== undefined ? dpMap[channelDp] : 0;

    const currentGangs = device.state.switch?.gangs && device.state.switch.gangs.length >= 4
      ? [...device.state.switch.gangs]
      : [
          Boolean(device.state.switch?.channelStates?.switch_1 ?? device.state.switch?.gangs?.[0]),
          Boolean(device.state.switch?.channelStates?.switch_2 ?? device.state.switch?.gangs?.[1]),
          Boolean(device.state.switch?.channelStates?.switch_3 ?? device.state.switch?.gangs?.[2]),
          Boolean(device.state.switch?.channelStates?.switch_4 ?? device.state.switch?.gangs?.[3]),
        ];

    const currentVal = currentGangs[idx] ?? false;
    const targetVal = nextValue !== undefined ? nextValue : !currentVal;
    currentGangs[idx] = targetVal;

    const currentChannelStates = {
      ...(device.state.switch?.channelStates || {}),
      switch_1: currentGangs[0],
      switch_2: currentGangs[1],
      switch_3: currentGangs[2],
      switch_4: currentGangs[3],
      [channelDp]: targetVal,
    };

    const newDev: SmartDevice = {
      ...device,
      state: {
        ...device.state,
        switch: {
          ...(device.state.switch || { power: false, gangs: [false, false, false, false] }),
          gangs: currentGangs,
          channelStates: currentChannelStates,
          power: currentGangs.some(Boolean),
        },
      },
    };

    // 1. Immediate UI update
    setDevices((prev) => prev.map((item) => (item.id === device.id ? newDev : item)));
    if (selectedDevice?.id === device.id) {
      setSelectedDevice(newDev);
    }

    // Persist immediately to Firestore DB
    try {
      await saveDeviceToDb(newDev);
    } catch (dbErr) {
      console.warn('Firestore sync warning:', dbErr);
    }

    // 2. Dispatch real Tuya Cloud OpenAPI command via /api/tuya-command
    const zoneLabels: Record<string, string> = {
      switch_1: 'Lato Cancellone',
      switch_2: 'Centrale',
      switch_3: 'Lato Cancelletto',
      switch_4: 'Switch 4',
    };
    const zoneLabel = zoneLabels[channelDp] || channelDp;

    const tuyaId = device.tuyaDeviceId || device.id;
    if (tuyaId) {
      try {
        const res = await sendTuyaCommand(tuyaId, channelDp, targetVal, undefined, {
          category: 'switch',
          dpCode: channelDp,
          deviceName: device.name,
        });
        if (res.success) {
          showToast(`Tuya ${zoneLabel}: ${targetVal ? 'Acceso' : 'Spento'}`);
        } else {
          showToast(`${zoneLabel}: ${targetVal ? 'Acceso' : 'Spento'}`);
        }
      } catch (err: any) {
        showToast(`${zoneLabel}: ${targetVal ? 'Acceso' : 'Spento'}`);
      }
    } else {
      showToast(`${zoneLabel}: ${targetVal ? 'Acceso' : 'Spento'}`);
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
  const handleAddRoom = async (newRoomName: string, iconName: string, assignedDeviceIds: string[], roomWallpaperUrl?: string) => {
    const updatedCustom = Array.from(new Set([...customRooms, newRoomName]));
    setCustomRooms(updatedCustom);
    
    // Remove from deletedRooms if it was previously deleted
    const updatedDeleted = deletedRooms.filter((r) => r.toLowerCase() !== newRoomName.toLowerCase());
    setDeletedRooms(updatedDeleted);

    const updatedConfigs: Record<string, RoomConfig> = {
      ...roomConfigs,
      [newRoomName]: {
        name: newRoomName,
        iconName: iconName || 'Home',
        wallpaperUrl: roomWallpaperUrl || '',
      },
    };
    setRoomConfigs(updatedConfigs);

    try {
      localStorage.setItem('smartlife_hub_custom_rooms', JSON.stringify(updatedCustom));
      localStorage.setItem('smartlife_hub_deleted_rooms', JSON.stringify(updatedDeleted));
      localStorage.setItem('smartlife_hub_room_configs', JSON.stringify(updatedConfigs));
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

  const handleSaveRoomConfig = async (originalName: string, newConfig: RoomConfig, assignedDeviceIds: string[]) => {
    const nameChanged = originalName !== newConfig.name;

    // 1. Update customRooms & deletedRooms
    let updatedCustom = [...customRooms];
    if (nameChanged) {
      updatedCustom = updatedCustom.map((r) => (r === originalName ? newConfig.name : r));
      if (!updatedCustom.includes(newConfig.name)) {
        updatedCustom.push(newConfig.name);
      }
    }
    setCustomRooms(updatedCustom);

    // 2. Update roomConfigs mapping
    const updatedConfigs: Record<string, RoomConfig> = { ...roomConfigs };
    if (nameChanged) {
      delete updatedConfigs[originalName];
    }
    updatedConfigs[newConfig.name] = newConfig;
    setRoomConfigs(updatedConfigs);

    // 3. Update device room assignments
    const updatedDevices = devices.map((d) => {
      const isAssigned = assignedDeviceIds.includes(d.id);
      const wasInThisRoom = d.room === originalName;
      if (isAssigned) {
        return { ...d, room: newConfig.name as RoomName };
      } else if (wasInThisRoom) {
        return { ...d, room: 'Senza Stanza' as RoomName };
      }
      return d;
    });
    setDevices(updatedDevices);

    // 4. Update selectedRoom if currently viewing renamed room
    if (selectedRoom === originalName) {
      setSelectedRoom(newConfig.name as RoomName);
    }

    // 5. Persist to localStorage
    try {
      localStorage.setItem('smartlife_hub_custom_rooms', JSON.stringify(updatedCustom));
      localStorage.setItem('smartlife_hub_room_configs', JSON.stringify(updatedConfigs));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }

    // 6. Sync updated devices to Cloud DB
    const changedDevices = updatedDevices.filter((d) => assignedDeviceIds.includes(d.id) || (d.room === ('Senza Stanza' as RoomName) && devices.find(x => x.id === d.id)?.room === originalName));
    if (changedDevices.length > 0) {
      await saveBatchDevicesToDb(changedDevices);
    }

    showToast(`Stanza "${newConfig.name}" personalizzata con successo!`);
  };

  const handleDeleteRoom = async (roomToDelete: string) => {
    // 1. Add to deletedRooms
    const updatedDeleted = Array.from(new Set([...deletedRooms, roomToDelete]));
    setDeletedRooms(updatedDeleted);

    // 2. Remove from customRooms
    const updatedCustom = customRooms.filter((r) => r !== roomToDelete);
    setCustomRooms(updatedCustom);

    // 3. Clean up roomConfigs
    const updatedConfigs = { ...roomConfigs };
    delete updatedConfigs[roomToDelete];
    setRoomConfigs(updatedConfigs);

    // 4. Reassign devices that were in this room
    const affectedDeviceIds: string[] = [];
    const updatedDevices = devices.map((d) => {
      if (d.room === roomToDelete) {
        affectedDeviceIds.push(d.id);
        return { ...d, room: 'Senza Stanza' as RoomName };
      }
      return d;
    });
    setDevices(updatedDevices);

    // 5. If user was on deleted room, reset to 'Tutti'
    if (selectedRoom === roomToDelete) {
      setSelectedRoom('Tutti');
    }

    // 6. Save to localStorage
    try {
      localStorage.setItem('smartlife_hub_deleted_rooms', JSON.stringify(updatedDeleted));
      localStorage.setItem('smartlife_hub_custom_rooms', JSON.stringify(updatedCustom));
      localStorage.setItem('smartlife_hub_room_configs', JSON.stringify(updatedConfigs));
    } catch (e) {
      console.warn('LocalStorage error on room deletion:', e);
    }

    // 7. Save affected devices to Firestore DB
    if (affectedDeviceIds.length > 0) {
      const changed = updatedDevices.filter((d) => affectedDeviceIds.includes(d.id));
      await saveBatchDevicesToDb(changed);
    }

    showToast(`Stanza "${roomToDelete}" eliminata.`);
  };

  const handleOpenRoomSettings = (roomName: string) => {
    setEditingRoomName(roomName);
    setIsRoomSettingsModalOpen(true);
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

  // Aggregate all unique room names (filtering out deleted rooms)
  const allRoomsList = useMemo(() => {
    const base = ['Tutti', 'Salotto', 'Cucina', 'Camera da Letto', 'Bagno', 'Studio', 'Ingresso', 'Giardino', 'Garage'];
    const fromDevices = devices.map((d) => d.room).filter(Boolean);
    const combined = Array.from(new Set([...base, ...customRooms, ...fromDevices]));
    const deletedSet = new Set(deletedRooms.map((r) => r.toLowerCase()));
    return combined.filter((r) => r === 'Tutti' || !deletedSet.has(r.toLowerCase()));
  }, [devices, customRooms, deletedRooms]);

  // Remote Webhook / URL Query Command Listener on App Load (e.g. /?q=accendi%20ripostiglio or /?device=Ripostiglio&action=ON)
  const webhookExecutedRef = useRef<string>('');
  useEffect(() => {
    if (typeof window === 'undefined' || devices.length === 0) return;
    const searchParams = new URLSearchParams(window.location.search);
    const rawQParam = searchParams.get('q') || searchParams.get('query') || searchParams.get('command') || searchParams.get('text');
    let deviceParam = searchParams.get('device') || searchParams.get('name') || searchParams.get('target');
    let actionParam = searchParams.get('action') || searchParams.get('state') || searchParams.get('power') || searchParams.get('cmd');

    let originalQueryText = '';

    if (rawQParam) {
      try {
        originalQueryText = decodeURIComponent(rawQParam.replace(/\+/g, ' ')).trim();
      } catch {
        originalQueryText = rawQParam.replace(/\+/g, ' ').trim();
      }

      const cleanQ = originalQueryText.toLowerCase();

      // Detect action from natural language query
      if (/\b(spegni|disattiva|chiudi|stop|ferma|stacca|abbassa|off|close)\b/i.test(cleanQ)) {
        if (!actionParam) actionParam = 'OFF';
      } else if (/\b(accendi|attiva|apri|avvia|fai partire|illumina|on|open)\b/i.test(cleanQ)) {
        if (!actionParam) actionParam = 'ON';
      } else if (/\b(cambia|toggle|switch|inverti)\b/i.test(cleanQ)) {
        if (!actionParam) actionParam = 'TOGGLE';
      }

      if (!deviceParam) {
        deviceParam = cleanQ
          .replace(/^(ehi\s+|hey\s+|ok\s+|ciao\s+)?(siri|google|alexa|smart\s*life|casa)\s+/i, '')
          .replace(/^(per favore\s+|puoi\s+|cortesemente\s+|esegui\s+)/i, '')
          .replace(/\b(spegni|disattiva|chiudi|stop|ferma|stacca|abbassa|off|close|accendi|attiva|apri|avvia|fai partire|illumina|on|open|cambia|toggle|switch|inverti)\b/gi, ' ')
          .replace(/\b(il|lo|la|i|gli|le|un|uno|una|tutti|tutte|i dispositivi in|le luci in|le luci del|la luce in|la luce del|la presa in|la presa del|in|nel|nella|nello|negli|nelle|del|della|dello)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }

    if (!deviceParam && !originalQueryText) return;

    const rawKey = `${deviceParam || originalQueryText}_${actionParam || 'ON'}_${window.location.search}`;
    if (webhookExecutedRef.current === rawKey) return;
    webhookExecutedRef.current = rawKey;

    let targetClean = '';
    try {
      targetClean = decodeURIComponent((deviceParam || '').replace(/\+/g, ' ')).toLowerCase().trim();
    } catch {
      targetClean = (deviceParam || '').replace(/\+/g, ' ').toLowerCase().trim();
    }

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const normTarget = normalize(targetClean);

    const isTurnOn = ['ON', 'TRUE', '1', 'ACCENDI', 'ATTIVA', 'APRI', 'OPEN', 'START'].includes(
      (actionParam || 'ON').toUpperCase()
    );
    const isTurnOff = ['OFF', 'FALSE', '0', 'SPEGNI', 'DISATTIVA', 'CHIUDI', 'CLOSE', 'STOP'].includes(
      (actionParam || '').toUpperCase()
    );
    const isToggle = ['TOGGLE', 'SWITCH', 'CAMBIA', 'INVERTI'].includes((actionParam || '').toUpperCase());

    // Known device alias dictionary for smart matching
    const aliasMapping: Record<string, string[]> = {
      ripostiglio: ['ripostiglio', 'luce ripostiglio', 'sgabuzzino'],
      salone: ['salone', 'luce salone', 'salotto'],
      cancellone: ['cancellone', 'cancello', 'carraio'],
      cancelletto: ['cancelletto', 'pedonale', 'portone', 'portoncino'],
      presa: ['presa', 'presa marco', 'presa wi-fi', 'presa smart'],
      camera: ['camera', 'camera da letto', 'luce camera'],
      cucina: ['cucina', 'luce cucina'],
      giardino: ['giardino', 'irrigazione', 'prato'],
      termostato: ['termostato', 'caldaia', 'riscaldamento', 'termosifoni', 'termosifone'],
      garage: ['garage', 'box'],
      bagno: ['bagno', 'luce bagno'],
      studio: ['studio', 'ufficio'],
    };

    // 1. Find device matching by name, room, alias or ID
    const matchedDevice = devices.find((d) => {
      const dName = normalize(d.name);
      const dRoom = normalize(d.room);
      const dId = normalize(d.id);
      const dTuya = normalize(d.tuyaDeviceId || '');

      if (dName === normTarget || dName.includes(normTarget) || normTarget.includes(dName)) return true;
      if (dRoom === normTarget || dRoom.includes(normTarget) || normTarget.includes(dRoom)) return true;
      if (dId === normTarget || dTuya === normTarget) return true;

      for (const [aliasKey, aliases] of Object.entries(aliasMapping)) {
        if (aliases.some((a) => normalize(a) === normTarget || normTarget.includes(normalize(a)))) {
          if (dName.includes(normalize(aliasKey)) || dRoom.includes(normalize(aliasKey))) {
            return true;
          }
        }
      }

      return false;
    });

    // 2. Check if matching an entire room
    const matchedRoom = allRoomsList.find((r) => {
      const nRoom = normalize(r);
      return nRoom === normTarget || nRoom.includes(normTarget) || normTarget.includes(nRoom);
    });

    const commandNotificationText = originalQueryText ? `Comando da Siri eseguito: ${originalQueryText}` : '';

    if (matchedDevice) {
      const isGate =
        matchedDevice.category === 'lock' ||
        (matchedDevice.name || '').toLowerCase().includes('cancello') ||
        (matchedDevice.name || '').toLowerCase().includes('cancellone') ||
        (matchedDevice.name || '').toLowerCase().includes('cancelletto') ||
        (matchedDevice.name || '').toLowerCase().includes('portone') ||
        (matchedDevice.name || '').toLowerCase().includes('pedonale');

      const isCurrentlyOn = Boolean(
        matchedDevice.state.light?.power ??
          matchedDevice.state.plug?.power ??
          matchedDevice.state.switch?.power ??
          matchedDevice.state.thermostat?.power ??
          (matchedDevice.state as any)?.power ??
          false
      );

      if (isGate) {
        // Gate pulse action (ON -> 1.5s -> auto-OFF)
        handleTogglePower(matchedDevice);
        showToast(commandNotificationText || `⚡ Comando da Siri eseguito: Impulso ${matchedDevice.name}`);
      } else if (isToggle || (isTurnOn && !isCurrentlyOn) || (isTurnOff && isCurrentlyOn)) {
        handleTogglePower(matchedDevice);
        showToast(commandNotificationText || `⚡ Comando da Siri eseguito: ${matchedDevice.name} -> ${isTurnOff ? 'SPENTO' : 'ACCESO'}`);
      } else {
        // Already in target state, re-trigger or confirm
        handleTogglePower(matchedDevice);
        showToast(commandNotificationText || `⚡ Comando da Siri eseguito: ${matchedDevice.name} (${isTurnOff ? 'OFF' : 'ON'})`);
      }
    } else if (matchedRoom && matchedRoom !== 'Tutti') {
      if (isTurnOff) {
        handleTurnOffRoom(matchedRoom);
      } else {
        handleTurnOnRoom(matchedRoom);
      }
      showToast(commandNotificationText || `⚡ Comando da Siri eseguito: Stanza ${matchedRoom} -> ${isTurnOff ? 'SPENTA' : 'ACCESA'}`);
    } else {
      showToast(commandNotificationText ? `${commandNotificationText} (Dispositivo: "${targetClean || originalQueryText}")` : `⚠️ Nessun dispositivo trovato per "${targetClean}"`);
    }

    // Clean query parameters from URL without reloading so refreshes don't re-trigger
    try {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch {
      // Ignore
    }
  }, [devices, allRoomsList]);

  const currentRoomIndex = allRoomsList.indexOf(selectedRoom);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right'>('left');

  const handleGoNextRoom = () => {
    setSwipeDirection('left');
    if (currentRoomIndex < allRoomsList.length - 1) {
      setSelectedRoom(allRoomsList[currentRoomIndex + 1]);
    } else {
      setSelectedRoom(allRoomsList[0]);
    }
  };

  const handleGoPrevRoom = () => {
    setSwipeDirection('right');
    if (currentRoomIndex > 0) {
      setSelectedRoom(allRoomsList[currentRoomIndex - 1]);
    } else {
      setSelectedRoom(allRoomsList[allRoomsList.length - 1]);
    }
  };

  // Touch Swipe Gesture Detection
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartTimeRef.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    const duration = Date.now() - touchStartTimeRef.current;

    // Trigger swipe if horizontal displacement is significant and faster than 900ms
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1 && duration < 900) {
      if (activeTab === 'devices') {
        if (deltaX < 0) {
          // Swipe Left -> Next room
          handleGoNextRoom();
        } else {
          // Swipe Right -> Prev room
          handleGoPrevRoom();
        }
      } else {
        // Swiping across tabs
        const tabs: ('devices' | 'rooms' | 'automations' | 'energy')[] = ['devices', 'rooms', 'automations', 'energy'];
        const tabIdx = tabs.indexOf(activeTab as any);
        if (tabIdx !== -1) {
          if (deltaX < 0 && tabIdx < tabs.length - 1) {
            setActiveTab(tabs[tabIdx + 1]);
          } else if (deltaX > 0 && tabIdx > 0) {
            setActiveTab(tabs[tabIdx - 1]);
          }
        }
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

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

  // Dedicated room wallpaper takes priority over global wallpaper when in room view
  const activeBackgroundWallpaper = (selectedRoom !== 'Tutti' && roomConfigs[selectedRoom]?.wallpaperUrl) || wallpaperUrl;

  return (
    <div 
      className="min-h-screen bg-[#080b11] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950 relative overflow-x-hidden bg-cover bg-center bg-fixed transition-all duration-300"
      style={activeBackgroundWallpaper ? { backgroundImage: `url(${activeBackgroundWallpaper})` } : {}}
    >
      {/* Background Ambient Overlay or Orbs */}
      {activeBackgroundWallpaper ? (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] pointer-events-none" />
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
        onManualSync={() => handleSyncTuyaStatus(true)}
        isManualSyncing={isManualSyncing}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalActiveCount={totalActiveCount}
        totalWatts={totalWatts}
      />

      {/* Main Container with Touch Swipe support */}
      <main 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10 touch-pan-y"
      >
        
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
            {/* Room Filter Navigation */}
            <RoomFilter
              selectedRoom={selectedRoom}
              onSelectRoom={setSelectedRoom}
              devices={devices}
              customRooms={customRooms}
              deletedRooms={deletedRooms}
              roomConfigs={roomConfigs}
              onOpenAddRoomModal={() => setIsAddRoomModalOpen(true)}
              onOpenRoomSettings={handleOpenRoomSettings}
            />

            {/* Device Cards Grid with Room Swipe Controls */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {selectedRoom === 'Tutti' ? 'Tutti i Dispositivi' : `Stanza: ${selectedRoom}`} ({filteredDevices.length})
                    </span>
                  </h3>

                  {/* Room Quick Switcher & Swipe Indicator */}
                  <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                    <button
                      type="button"
                      onClick={handleGoPrevRoom}
                      className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                      title="Stanza precedente (o swipe a destra)"
                      aria-label="Stanza precedente"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    
                    {/* Room Dots Indicator */}
                    <div className="flex items-center gap-1 px-1">
                      {allRoomsList.map((r, i) => (
                        <div
                          key={r}
                          onClick={() => setSelectedRoom(r)}
                          className={`rounded-full transition-all cursor-pointer ${
                            selectedRoom === r
                              ? 'w-3 h-1.5 bg-amber-400 shadow-sm'
                              : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
                          }`}
                          title={`Vai a ${r}`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleGoNextRoom}
                      className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                      title="Stanza successiva (o swipe a sinistra)"
                      aria-label="Stanza successiva"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-[10px] text-slate-400 hidden lg:inline-flex items-center gap-1 opacity-70">
                    👈 Swipe per cambiare stanza 👉
                  </span>
                </div>

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
                  <p className="text-sm text-slate-400">Nessun dispositivo trovato per la stanza "{selectedRoom}".</p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setSelectedRoom('Tutti')}
                      className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-2 rounded-full transition cursor-pointer"
                    >
                      Mostra Tutti
                    </button>
                    <button
                      onClick={() => setIsTransferModalOpen(true)}
                      className="bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-full transition cursor-pointer hover:bg-amber-300"
                    >
                      Importa da Smart Life / Tuya
                    </button>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedRoom}
                    initial={{ opacity: 0, x: swipeDirection === 'left' ? 24 : -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: swipeDirection === 'left' ? -24 : 24 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
                  >
                    {filteredDevices.map((dev) => {
                      const isDragging = draggedDeviceId === dev.id;
                      const isDragOver = dragOverDeviceId === dev.id;
                      const isWide = isWideDeviceCard(dev);

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
                            isWide ? 'col-span-full' : ''
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
                            onToggleChannel={handleToggleChannel}
                          />
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Rooms View */}
        {activeTab === 'rooms' && (
          <RoomsTab
            devices={devices}
            customRooms={customRooms}
            deletedRooms={deletedRooms}
            roomConfigs={roomConfigs}
            onTogglePower={handleTogglePower}
            onUpdateState={handleUpdateDeviceState}
            onClickDetail={(d) => setSelectedDevice(d)}
            onOpenAddRoomModal={() => setIsAddRoomModalOpen(true)}
            onOpenRoomSettings={handleOpenRoomSettings}
            onTurnOffRoom={handleTurnOffRoom}
            onTurnOnRoom={handleTurnOnRoom}
            onToggleChannel={handleToggleChannel}
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
        availableRooms={allRoomsList.filter(r => r !== 'Tutti')}
        onTogglePower={handleTogglePower}
        onToggleChannel={handleToggleChannel}
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
        existingRooms={allRoomsList.filter(r => r !== 'Tutti')}
      />

      <RoomSettingsModal
        isOpen={isRoomSettingsModalOpen}
        onClose={() => setIsRoomSettingsModalOpen(false)}
        roomName={editingRoomName}
        devices={devices}
        roomConfig={roomConfigs[editingRoomName]}
        existingConfig={roomConfigs[editingRoomName]}
        onSaveRoomConfig={handleSaveRoomConfig}
        onSaveConfig={handleSaveRoomConfig}
        onDeleteRoom={handleDeleteRoom}
        allRooms={allRoomsList.filter(r => r !== 'Tutti')}
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
