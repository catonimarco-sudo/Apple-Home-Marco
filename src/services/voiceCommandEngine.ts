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
  wakeWordDetected?: boolean;
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

// Varianti e trascrizioni fonetiche comuni della Wake Word "My Home"
export const WAKE_PATTERNS = [
  /\b(my\s*home|myhome|mai\s*om|mai\s*home|my\s*hom|maiom|mai\s*ohm)\b/i,
  /\b(hey\s*my\s*home|ehi\s*my\s*home|ok\s*my\s*home|ciao\s*my\s*home)\b/i,
  /\b(ehi\s*siri|hey\s*siri|siri|ok\s*google|hey\s*google|alexa|domotica|smart\s*life)\b/i
];

/**
 * Controlla se la frase contiene la wake word "My Home" e restituisce il comando successivo
 */
export function extractWakeWordCommand(transcript: string): { 
  hasWakeWord: boolean; 
  wakeWord: string; 
  commandText: string 
} {
  const norm = normalizeText(transcript);
  
  // Controlla pattern primari "my home"
  const primaryRegex = /(?:ehi\s+|hey\s+|ok\s+|ciao\s+)?(my\s*home|myhome|mai\s*om|mai\s*home|my\s*hom|maiom)\s*(.*)/i;
  const match = norm.match(primaryRegex);
  
  if (match) {
    return {
      hasWakeWord: true,
      wakeWord: match[1],
      commandText: match[2]?.trim() || ''
    };
  }

  // Controlla altri wake word ausiliari
  const secondaryRegex = /(?:ehi\s+|hey\s+|ok\s+)?(siri|google|alexa|smart\s*life|casa)\s*(.*)/i;
  const matchSec = norm.match(secondaryRegex);
  if (matchSec) {
    return {
      hasWakeWord: true,
      wakeWord: matchSec[1],
      commandText: matchSec[2]?.trim() || ''
    };
  }

  return {
    hasWakeWord: false,
    wakeWord: '',
    commandText: norm
  };
}

/**
 * Calcola l'indice di similarità tra due stringhe con tolleranza per iOS / ASR
 */
function calculateMatchScore(spoken: string, candidate: string): number {
  const normSpoken = normalizeText(spoken);
  const normCand = normalizeText(candidate);

  if (!normSpoken || !normCand) return 0;
  if (normSpoken === normCand) return 1.0;
  
  // Substring esatta o inclusione diretta (es. "luce ripostiglio" include "ripostiglio")
  if (normSpoken.includes(normCand)) return 0.95;
  if (normCand.includes(normSpoken)) return 0.90;

  const spokenTokens = normSpoken.split(' ').filter(t => t.length >= 2);
  const candTokens = normCand.split(' ').filter(t => t.length >= 2);

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

  // Rimuovi prefissi comuni come "luce", "presa", "faretto", "interruttore"
  const cleanTarget = normTarget
    .replace(/^(luce|luci|lampada|lampade|presa|prese|interruttore|faro|faretto|faretti|applique|striscia led|led|dispositivo|termostato|termosifone|termosifoni)\s+/i, '')
    .trim();

  for (const device of devices) {
    const devName = normalizeText(device.name);
    const devRoom = normalizeText(device.room);

    // 1. Confronto diretto sul nome
    const nameScore = calculateMatchScore(normTarget, devName);
    const cleanNameScore = calculateMatchScore(cleanTarget, devName);

    // 2. Se il target è il nome della stanza o include la stanza (es. "luce ripostiglio" -> device in stanza "Ripostiglio")
    let roomScore = 0;
    if (devRoom && (normTarget.includes(devRoom) || cleanTarget.includes(devRoom) || devRoom.includes(cleanTarget))) {
      roomScore = 0.85;
      // Bonus se il dispositivo corrisponde alla categoria menzionata
      if (normTarget.includes('luce') && device.category === 'light') roomScore = 0.95;
      if (normTarget.includes('presa') && device.category === 'plug') roomScore = 0.95;
      if (normTarget.includes('termo') && device.category === 'thermostat') roomScore = 0.95;
    }

    // 3. Prova nome + stanza (es: "luce cucina")
    const nameRoomScore = calculateMatchScore(normTarget, `${devName} ${devRoom}`);
    
    // 4. Prova categoria + stanza (es: "termostato salotto", "presa corridoio")
    let catItalian = device.category as string;
    if (device.category === 'light') catItalian = 'luce lampada applique faro faretti led';
    if (device.category === 'plug') catItalian = 'presa spina ciabatta';
    if (device.category === 'thermostat') catItalian = 'termostato termosifone termosifoni riscaldamento clima';
    if (device.category === 'gate') catItalian = 'cancello cancelletto portone portoncino varco';
    if (device.category === 'lock') catItalian = 'serratura porta porta ingresso';
    if (device.category === 'vacuum') catItalian = 'robot aspirapolvere robottino';

    const catRoomScore = calculateMatchScore(normTarget, `${catItalian} ${devRoom}`);

    const maxDevScore = Math.max(nameScore, cleanNameScore, roomScore, nameRoomScore, catRoomScore * 0.85);

    if (maxDevScore > highestScore && maxDevScore >= 0.35) {
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
    const normRoom = normalizeText(room);
    const score = calculateMatchScore(normTarget, normRoom);
    if (score > highestScore && score >= 0.45) {
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
  rooms: string[],
  options?: { requireWakeWord?: boolean }
): VoiceCommandResult {
  const { hasWakeWord, wakeWord, commandText } = extractWakeWordCommand(rawTranscript);

  // Se è richiesta esplicitamente la wake word e non è stata pronunciata
  if (options?.requireWakeWord && !hasWakeWord) {
    return {
      rawTranscript,
      action: 'unknown',
      targetType: 'none',
      message: 'Pronuncia "My Home" prima del comando (es. "My Home accendi ripostiglio").',
      success: false,
      wakeWordDetected: false,
    };
  }

  // Prendi la parte di comando effettiva
  const cleaned = (hasWakeWord ? commandText : normalizeText(rawTranscript))
    .replace(/^(per favore|puoi|cortesemente|esegui)\s+/i, '')
    .trim();

  if (!cleaned) {
    return {
      rawTranscript,
      action: 'unknown',
      targetType: 'none',
      message: 'Comando non rilevato dopo "My Home".',
      success: false,
      wakeWordDetected: hasWakeWord,
    };
  }

  // 1. Controlla comandi globali "spegni tutto" / "accendi tutto"
  if (
    cleaned === 'spegni tutto' ||
    cleaned === 'spegni tutta la casa' ||
    cleaned === 'spegni tutti i dispositivi' ||
    cleaned === 'spegni tutte le luci' ||
    cleaned === 'disattiva tutto' ||
    cleaned === 'tutto off'
  ) {
    return {
      rawTranscript,
      action: 'all_off',
      targetType: 'all',
      message: 'Spegnimento di tutti i dispositivi della casa.',
      success: true,
      wakeWordDetected: hasWakeWord,
    };
  }

  if (
    cleaned === 'accendi tutto' ||
    cleaned === 'accendi tutta la casa' ||
    cleaned === 'accendi tutti i dispositivi' ||
    cleaned === 'accendi tutte le luci' ||
    cleaned === 'attiva tutto' ||
    cleaned === 'tutto on'
  ) {
    return {
      rawTranscript,
      action: 'all_on',
      targetType: 'all',
      message: 'Accensione di tutti i dispositivi della casa.',
      success: true,
      wakeWordDetected: hasWakeWord,
    };
  }

  // 2. Riconoscimento Azione Principale
  const isTurnOn = /^(accendi|attiva|apri|avvia|metti su on|illumina|fai partire|alza|start)\b/i.test(cleaned);
  const isTurnOff = /^(spegni|disattiva|chiudi|ferma|stop|metti su off|abbassa|stacca)\b/i.test(cleaned);
  const isSetTemp = /(temperatura|gradi|termostato|scalda|riscaldamento)/i.test(cleaned) && /\d+/.test(cleaned);
  const isSetBrightness = /(luminosita|luce al|percento|%)/i.test(cleaned) && /\d+/.test(cleaned);

  // Estrai il bersaglio rimuovendo l'azione iniziale
  let remainder = cleaned
    .replace(/^(accendi|attiva|apri|avvia|metti su on|illumina|fai partire|alza|start|spegni|disattiva|chiudi|ferma|stop|metti su off|abbassa|stacca|imposta|regola|cambia)\s+/i, '')
    .trim();

  // Rimuovi parole di riempimento come "il", "la", "le", "i", "gli", "lo", "tutti", "tutte", "in", "nel", "nella", "del", "della"
  remainder = remainder
    .replace(/^(il|lo|la|i|gli|le|un|uno|una|tutti|tutte|i dispositivi in|le luci in|le luci del|la luce in|la luce del|la presa in|la presa del|in|nel|nella|nello|negli|nelle|del|della|dello)\s+/i, '')
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
      wakeWordDetected: hasWakeWord,
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
      wakeWordDetected: hasWakeWord,
    };
  }

  // 5. Controlla se il bersaglio è una stanza intera (es: "spegni cucina", "accendi salone", "spegni ripostiglio")
  const roomMatch = findBestRoom(remainder, rooms);
  if (roomMatch.room && roomMatch.score >= 0.6) {
    if (isTurnOff) {
      return {
        rawTranscript,
        action: 'room_off',
        targetType: 'room',
        targetRoom: roomMatch.room,
        message: `Spento tutti i dispositivi nella stanza "${roomMatch.room}".`,
        success: true,
        wakeWordDetected: hasWakeWord,
      };
    } else if (isTurnOn) {
      return {
        rawTranscript,
        action: 'room_on',
        targetType: 'room',
        targetRoom: roomMatch.room,
        message: `Acceso tutti i dispositivi nella stanza "${roomMatch.room}".`,
        success: true,
        wakeWordDetected: hasWakeWord,
      };
    }
  }

  // 6. Controlla se il bersaglio è un dispositivo specifico
  const devMatch = findBestDevice(remainder || cleaned, devices);

  if (devMatch.device && devMatch.score >= 0.35) {
    const action = isTurnOff ? 'turn_off' : isTurnOn ? 'turn_on' : 'toggle';
    const actionLabel = action === 'turn_on' ? 'Acceso' : action === 'turn_off' ? 'Spento' : 'Azionato';

    return {
      rawTranscript,
      action,
      targetType: 'device',
      targetDevice: devMatch.device,
      message: `${actionLabel} "${devMatch.device.name}" (${devMatch.device.room}).`,
      success: true,
      wakeWordDetected: hasWakeWord,
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
        wakeWordDetected: hasWakeWord,
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
        wakeWordDetected: hasWakeWord,
      };
    }
  }

  return {
    rawTranscript,
    action: 'unknown',
    targetType: 'none',
    message: `Nessun dispositivo o stanza trovato per: "${cleaned}". Prova ad esempio con "My Home accendi ripostiglio".`,
    success: false,
    wakeWordDetected: hasWakeWord,
  };
}
