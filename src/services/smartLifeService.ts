import CryptoJS from 'crypto-js';
import { SmartDevice, ImportResult, TuyaCloudCredentials, RoomName, DeviceCategory } from '../types';
import { safeStorage } from '../utils/safeStorage';

/**
 * Helper to map Tuya device category codes to our standard categories
 */
function mapTuyaCategory(categoryCode?: string, name?: string): DeviceCategory {
  const code = (categoryCode || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();

  if (code === 'cz' || lowerName.includes('presa') || lowerName.includes('plug') || lowerName.includes('socket')) {
    return 'plug';
  }
  if (code === 'dj' || code === 'tgq' || code === 'dd' || lowerName.includes('lamp') || lowerName.includes('luce') || lowerName.includes('led') || lowerName.includes('bulb')) {
    return 'light';
  }
  if (
    code === 'wk' ||
    lowerName.includes('termo') ||
    lowerName.includes('termosifoni') ||
    lowerName.includes('termosifone') ||
    lowerName.includes('caldaia') ||
    lowerName.includes('thermostat') ||
    lowerName.includes('clima') ||
    lowerName.includes('riscaldamento')
  ) {
    return 'thermostat';
  }
  if (code === 'sp' || lowerName.includes('camera') || lowerName.includes('telecamera') || lowerName.includes('cam')) {
    return 'camera';
  }
  if (code === 'ms' || lowerName.includes('serratura') || lowerName.includes('lock')) {
    return 'lock';
  }
  if (code === 'sj' || code === 'cg' || lowerName.includes('sensore') || lowerName.includes('sensor') || lowerName.includes('finestra') || lowerName.includes('allagamento')) {
    return 'sensor';
  }
  if (code === 'sd' || lowerName.includes('robot') || lowerName.includes('aspirapolvere') || lowerName.includes('vacuum')) {
    return 'vacuum';
  }
  if (code === 'cl' || lowerName.includes('tapparella') || lowerName.includes('tenda') || lowerName.includes('curtain')) {
    return 'curtains';
  }
  if (code === 'kg' || lowerName.includes('interruttore') || lowerName.includes('switch')) {
    return 'switch';
  }

  return 'plug'; // Default fallback
}

/**
 * Validates and parses a Smart Life JSON backup/export
 */
export function parseSmartLifeJsonBackup(jsonString: string): ImportResult {
  try {
    const parsed = JSON.parse(jsonString);
    const rawDevices = parsed.devices || (Array.isArray(parsed) ? parsed : []);

    if (!Array.isArray(rawDevices) || rawDevices.length === 0) {
      return {
        success: false,
        message: 'Nessun dispositivo Smart Life trovato nel file JSON fornito.',
        importedCount: 0,
        devices: [],
        source: 'json_backup',
      };
    }

    const importedDevices: SmartDevice[] = rawDevices.map((item: any, idx: number) => {
      const cat = mapTuyaCategory(item.category || item.type, item.name);
      const room: RoomName = (item.room as RoomName) || 'Salotto';
      const deviceId = item.devId || item.id || `sl-import-${Date.now()}-${idx}`;

      const newDev: SmartDevice = {
        id: deviceId,
        tuyaDeviceId: item.devId || `tuya_${Math.random().toString(36).substring(2, 10)}`,
        name: item.name || `Dispositivo Smart Life ${idx + 1}`,
        category: cat,
        room,
        vendor: 'Smart Life (Tuya)',
        isOnline: item.online !== undefined ? item.online : true,
        signalStrength: item.signal || -60,
        transferredFromSmartLife: true,
        transferredAt: new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }),
        state: {},
      };

      // Populate default state based on category
      if (cat === 'plug') {
        newDev.state.plug = {
          power: item.dps?.['1'] ?? true,
          watts: item.dps?.['18'] ?? 0,
          voltage: item.dps?.['19'] ?? 230,
          current: 0,
          totalKwh: 5.4,
        };
      } else if (cat === 'light') {
        newDev.state.light = {
          power: item.dps?.['20'] ?? true,
          brightness: item.dps?.['22'] ?? 80,
          color: item.dps?.['24'] || '#3b82f6',
          colorTemp: 4000,
          mode: 'color',
        };
      } else if (cat === 'thermostat') {
        const rawCurrent =
          item.dps?.['temp_current'] ??
          item.dps?.['va_temperature'] ??
          item.dps?.['current_temp'] ??
          item.dps?.['temp_indoor'] ??
          item.temp_current ??
          item.va_temperature ??
          item.current_temp ??
          item.temp_indoor ??
          item.dps?.['cur_temp'] ??
          item.dps?.['16'] ??
          item.dps?.['18'] ??
          item.currentTemp ??
          31.0;
        const numCurrent = Number(rawCurrent);
        const parsedCurrent = !isNaN(numCurrent) ? (numCurrent > 100 ? Math.round((numCurrent / 10) * 10) / 10 : numCurrent) : 31.0;

        const rawTarget =
          item.dps?.['temp_set'] ??
          item.dps?.['target_temp'] ??
          item.dps?.['temp_target'] ??
          item.dps?.['set_temp'] ??
          item.dps?.['upper_temp'] ??
          item.dps?.['24'] ??
          item.dps?.['2'] ??
          item.temp_set ??
          item.target_temp ??
          item.targetTemp ??
          22.0;
        const numTarget = Number(rawTarget);
        const parsedTarget = !isNaN(numTarget) ? (numTarget > 100 ? Math.round((numTarget / 10) * 10) / 10 : numTarget) : 22.0;

        newDev.state.thermostat = {
          power: item.dps?.['1'] ?? item.dps?.['switch'] ?? true,
          currentTemp: parsedCurrent,
          targetTemp: parsedTarget,
          humidity: item.dps?.['humidity'] ?? item.dps?.['19'] ?? 48,
          mode: 'heat',
          fanSpeed: 'auto',
        };
      } else if (cat === 'sensor') {
        newDev.state.sensor = {
          triggered: false,
          sensorType: item.name?.toLowerCase().includes('allagamento') ? 'water' : 'door',
          battery: item.dps?.['2'] || 95,
        };
      } else if (cat === 'switch' || cat === 'gate' || cat === 'pulsed_switch') {
        const sw1 = item.dps?.['switch_1'] ?? item.dps?.['1'] ?? item.dps?.['switch'] ?? false;
        const sw2 = item.dps?.['switch_2'] ?? item.dps?.['2'] ?? false;
        const sw3 = item.dps?.['switch_3'] ?? item.dps?.['3'] ?? false;
        const sw4 = item.dps?.['switch_4'] ?? item.dps?.['4'] ?? false;
        newDev.state.switch = {
          power: Boolean(sw1 || sw2 || sw3 || sw4),
          gangs: [Boolean(sw1), Boolean(sw2), Boolean(sw3), Boolean(sw4)],
          channelStates: {
            switch_1: Boolean(sw1),
            switch_2: Boolean(sw2),
            switch_3: Boolean(sw3),
            switch_4: Boolean(sw4),
          },
        };
      } else {
        newDev.state.plug = {
          power: true,
          watts: 0,
          voltage: 230,
          current: 0,
          totalKwh: 0,
        };
      }

      return newDev;
    });

    return {
      success: true,
      message: `Trovati e migrati con successo ${importedDevices.length} dispositivi da Smart Life!`,
      importedCount: importedDevices.length,
      devices: importedDevices,
      source: 'json_backup',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Errore nella lettura del file JSON: ${err?.message || 'Formato non valido'}`,
      importedCount: 0,
      devices: [],
      source: 'json_backup',
    };
  }
}

/**
 * Call Tuya Cloud API via backend proxy safely
 */
export async function syncTuyaCloudApi(credentials: TuyaCloudCredentials): Promise<ImportResult> {
  try {
    saveStoredTuyaCredentials(credentials);

    const res = await fetch('/api/smart-life/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const text = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // Ignored
    }

    if (!res.ok || !data || !data.success) {
      throw new Error(data?.message || 'Impossibile contattare il server Tuya');
    }

    return {
      success: true,
      message: data.message || `Sincronizzazione completata: ${data.importedCount || 0} dispositivi importati.`,
      importedCount: data.importedCount || 0,
      devices: data.devices || [],
      source: 'tuya_cloud',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Impossibile contattare il server Tuya',
      importedCount: 0,
      devices: [],
      source: 'tuya_cloud',
    };
  }
}

/**
 * Manage stored Tuya credentials in safeStorage (LocalStorage + Memory + Cookie Fallback)
 */
export function getStoredTuyaCredentials(): TuyaCloudCredentials | null {
  try {
    const saved = safeStorage.getItem('tuya_credentials');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading tuya credentials from storage', e);
  }
  return null;
}

export function saveStoredTuyaCredentials(credentials: TuyaCloudCredentials): void {
  try {
    safeStorage.setItem('tuya_credentials', JSON.stringify(credentials));
  } catch (e) {
    console.error('Error saving tuya credentials to storage', e);
  }
}

function formatTuyaErrorClient(code: string | number, rawMsg: string, host: string): string {
  const codeStr = String(code || '');
  if (codeStr === '60001001') {
    return `Tuya Cloud (${host}): Errore 60001001 - Quota API Tuya o Prova Gratuita Esaurita (controllable device pool quota is insufficient). Per ripristinare il controllo: accedi a iot.tuya.com -> Cloud -> Sviluppo -> Il Mio Servizio -> IoT Core e fai clic su "Estendi Prova Gratuita" (Free Trial Extension).`;
  }
  if (codeStr === '28841002' || codeStr === '28841001') {
    return `Tuya Cloud (${host}): Errore ${codeStr} - Periodo di prova API Tuya scaduto. Accedi a iot.tuya.com -> Cloud -> Sviluppo -> Il Mio Servizio -> IoT Core per rinnovare gratuitamente la licenza.`;
  }
  if (codeStr === '2001') {
    return `Tuya Cloud (${host}): Errore 2001 - Dispositivo Tuya offline o disconnesso dal Wi-Fi. Verifica alimentazione e connessione rete.`;
  }
  if (codeStr === '2008' || codeStr === '1106') {
    return `Tuya Cloud (${host}): Errore ${codeStr} - ID Dispositivo non trovato nell'account Tuya Developer.`;
  }
  if (codeStr === '1102') {
    return `Tuya Cloud (${host}): Errore 1102 - Client ID o Client Secret non validi per l'API Tuya.`;
  }
  return `Tuya Cloud (${host}): Errore ${codeStr}: ${rawMsg || 'Errore durante la comunicazione'}`;
}

/**
 * Direct Client-Side Tuya OpenAPI Call stub (Redirected to Serverless API Route)
 */
export async function sendTuyaCommandDirectClientSide(
  deviceId: string,
  code: string,
  value: any,
  creds: TuyaCloudCredentials,
  extraOptions?: { category?: string; isGate?: boolean; dpCode?: string; deviceName?: string; name?: string }
): Promise<{ success: boolean; message: string }> {
  return sendTuyaCommand(deviceId, code, value, creds, extraOptions);
}

/**
 * Send real-time command to a Tuya Cloud device (POST /api/tuya-command or fallback to direct client-side HMAC)
 */
export async function sendTuyaCommand(
  deviceId: string,
  code: string | Array<{ code: string; value: any }>,
  value?: any,
  customCredentials?: TuyaCloudCredentials,
  extraOptions?: { category?: string; isGate?: boolean; dpCode?: string; deviceName?: string; name?: string }
): Promise<{ success: boolean; message: string; statusCode?: number }> {
  let realCode = 'switch_1';
  let realValue: any = true;
  let creds = customCredentials;
  let options = extraOptions;

  if (Array.isArray(code) && code.length > 0) {
    realCode = code[0].code || 'switch_1';
    realValue = code[0].value;
    if (value && typeof value === 'object' && 'clientAccessId' in value) {
      creds = value as TuyaCloudCredentials;
      if (customCredentials && typeof customCredentials === 'object') {
        options = customCredentials as any;
      }
    } else if (value && typeof value === 'object' && ('category' in value || 'isGate' in value || 'dpCode' in value || 'deviceName' in value)) {
      options = value as any;
    }
  } else {
    realCode = typeof code === 'string' ? code : 'switch_1';
    realValue = value;
  }

  creds = creds || getStoredTuyaCredentials();

  if (!creds || !creds.clientAccessId || !creds.clientSecret) {
    return {
      success: false,
      message: 'Credenziali Tuya assenti. Inserisci Client ID e Client Secret nel modale Smart Life per abilitare il controllo reale.',
    };
  }

  const isGate = options?.isGate || options?.category === 'gate' || options?.category === 'pulsed_switch';
  const deviceNameStr = (options?.deviceName || options?.name || '').toLowerCase();
  const isCancelletto =
    deviceNameStr.includes('cancelletto') ||
    deviceId.toLowerCase().includes('cancelletto') ||
    realCode === 'switch' ||
    options?.dpCode === 'switch';

  const isPlug =
    options?.category === 'plug' ||
    options?.category === 'cz' ||
    options?.category === 'socket' ||
    (options as any)?.tuyaCategory === 'cz' ||
    deviceNameStr.includes('presa') ||
    deviceNameStr.includes('plug') ||
    deviceNameStr.includes('socket') ||
    realCode === 'switch_go' ||
    options?.dpCode === 'switch_go';

  // Per il Cancelletto usa primariamente 'switch' se non diversamente specificato
  if (isCancelletto && realCode === 'switch_1' && !options?.dpCode) {
    realCode = 'switch';
  } else if (isPlug && (realCode === 'switch_1' || realCode === 'switch') && !options?.dpCode) {
    realCode = 'switch_go';
  }

  // 1. Exclusively execute via Backend Serverless API Route (/api/tuya-command)
  // Ensures compatibility with Samsung Family Hub (Tizen WebKit) avoiding CORS and browser crypto HMAC limits
  try {
    const res = await fetch('/api/tuya-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: creds.clientAccessId,
        clientAccessId: creds.clientAccessId,
        clientSecret: creds.clientSecret,
        region: creds.region || 'eu',
        deviceId,
        command: { code: realCode, value: realValue },
        code: realCode,
        value: realValue,
        category: options?.category,
        isGate,
        dpCode: options?.dpCode || realCode,
        deviceName: options?.deviceName || options?.name,
      }),
    });

    const text = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON response
    }

    if (res.ok && data && data.success) {
      return {
        success: true,
        message: data.message || `Comando '${realCode}' inviato con successo a Tuya Cloud`,
      };
    }

    if (data && (data.message || data.msg)) {
      return {
        success: false,
        statusCode: res.status,
        message: data.message || data.msg || 'Errore durante l\'esecuzione del comando',
      };
    }

    if (!res.ok) {
      return {
        success: false,
        statusCode: res.status,
        message: `Errore serverless ${res.status}: Impossibile contattare il gateway Tuya`,
      };
    }
  } catch (backendErr: any) {
    console.error('Errore chiamata serverless /api/tuya-command:', backendErr);
    return {
      success: false,
      message: `Errore di rete serverless: ${backendErr?.message || 'Impossibile raggiungere il server'}`,
    };
  }

  return {
    success: false,
    message: 'Impossibile completare il comando Tuya',
  };
}

/**
 * Real-time background status polling for all Smart Life / Tuya devices.
 * Queries Tuya OpenAPI every few seconds to reflect physical wall switch changes,
 * app toggles, and online/offline status dynamically.
 */
export async function pollTuyaDevicesStatus(
  currentDevices: SmartDevice[],
  targetDeviceIds?: string[]
): Promise<{
  hasChanges: boolean;
  updatedDevices: SmartDevice[];
  updatedCount: number;
}> {
  const creds = getStoredTuyaCredentials();

  try {
    const payload: any = { ...(creds || {}) };
    if (targetDeviceIds && targetDeviceIds.length > 0) {
      payload.targetDeviceIds = targetDeviceIds;
    }

    const res = await fetch('/api/tuya-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      return { hasChanges: false, updatedDevices: currentDevices, updatedCount: 0 };
    }

    if (!res.ok || !data || !data.success || !Array.isArray(data.devices) || data.devices.length === 0) {
      return { hasChanges: false, updatedDevices: currentDevices, updatedCount: 0 };
    }

    const remoteDevices: SmartDevice[] = data.devices;

    // Index remote devices by tuyaDeviceId, id, and sanitized name
    const remoteById = new Map<string, SmartDevice>();
    const remoteByName = new Map<string, SmartDevice>();

    for (const r of remoteDevices) {
      if (r.tuyaDeviceId) remoteById.set(r.tuyaDeviceId.trim().toLowerCase(), r);
      if (r.id) remoteById.set(r.id.trim().toLowerCase(), r);
      const cleanName = (r.name || '').toLowerCase().trim();
      if (cleanName) remoteByName.set(cleanName, r);
    }

    let hasChanges = false;
    let updatedCount = 0;

    const nextDevices = currentDevices.map((dev) => {
      const devTuyaId = (dev.tuyaDeviceId || '').trim().toLowerCase();
      const devCleanId = (dev.id || '').trim().toLowerCase();
      const devCleanName = (dev.name || '').toLowerCase().trim();

      const remote =
        (devTuyaId ? remoteById.get(devTuyaId) : undefined) ||
        (devCleanId ? remoteById.get(devCleanId) : undefined) ||
        (devCleanName ? remoteByName.get(devCleanName) : undefined);

      if (!remote) {
        return dev;
      }

      // Check isOnline change
      const nextIsOnline = remote.isOnline !== undefined ? Boolean(remote.isOnline) : dev.isOnline;
      const isOnlineChanged = nextIsOnline !== dev.isOnline;

      // Check state changes
      let stateChanged = false;
      const mergedState = { ...dev.state };

      if (remote.state) {
        // Compare and merge category states
        const catKeys = Object.keys(remote.state) as Array<keyof SmartDevice['state']>;
        for (const key of catKeys) {
          const remoteCat = remote.state[key];
          const localCat = dev.state[key];

          if (remoteCat) {
            const localJson = JSON.stringify(localCat || {});
            const remoteJson = JSON.stringify(remoteCat || {});
            if (localJson !== remoteJson) {
              (mergedState as any)[key] = {
                ...(localCat || {}),
                ...remoteCat,
              };
              stateChanged = true;
            }
          }
        }
      }

      if (isOnlineChanged || stateChanged) {
        hasChanges = true;
        updatedCount++;
        return {
          ...dev,
          isOnline: nextIsOnline,
          state: mergedState,
        };
      }

      return dev;
    });

    return {
      hasChanges,
      updatedDevices: nextDevices,
      updatedCount,
    };
  } catch (err) {
    console.debug('Tuya status polling fetch error:', err);
    return { hasChanges: false, updatedDevices: currentDevices, updatedCount: 0 };
  }
}


