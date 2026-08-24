import { SmartDevice, RoomName } from '../types';

export interface VoiceCommandResult {
  rawTranscript: string;
  action: 'turn_on' | 'turn_off' | 'toggle' | 'set_temperature' | 'set_brightness' | 'all_on' | 'all_off' | 'room_on' | 'room_off' | 'unknown';
  targetType: 'device' | 'room' | 'all' | 'none';
  targetDevice?: SmartDevice;
  targetRoom?: string;
  numericValue?: number;
  message: string;
  success: boolean;
}

/**
 * Normalizza il testo rimuovendo accenti, punteggiatura e spazi multipli
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // rimuove accenti
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lista di wakewords facoltative
const WAKEWORDS = [
  'my home',
  'myhome',
  'ehi siri',
  'hey siri',
  'siri',
  'ok google',
  'hey google',
  'alexa',
  'casa',
  'ehi casa',
  'smart life',
  'smartlife',
  'domotica',
  'assistente',
  'ciao',
  'per favore',
  'puoi',
];

/**
 * Rimuove le wakewords all'inizio della frase
 */
export function stripWakewords(text: string): string {
  let cleaned = normalizeText(text);
  let changed = true;
  while (changed) {
    changed = false;
    for (const wake of WAKEWORDS) {
      if (cleaned.startsWith(wake + ' ')) {
        cleaned = cleaned.substring(wake.length + 1).trim();
        changed = true;
      } else if (cleaned === wake) {
        cleaned = '';
        changed = true;
      }
    }
  }
  return cleaned;
}

/**
 * Calcola l'indice di similarità tra due stringhe (Jaccard token overlap + substring)
 */
function calculateMatchScore(spoken: string, candidate: string): number {
  const normSpoken = normalizeText(spoken);
  const normCand = normalizeText(candidate);

  if (!normSpoken || !normCand) return 0;
  if (normSpoken === normCand) return 1.0;
  if (normSpoken.includes(normCand)) return 0.9;
  if (normCand.includes(normSpoken)) return 0.85;

  const spokenTokens = normSpoken.split(' ').filter(t => t.length > 2);
  const candTokens = normCand.split(' ').filter(t => t.length > 2);

  if (spokenTokens.length === 0 || candTokens.length === 0) return 0;

  let common = 0;
  for (const st of spokenTokens) {
    if (candTokens.some(ct => ct === st || ct.includes(st) || st.includes(ct))) {
      common++;
    }
  }

  return common / Math.max(spokenTokens.length, candTokens.length);
}

/**
 * Trova il dispositivo che meglio corrisponde al testo pronunciato
 */
function findBestDevice(spokenTarget: string, devices: SmartDevice[]): { device?: SmartDevice; score: number } {
  let bestDevice: SmartDevice | undefined = undefined;
  let highestScore = 0;

  const normTarget = normalizeText(spokenTarget);

  for (const device of devices) {
    // Prova il nome del dispositivo
    const nameScore = calculateMatchScore(normTarget, device.name);
    
    // Prova nome + stanza (es: "luce cucina")
    const nameRoomScore = calculateMatchScore(normTarget, `${device.name} ${device.room}`);
    
    // Prova categoria + stanza (es: "termostato salotto", "presa corridoio", "lampada camera")
    let catItalian: string = device.category;
    if (device.category === 'light') catItalian = 'luce lampada applique faro faretti';
    if (device.category === 'plug') catItalian = 'presa spina ciabatta';
    if (device.category === 'thermostat') catItalian = 'termostato termosifone termosifoni riscaldamento clima';
    if (device.category === 'gate') catItalian = 'cancello cancelletto portone portoncino';
    if (device.category === 'lock') catItalian = 'serratura porta porta ingresso';
    if (device.category === 'vacuum') catItalian = 'robot aspirapolvere robottino';

    const catRoomScore = calculateMatchScore(normTarget, `${catItalian} ${device.room}`);

    const maxDevScore = Math.max(nameScore, nameRoomScore, catRoomScore * 0.85);

    if (maxDevScore > highestScore && maxDevScore >= 0.4) {
      highestScore = maxDevScore;
      bestDevice = device;
    }
  }

  return { device: bestDevice, score: highestScore };
}

/**
 * Trova la stanza che meglio corrisponde al testo
 */
function findBestRoom(spokenTarget: string, rooms: string[]): { room?: string; score: number } {
  let bestRoom: string | undefined = undefined;
  let highestScore = 0;

  const normTarget = normalizeText(spokenTarget);

  for (const room of rooms) {
    if (room === 'Tutti') continue;
    const score = calculateMatchScore(normTarget, room);
    if (score > highestScore && score >= 0.5) {
      highestScore = score;
      bestRoom = room;
    }
  }

  return { room: bestRoom, score: highestScore };
}

/**
 * Interpreta ed esegue il parsing del comando vocale in lingua italiana
 */
export function parseVoiceCommand(
  rawTranscript: string,
  devices: SmartDevice[],
  rooms: string[]
): VoiceCommandResult {
  const cleaned = stripWakewords(rawTranscript);

  if (!cleaned) {
    return {
      rawTranscript,
      action: 'unknown',
      targetType: 'none',
      message: 'Non ho rilevato alcun comando dopo la parola chiave.',
      success: false,
    };
  }

  // 1. Controlla comandi globali "spegni tutto" / "accendi tutto"
  if (
    cleaned === 'spegni tutto' ||
    cleaned === 'spegni tutta la casa' ||
    cleaned === 'spegni tutti i dispositivi' ||
    cleaned === 'disattiva tutto' ||
    cleaned === 'tutto off'
  ) {
    return {
      rawTranscript,
      action: 'all_off',
      targetType: 'all',
      message: 'Spegnimento di tutti i dispositivi della casa.',
      success: true,
    };
  }

  if (
    cleaned === 'accendi tutto' ||
    cleaned === 'accendi tutta la casa' ||
    cleaned === 'accendi tutti i dispositivi' ||
    cleaned === 'attiva tutto' ||
    cleaned === 'tutto on'
  ) {
    return {
      rawTranscript,
      action: 'all_on',
      targetType: 'all',
      message: 'Accensione di tutti i dispositivi della casa.',
      success: true,
    };
  }

  // 2. Riconoscimento Azione Principale
  const isTurnOn = /^(accendi|attiva|apri|avvia|metti su on|illumina|fai partire|alza)\b/i.test(cleaned);
  const isTurnOff = /^(spegni|disattiva|chiudi|ferma|stop|metti su off|abbassa)\b/i.test(cleaned);
  const isSetTemp = /(temperatura|gradi|termostato|scalda|riscaldamento)/i.test(cleaned) && /\d+/.test(cleaned);
  const isSetBrightness = /(luminosita|luce al|percento|%)/i.test(cleaned) && /\d+/.test(cleaned);

  // Estrai il bersaglio rimuovendo l'azione iniziale
  let remainder = cleaned
    .replace(/^(accendi|attiva|apri|avvia|metti su on|illumina|fai partire|alza|spegni|disattiva|chiudi|ferma|stop|metti su off|abbassa|imposta|regola)\s+/i, '')
    .trim();

  // Rimuovi parole di riempimento come "il", "la", "le", "i", "gli", "lo", "tutti", "tutte", "in", "nel", "nella", "del", "della"
  remainder = remainder
    .replace(/^(il|lo|la|i|gli|le|un|uno|una|tutti|tutte|i dispositivi in|le luci in|in|nel|nella|nello|negli|nelle|del|della|dello)\s+/i, '')
    .trim();

  // 3. Gestione Temperatura
  if (isSetTemp) {
    const numMatch = cleaned.match(/\d+(\.\d+)?/);
    const tempVal = numMatch ? parseFloat(numMatch[0]) : 21;
    const { device } = findBestDevice(remainder || cleaned, devices.filter(d => d.category === 'thermostat'));
    
    return {
      rawTranscript,
      action: 'set_temperature',
      targetType: 'device',
      targetDevice: device || devices.find(d => d.category === 'thermostat'),
      numericValue: tempVal,
      message: device 
        ? `Impostata temperatura di ${device.name} a ${tempVal}°C`
        : `Impostata temperatura a ${tempVal}°C`,
      success: true,
    };
  }

  // 4. Gestione Luminosità
  if (isSetBrightness) {
    const numMatch = cleaned.match(/\d+/);
    const brightVal = numMatch ? Math.min(100, Math.max(1, parseInt(numMatch[0], 10))) : 80;
    const { device } = findBestDevice(remainder || cleaned, devices.filter(d => d.category === 'light'));

    return {
      rawTranscript,
      action: 'set_brightness',
      targetType: 'device',
      targetDevice: device || devices.find(d => d.category === 'light'),
      numericValue: brightVal,
      message: device 
        ? `Impostata luminosità di ${device.name} al ${brightVal}%`
        : `Impostata luminosità al ${brightVal}%`,
      success: true,
    };
  }

  // 5. Controlla se il bersaglio è una stanza intera (es: "spegni cucina", "accendi salone")
  const roomMatch = findBestRoom(remainder, rooms);
  if (roomMatch.room && roomMatch.score >= 0.65) {
    if (isTurnOff) {
      return {
        rawTranscript,
        action: 'room_off',
        targetType: 'room',
        targetRoom: roomMatch.room,
        message: `Spento tutti i dispositivi nella stanza "${roomMatch.room}".`,
        success: true,
      };
    } else if (isTurnOn) {
      return {
        rawTranscript,
        action: 'room_on',
        targetType: 'room',
        targetRoom: roomMatch.room,
        message: `Acceso tutti i dispositivi nella stanza "${roomMatch.room}".`,
        success: true,
      };
    }
  }

  // 6. Controlla se il bersaglio è un dispositivo specifico
  const devMatch = findBestDevice(remainder, devices);

  if (devMatch.device && devMatch.score >= 0.4) {
    const action = isTurnOff ? 'turn_off' : isTurnOn ? 'turn_on' : 'toggle';
    const actionLabel = action === 'turn_on' ? 'Acceso' : action === 'turn_off' ? 'Spento' : 'Azionato';

    return {
      rawTranscript,
      action,
      targetType: 'device',
      targetDevice: devMatch.device,
      message: `${actionLabel} "${devMatch.device.name}" (${devMatch.device.room}).`,
      success: true,
    };
  }

  // 7. Fallback per categorie speciali (es: "accendi termosifoni" / "apri cancelletto")
  if (cleaned.includes('termosifon') || cleaned.includes('riscaldamento') || cleaned.includes('termostato') || cleaned.includes('caldaia')) {
    const thermo = devices.find(d => d.category === 'thermostat' || (d.name || '').toLowerCase().includes('termo'));
    if (thermo) {
      return {
        rawTranscript,
        action: isTurnOff ? 'turn_off' : 'turn_on',
        targetType: 'device',
        targetDevice: thermo,
        message: `${isTurnOff ? 'Spento' : 'Acceso'} ${thermo.name}.`,
        success: true,
      };
    }
  }

  if (cleaned.includes('cancelletto') || cleaned.includes('cancello') || cleaned.includes('varco') || cleaned.includes('portoncino')) {
    const gate = devices.find(d => 
      d.category === 'gate' || 
      (d.name || '').toLowerCase().includes('cancelletto') || 
      (d.name || '').toLowerCase().includes('cancello')
    );
    if (gate) {
      return {
        rawTranscript,
        action: 'turn_on',
        targetType: 'device',
        targetDevice: gate,
        message: `Aperto ${gate.name}.`,
        success: true,
      };
    }
  }

  return {
    rawTranscript,
    action: 'unknown',
    targetType: 'none',
    message: `Nessun dispositivo o stanza trovato per: "${rawTranscript}". Prova ad esempio con "Accendi luce salone" o "Spegni garage".`,
    success: false,
  };
}
