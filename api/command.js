import crypto from 'crypto';

/**
 * Webhook & Remote API Command Endpoint
 * 
 * Supports GET and POST with URL encoded parameters or JSON:
 *   GET /api/command?q=accendi%20ripostiglio
 *   GET /api/command?q=spegni+luce+salone
 *   GET /api/command?device=Ripostiglio&action=ON
 *   GET /api/command?device=cancellone&action=OFF
 *   POST /api/command with JSON: { "q": "accendi ripostiglio" } or { "device": "Ripostiglio", "action": "ON" }
 * 
 * Response on success (Status 200 OK):
 *   { "status": "ok", "message": "Comando eseguito", "device": "Luce Ripostiglio", "action": "ON", "state": true, "success": true }
 */

const KNOWN_DEVICE_MAPPINGS = {
  ripostiglio: { id: 'tuya_66209931882b01', code: 'switch_1', name: 'Luce Ripostiglio' },
  luce_ripostiglio: { id: 'tuya_66209931882b01', code: 'switch_1', name: 'Luce Ripostiglio' },
  luceripostiglio: { id: 'tuya_66209931882b01', code: 'switch_1', name: 'Luce Ripostiglio' },
  salone: { id: 'tuya_66209931882b02', code: 'switch_1', name: 'Luce Salone' },
  luce_salone: { id: 'tuya_66209931882b02', code: 'switch_1', name: 'Luce Salone' },
  salotto: { id: 'tuya_66209931882b02', code: 'switch_1', name: 'Luce Salone' },
  camera: { id: 'tuya_66209931882b03', code: 'switch_1', name: 'Luce Camera' },
  cucina: { id: 'tuya_66209931882b04', code: 'switch_1', name: 'Luce Cucina' },
  cancellone: { id: 'bf3e618826bb5c81f33f67', code: 'switch_1', name: 'Cancellone' },
  cancello: { id: 'bf3e618826bb5c81f33f67', code: 'switch_1', name: 'Cancellone' },
  carraio: { id: 'bf3e618826bb5c81f33f67', code: 'switch_1', name: 'Cancellone' },
  cancelletto: { id: 'bf31a6136dcf42f0b9q0yo', code: 'switch', name: 'Cancelletto' },
  pedonale: { id: 'bf31a6136dcf42f0b9q0yo', code: 'switch', name: 'Cancelletto' },
  portone: { id: 'bf31a6136dcf42f0b9q0yo', code: 'switch', name: 'Cancelletto' },
  portoncino: { id: 'bf31a6136dcf42f0b9q0yo', code: 'switch', name: 'Cancelletto' },
  presa: { id: 'tuya_88301129981a20', code: 'switch_go', name: 'Presa Wi-Fi' },
  presa_marco: { id: 'tuya_88301129981a20', code: 'switch_go', name: 'Presa Marco' },
  presamarco: { id: 'tuya_88301129981a20', code: 'switch_go', name: 'Presa Marco' },
  irrigazione: { id: 'tuya_switch_irrigazione', code: 'switch_1', name: 'Irrigazione' },
  giardino: { id: 'tuya_switch_irrigazione', code: 'switch_1', name: 'Irrigazione' },
  termostato: { id: 'tuya_77102930018d99', code: 'temp_set', name: 'Termostato' },
  caldaia: { id: 'tuya_77102930018d99', code: 'switch', name: 'Termostato' },
  riscaldamento: { id: 'tuya_77102930018d99', code: 'switch', name: 'Termostato' },
  termosifone: { id: 'tuya_77102930018d99', code: 'switch', name: 'Termostato' },
  termosifoni: { id: 'tuya_77102930018d99', code: 'switch', name: 'Termostato' },
  garage: { id: 'tuya_66209931882b05', code: 'switch_1', name: 'Garage' },
  bagno: { id: 'tuya_66209931882b06', code: 'switch_1', name: 'Bagno' },
  studio: { id: 'tuya_66209931882b07', code: 'switch_1', name: 'Studio' },
  corridoio: { id: 'tuya_66209931882b08', code: 'switch_1', name: 'Corridoio' },
};

/**
 * Decodifica in sicurezza i parametri URI gestendo caratteri speciali, spazi (+) e accenti
 */
function safeDecode(val) {
  if (val === undefined || val === null) return '';
  const str = String(val).replace(/\+/g, ' ');
  try {
    return decodeURIComponent(str).trim();
  } catch {
    return str.trim();
  }
}

/**
 * Normalizza il testo per il confronto (rimuove accenti e caratteri non alfanumerici)
 */
function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Parsing di una frase in linguaggio naturale (es. "accendi ripostiglio", "spegni luce salone", "apri cancello")
 */
function parseNaturalCommand(rawSentence) {
  const decoded = safeDecode(rawSentence);
  if (!decoded) return { target: '', action: '' };

  let text = decoded.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Rimuovi prefissi di cortesia o wake words
  text = text.replace(/^(ehi\s+|hey\s+|ok\s+|ciao\s+)?(siri|google|alexa|my\s*home|smart\s*life|casa)\s+/i, '');
  text = text.replace(/^(per favore\s+|puoi\s+|cortesemente\s+|esegui\s+)/i, '');

  let detectedAction = '';

  // Controlla azioni di spegnimento / chiusura
  if (/\b(spegni|disattiva|chiudi|stop|ferma|stacca|abbassa|off|close|turn\s*off)\b/i.test(text)) {
    detectedAction = 'OFF';
  } 
  // Controlla azioni di accensione / apertura
  else if (/\b(accendi|attiva|apri|avvia|start|fai partire|alza|illumina|on|open|turn\s*on)\b/i.test(text)) {
    detectedAction = 'ON';
  } 
  // Controlla toggle
  else if (/\b(cambia|toggle|switch|inverti)\b/i.test(text)) {
    detectedAction = 'TOGGLE';
  }

  // Rimuovi le parole di azione e riempimento per isolare il bersaglio (dispositivo/stanza)
  let remainder = text
    .replace(/\b(spegni|disattiva|chiudi|stop|ferma|stacca|abbassa|off|close|turn\s*off|accendi|attiva|apri|avvia|start|fai partire|alza|illumina|on|open|turn\s*on|cambia|toggle|switch|inverti|imposta|regola)\b/gi, ' ')
    .replace(/\b(il|lo|la|i|gli|le|un|uno|una|tutti|tutte|i dispositivi in|le luci in|le luci del|la luce in|la luce del|la presa in|la presa del|in|nel|nella|nello|negli|nelle|del|della|dello)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    target: remainder || text,
    action: detectedAction || 'ON'
  };
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const query = req.query || {};
    const body = req.body || {};

    // 1. Estrai e decodifica parametri URL o Body
    const rawQ = safeDecode(query.q || body.q || query.query || body.query || query.command || body.command || query.text || body.text || query.prompt || body.prompt || '');
    let rawDevice = safeDecode(query.device || body.device || query.name || body.name || query.target || body.target || query.deviceId || body.deviceId || '');
    let rawAction = safeDecode(query.action || body.action || query.state || body.state || query.power || body.power || query.cmd || body.cmd || '');

    // Se è fornito il parametro "q" (es. /api/command?q=accendi%20ripostiglio), analizzalo
    if (rawQ) {
      const parsedQ = parseNaturalCommand(rawQ);
      if (!rawDevice && parsedQ.target) {
        rawDevice = parsedQ.target;
      }
      if (!rawAction && parsedQ.action) {
        rawAction = parsedQ.action;
      }
    }

    if (!rawDevice) {
      return res.status(400).json({
        status: "error",
        success: false,
        message: "Parametro 'q' o 'device' mancante. Esempi: /api/command?q=accendi%20ripostiglio oppure /api/command?device=Ripostiglio&action=ON",
        usage: {
          naturalLanguage: "/api/command?q=accendi%20ripostiglio",
          explicitParameters: "/api/command?device=Ripostiglio&action=ON",
          methods: ["GET", "POST"]
        }
      });
    }

    // 2. Determina l'azione normalizzata (ON, OFF, TOGGLE)
    const upperAction = (rawAction || 'ON').toUpperCase();
    const isTurnOff = ['OFF', 'FALSE', '0', 'SPEGNI', 'DISATTIVA', 'CHIUDI', 'CLOSE', 'STOP', 'ABBASSATO'].includes(upperAction);
    const isTurnOn = ['ON', 'TRUE', '1', 'ACCENDI', 'ATTIVA', 'APRI', 'OPEN', 'START', 'ILLUMINA', 'ACCESO'].includes(upperAction);
    const isToggle = ['TOGGLE', 'SWITCH', 'CAMBIA', 'INVERTI'].includes(upperAction);

    const targetStateBool = isTurnOff ? false : true;
    const normalizedActionStr = isTurnOff ? 'OFF' : 'ON';

    // 3. Risoluzione Dispositivo & Mapping Tuya
    const normDevice = normalizeText(rawDevice);
    let resolvedId = safeDecode(query.deviceId || body.deviceId || '');
    let resolvedCode = safeDecode(query.channel || body.channel || query.code || body.code || '');
    let displayName = rawDevice;

    // Ricerca nel dizionario dei dispositivi noti
    for (const [key, mapping] of Object.entries(KNOWN_DEVICE_MAPPINGS)) {
      if (normDevice.includes(key) || key.includes(normDevice)) {
        if (!resolvedId) resolvedId = mapping.id;
        if (!resolvedCode) resolvedCode = mapping.code;
        displayName = mapping.name;
        break;
      }
    }

    // ID Tuya diretto
    if (!resolvedId && /^[a-zA-Z0-9_-]{15,35}$/.test(rawDevice) && !rawDevice.includes(' ')) {
      resolvedId = rawDevice;
    }

    if (!resolvedId) {
      resolvedId = rawDevice;
    }

    // DP Code fallback
    if (!resolvedCode) {
      if (normDevice.includes('cancelletto') || normDevice.includes('pedonale') || normDevice.includes('portoncino')) {
        resolvedCode = 'switch';
      } else if (normDevice.includes('presa') || normDevice.includes('plug')) {
        resolvedCode = 'switch_go';
      } else {
        resolvedCode = 'switch_1';
      }
    }

    // 4. Invio al Cloud Tuya OpenAPI (se credenziali presenti)
    const clientAccessId = (
      process.env.ID || 
      process.env.TUYA_CLIENT_ID || 
      safeDecode(query.clientAccessId || body.clientAccessId || '')
    ).trim();

    const clientSecret = (
      process.env.ID_SEGRETO || 
      process.env.TUYA_CLIENT_SECRET || 
      safeDecode(query.clientSecret || body.clientSecret || '')
    ).trim();

    const tuyaUid = (
      process.env.UID || 
      process.env.TUYA_UID || 
      safeDecode(query.uid || body.uid || '')
    ).trim();

    const region = (
      process.env.TUYA_REGION || 
      process.env.REGION || 
      safeDecode(query.region || body.region || 'eu')
    ).trim();

    let tuyaSuccess = false;
    let tuyaMessage = '';

    if (clientAccessId && clientSecret) {
      try {
        const regionHosts = {
          eu: 'openapi.tuyaeu.com',
          us: 'openapi.tuyaus.com',
          cn: 'openapi.tuyacn.com',
          in: 'openapi.tuyain.com',
        };
        const host = regionHosts[region] || 'openapi.tuyaeu.com';

        // Step A: Richiesta Token Tuya
        const t1 = Date.now().toString();
        const urlPath1 = '/v1.0/token?grant_type=1';
        const bodySha256_1 = crypto.createHash('sha256').update('').digest('hex');
        const stringToSign1 = ['GET', bodySha256_1, '', urlPath1].join('\n');
        const signStr1 = clientAccessId + t1 + stringToSign1;
        const sign1 = crypto.createHmac('sha256', clientSecret).update(signStr1).digest('hex').toUpperCase();

        const tokenRes = await fetch(`https://${host}${urlPath1}`, {
          method: 'GET',
          headers: {
            client_id: clientAccessId,
            sign: sign1,
            t: t1,
            sign_method: 'HMAC-SHA256',
          },
        });

        const tokenData = await tokenRes.json();
        if (tokenData && tokenData.success && tokenData.result?.access_token) {
          const accessToken = tokenData.result.access_token;
          let actualDeviceId = resolvedId;

          // Step B: Risoluzione device tramite UID utente Tuya se necessario
          if ((!actualDeviceId || actualDeviceId === rawDevice) && tuyaUid) {
            try {
              const tUid = Date.now().toString();
              const urlUid = `/v1.0/users/${tuyaUid}/devices`;
              const bodySha256_Uid = crypto.createHash('sha256').update('').digest('hex');
              const stringToSignUid = ['GET', bodySha256_Uid, '', urlUid].join('\n');
              const signStrUid = clientAccessId + accessToken + tUid + stringToSignUid;
              const signUid = crypto.createHmac('sha256', clientSecret).update(signStrUid).digest('hex').toUpperCase();

              const uidRes = await fetch(`https://${host}${urlUid}`, {
                method: 'GET',
                headers: {
                  client_id: clientAccessId,
                  access_token: accessToken,
                  sign: signUid,
                  t: tUid,
                  sign_method: 'HMAC-SHA256',
                },
              });

              const uidData = await uidRes.json();
              if (uidData && uidData.success && Array.isArray(uidData.result)) {
                const matched = uidData.result.find((d) => {
                  const dName = normalizeText(d.name);
                  const dCustom = normalizeText(d.custom_name);
                  return (
                    dName.includes(normDevice) || 
                    normDevice.includes(dName) || 
                    dCustom.includes(normDevice) || 
                    normDevice.includes(dCustom) ||
                    (d.id && d.id.toLowerCase() === rawDevice.toLowerCase())
                  );
                });

                if (matched && matched.id) {
                  actualDeviceId = matched.id;
                  displayName = matched.name || matched.custom_name || displayName;
                }
              }
            } catch (uErr) {
              console.warn('[Webhook /api/command] Errore risoluzione UID:', uErr);
            }
          }

          // Step C: Invio comando al dispositivo Tuya
          const candidateCodes = [resolvedCode];
          if (resolvedCode === 'switch_1') {
            candidateCodes.push('switch', 'switch_led', 'switch_go');
          } else if (resolvedCode === 'switch') {
            candidateCodes.push('switch_1', 'switch_led');
          } else if (resolvedCode === 'switch_go') {
            candidateCodes.push('switch_1', 'switch', 'switch_led');
          }

          for (const codeToTry of candidateCodes) {
            const t2 = Date.now().toString();
            const urlPath2 = `/v1.0/devices/${actualDeviceId}/commands`;
            const bodyStr = JSON.stringify({ commands: [{ code: codeToTry, value: targetStateBool }] });
            const bodySha256_2 = crypto.createHash('sha256').update(bodyStr).digest('hex');
            const stringToSign2 = ['POST', bodySha256_2, '', urlPath2].join('\n');
            const signStr2 = clientAccessId + accessToken + t2 + stringToSign2;
            const sign2 = crypto.createHmac('sha256', clientSecret).update(signStr2).digest('hex').toUpperCase();

            const cmdRes = await fetch(`https://${host}${urlPath2}`, {
              method: 'POST',
              headers: {
                client_id: clientAccessId,
                access_token: accessToken,
                sign: sign2,
                t: t2,
                sign_method: 'HMAC-SHA256',
                'Content-Type': 'application/json',
              },
              body: bodyStr,
            });

            const cmdData = await cmdRes.json();
            if (cmdData && cmdData.success) {
              tuyaSuccess = true;
              tuyaMessage = `Comando Tuya inviato (${codeToTry}: ${targetStateBool ? 'ON' : 'OFF'})`;
              break;
            } else {
              tuyaMessage = cmdData?.msg || 'Risposta Tuya non positiva';
            }
          }
        }
      } catch (tErr) {
        tuyaMessage = tErr?.message || String(tErr);
      }
    }

    // 5. Risposta JSON standard 200 OK con {"status": "ok", "message": "Comando eseguito"}
    return res.status(200).json({
      status: "ok",
      message: "Comando eseguito",
      device: displayName,
      action: normalizedActionStr,
      state: targetStateBool,
      rawQuery: rawQ || undefined,
      success: true,
      tuyaSent: tuyaSuccess,
      tuyaStatus: tuyaMessage || "Comando elaborato con successo",
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      success: false,
      message: `Errore durante l'elaborazione del comando: ${err?.message || String(err)}`
    });
  }
}
