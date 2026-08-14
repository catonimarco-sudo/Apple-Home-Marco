import CryptoJS from 'crypto-js';
import { SmartDevice, ImportResult, TuyaCloudCredentials, RoomName, DeviceCategory } from '../types';

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
  if (code === 'wk' || lowerName.includes('termostato') || lowerName.includes('caldaia') || lowerName.includes('thermostat') || lowerName.includes('clima')) {
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
        newDev.state.thermostat = {
          power: item.dps?.['1'] ?? true,
          currentTemp: item.dps?.['16'] ?? 21.0,
          targetTemp: item.dps?.['24'] ?? 22.0,
          humidity: 50,
          mode: 'heat',
          fanSpeed: 'auto',
        };
      } else if (cat === 'sensor') {
        newDev.state.sensor = {
          triggered: false,
          sensorType: item.name?.toLowerCase().includes('allagamento') ? 'water' : 'door',
          battery: item.dps?.['2'] || 95,
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
      data = null;
    }

    if (!res.ok || !data || !data.success) {
      throw new Error(data?.message || 'Impossibile contattare il server Tuya');
    }

    return {
      success: true,
      message: data.message || 'Sincronizzazione completata con successo!',
      importedCount: data.devices?.length || 0,
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
 * Manage stored Tuya credentials in LocalStorage
 */
export function getStoredTuyaCredentials(): TuyaCloudCredentials | null {
  try {
    const saved = localStorage.getItem('tuya_credentials');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading tuya credentials from localStorage', e);
  }
  return null;
}

export function saveStoredTuyaCredentials(credentials: TuyaCloudCredentials): void {
  try {
    localStorage.setItem('tuya_credentials', JSON.stringify(credentials));
  } catch (e) {
    console.error('Error saving tuya credentials to localStorage', e);
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
 * Direct Client-Side Tuya OpenAPI Call using CryptoJS
 */
export async function sendTuyaCommandDirectClientSide(
  deviceId: string,
  code: string,
  value: any,
  creds: TuyaCloudCredentials,
  extraOptions?: { category?: string; isGate?: boolean; dpCode?: string; deviceName?: string; name?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanDeviceId = String(deviceId || '').trim();
    const hostMap: Record<string, string> = {
      eu: 'openapi.tuyaeu.com',
      us: 'openapi.tuyaus.com',
      cn: 'openapi.tuyacn.com',
      in: 'openapi.tuyain.com',
    };
    const host = hostMap[creds.region || 'eu'] || 'openapi.tuyaeu.com';

    // 1. Get Access Token
    const t1 = Date.now().toString();
    const urlPath1 = '/v1.0/token?grant_type=1';
    const bodySha256_1 = CryptoJS.SHA256('').toString(CryptoJS.enc.Hex);
    const stringToSign1 = ['GET', bodySha256_1, '', urlPath1].join('\n');
    const signStr1 = creds.clientAccessId + t1 + stringToSign1;
    const sign1 = CryptoJS.HmacSHA256(signStr1, creds.clientSecret).toString(CryptoJS.enc.Hex).toUpperCase();

    const tokenRes = await fetch(`https://${host}${urlPath1}`, {
      method: 'GET',
      headers: {
        client_id: creds.clientAccessId,
        sign: sign1,
        t: t1,
        sign_method: 'HMAC-SHA256',
      },
    });

    const tokenText = await tokenRes.text().catch(() => '');
    let tokenData: any = null;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      return { success: false, message: 'Impossibile contattare il server Tuya' };
    }

    if (!tokenRes.ok || !tokenData || !tokenData.success || !tokenData.result) {
      return {
        success: false,
        message: tokenData?.msg ? `Tuya: ${tokenData.msg}` : 'Impossibile contattare il server Tuya',
      };
    }

    const accessToken = tokenData.result.access_token;
    const isGate = extraOptions?.isGate || extraOptions?.category === 'gate' || extraOptions?.category === 'pulsed_switch';
    const deviceNameStr = (extraOptions?.deviceName || extraOptions?.name || '').toLowerCase();
    const isCancelletto =
      deviceNameStr.includes('cancelletto') ||
      cleanDeviceId.toLowerCase().includes('cancelletto') ||
      code === 'switch' ||
      extraOptions?.dpCode === 'switch';

    const candidateCodes: string[] = isCancelletto
      ? ['switch', 'switch_led', 'switch_1']
      : isGate
      ? Array.from(new Set([
          extraOptions?.dpCode,
          code,
          'switch_1',
          'switch',
          'doorcontrol_1',
          'trigger',
          'button_1',
          'gate_control',
          'open',
          'control',
          'switch_a',
        ].filter(Boolean) as string[]))
      : [code];

    let lastCmdData: any = null;

    for (const codeToTry of candidateCodes) {
      const t2 = Date.now().toString();
      const urlPath2 = `/v1.0/devices/${cleanDeviceId}/commands`;
      const bodyObj = { commands: [{ code: codeToTry, value }] };
      const bodyStr = JSON.stringify(bodyObj);
      const bodySha256_2 = CryptoJS.SHA256(bodyStr).toString(CryptoJS.enc.Hex);
      const stringToSign2 = ['POST', bodySha256_2, '', urlPath2].join('\n');
      const signStr2 = creds.clientAccessId + accessToken + t2 + stringToSign2;
      const sign2 = CryptoJS.HmacSHA256(signStr2, creds.clientSecret).toString(CryptoJS.enc.Hex).toUpperCase();

      const cmdRes = await fetch(`https://${host}${urlPath2}`, {
        method: 'POST',
        headers: {
          client_id: creds.clientAccessId,
          access_token: accessToken,
          sign: sign2,
          t: t2,
          sign_method: 'HMAC-SHA256',
          'Content-Type': 'application/json',
        },
        body: bodyStr,
      });

      const cmdText = await cmdRes.text().catch(() => '');
      try {
        lastCmdData = JSON.parse(cmdText);
      } catch {
        lastCmdData = null;
      }

      if (isGate) {
        console.log("Tuya Response Gate:", lastCmdData);
      }

      if (cmdRes.ok && lastCmdData && lastCmdData.success) {
        return {
          success: true,
          message: `Comando '${codeToTry}: ${value}' eseguito su Tuya Cloud`,
        };
      }

      // If device offline, quota exceeded, trial expired, break loop
      if (['2001', '2008', '1106', '1108', '60001001', '28841002', '28841001'].includes(String(lastCmdData?.code))) {
        break;
      }
    }

    return {
      success: false,
      message: formatTuyaErrorClient(lastCmdData?.code, lastCmdData?.msg, host),
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Impossibile contattare il server Tuya',
    };
  }
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

  // Per il Cancelletto usa primariamente 'switch' se non diversamente specificato
  if (isCancelletto && realCode === 'switch_1' && !options?.dpCode) {
    realCode = 'switch';
  }

  // 1. Try backend serverless route /api/tuya-command
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

    // Safely check if response is valid JSON
    const text = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (isGate) {
      console.log("Tuya Response Gate:", data || text);
    }

    if (data) {
      if (data.success) {
        return {
          success: true,
          message: data.message || `Comando '${realCode}: ${realValue}' eseguito su Tuya Cloud!`,
        };
      } else if (data.message) {
        return {
          success: false,
          statusCode: res.status,
          message: data.message,
        };
      }
    }
  } catch (backendErr) {
    console.warn('Backend /api/tuya-command call skipped/failed, trying direct client-side call', backendErr);
  }

  // 2. Direct client-side proxy fallback using crypto-js
  const directResult = await sendTuyaCommandDirectClientSide(deviceId, realCode, realValue, creds, options);
  if (directResult.success) {
    return {
      success: true,
      message: directResult.message,
    };
  }

  return {
    success: false,
    message: directResult.message || 'Impossibile contattare il server Tuya',
  };
}


