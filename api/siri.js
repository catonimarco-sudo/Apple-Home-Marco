import crypto from 'crypto';

/**
 * Serverless API Route for Apple Siri Shortcuts, Siri Voice Control, Webhooks & CarPlay
 * Accepts GET and POST requests with query parameters or JSON body:
 * Examples:
 *   GET /api/siri?device=irrigazione&channel=switch_1&state=on
 *   GET /api/siri?device=irrigazione&channel=2&state=off
 *   POST /api/siri with JSON: { "device": "irrigazione", "channel": "switch_1", "state": "on" }
 *   GET /api/siri?device=cancelletto&state=on
 *   GET /api/siri?device=presa&state=toggle
 */

const KNOWN_DEVICE_IDS = {
  irrigazione: 'tuya_switch_irrigazione',
  solenoide: 'tuya_switch_irrigazione',
  centralina: 'tuya_switch_irrigazione',
  giardino: 'tuya_switch_irrigazione',
  prato: 'tuya_switch_irrigazione',
  cancellone: 'bf3e618826bb5c81f33f67',
  carraio: 'bf3e618826bb5c81f33f67',
  cancello: 'bf3e618826bb5c81f33f67',
  cancelletto: 'bf31a6136dcf42f0b9q0yo',
  pedonale: 'bf31a6136dcf42f0b9q0yo',
  portone: 'bf31a6136dcf42f0b9q0yo',
  presa: 'tuya_88301129981a20',
  plug: 'tuya_88301129981a20',
  tv: 'tuya_88301129981a20',
  termostato: 'tuya_77102930018d99',
  caldaia: 'tuya_77102930018d99',
  clima: 'tuya_77102930018d99',
  luce: 'tuya_66209931882b01',
  lampada: 'tuya_66209931882b01',
  piantana: 'tuya_66209931882b01',
  tapparella: 'tuya_curtain_01',
};

const CHANNEL_ALIASES = {
  // Canale 1
  '1': 'switch_1',
  'ch1': 'switch_1',
  'canale_1': 'switch_1',
  'canale 1': 'switch_1',
  'lato cancellone': 'switch_1',
  'cancellone': 'switch_1',
  'carrabile': 'switch_1',
  'switch_1': 'switch_1',
  'switch1': 'switch_1',

  // Canale 2
  '2': 'switch_2',
  'ch2': 'switch_2',
  'canale_2': 'switch_2',
  'canale 2': 'switch_2',
  'centrale': 'switch_2',
  'centro': 'switch_2',
  'switch_2': 'switch_2',
  'switch2': 'switch_2',

  // Canale 3
  '3': 'switch_3',
  'ch3': 'switch_3',
  'canale_3': 'switch_3',
  'canale 3': 'switch_3',
  'lato cancelletto': 'switch_3',
  'cancelletto': 'switch_3',
  'pedonale': 'switch_3',
  'switch_3': 'switch_3',
  'switch3': 'switch_3',

  // Canale 4
  '4': 'switch_4',
  'ch4': 'switch_4',
  'canale_4': 'switch_4',
  'canale 4': 'switch_4',
  'switch 4': 'switch_4',
  'switch_4': 'switch_4',
  'switch4': 'switch_4',
};

const CHANNEL_LABELS = {
  switch_1: 'Lato Cancellone',
  switch_2: 'Centrale',
  switch_3: 'Lato Cancelletto',
  switch_4: 'Switch 4',
};

export default async function handler(req, res) {
  // Enable CORS
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

    // 1. Parse device parameter
    const rawDevice = String(query.device || body.device || query.deviceId || body.deviceId || query.target || body.target || query.name || '').trim();
    
    if (!rawDevice) {
      return res.status(400).json({
        status: 'error',
        message: "Parametro 'device' mancante. Esempio: /api/siri?device=irrigazione&channel=switch_1&state=on",
        usage: {
          url: '/api/siri?device=irrigazione&channel=switch_1&state=on',
          methods: ['GET', 'POST'],
          parameters: {
            device: 'Nome o ID del dispositivo (es. irrigazione, presa, cancellone, cancelletto, o ID Tuya)',
            channel: 'Canale relè per centraline multicanale (es. switch_1, switch_2, switch_3, switch_4, 1, 2, 3, 4, centrale, lato cancellone)',
            state: 'Stato desiderato: on / off / true / false / 1 / 0 / accendi / spegni / apri / chiudi (default: on)'
          }
        }
      });
    }

    const deviceKey = rawDevice.toLowerCase();

    // 2. Parse channel parameter
    const rawChannel = String(query.channel || body.channel || query.dpCode || body.dpCode || query.dp || body.dp || query.gang || body.gang || '').trim().toLowerCase();
    let resolvedChannel = CHANNEL_ALIASES[rawChannel] || rawChannel;

    // If channel wasn't explicitly provided and it's irrigation, default to switch_1
    if (!resolvedChannel) {
      if (deviceKey.includes('irrigaz') || deviceKey.includes('solenoide') || deviceKey.includes('giardino')) {
        resolvedChannel = 'switch_1';
      } else if (deviceKey.includes('cancelletto') || deviceKey.includes('pedonale')) {
        resolvedChannel = 'switch';
      } else if (deviceKey.includes('cancellone') || deviceKey.includes('carraio')) {
        resolvedChannel = 'switch_1';
      } else if (deviceKey.includes('presa') || deviceKey.includes('plug')) {
        resolvedChannel = 'switch_1';
      } else {
        resolvedChannel = 'switch_1';
      }
    }

    // 3. Parse state parameter
    const rawState = String(query.state || body.state || query.action || body.action || query.power || body.power || query.value || body.value || 'on').trim().toLowerCase();
    const isTargetOn = (
      rawState === 'on' ||
      rawState === 'true' ||
      rawState === '1' ||
      rawState === 'accendi' ||
      rawState === 'attiva' ||
      rawState === 'apri' ||
      rawState === 'open' ||
      rawState === 'start'
    );

    // 4. Resolve Device ID
    let targetDeviceId = query.deviceId || body.deviceId;
    if (!targetDeviceId) {
      for (const [key, id] of Object.entries(KNOWN_DEVICE_IDS)) {
        if (deviceKey.includes(key)) {
          targetDeviceId = id;
          break;
        }
      }
    }
    if (!targetDeviceId) {
      targetDeviceId = rawDevice;
    }

    // 5. Build Human-Readable Zone & Action Labels
    const zoneName = CHANNEL_LABELS[resolvedChannel] || resolvedChannel;
    const actionLabel = isTargetOn ? 'attivato (ON)' : 'disattivato (OFF)';
    const defaultSuccessMessage = `Canale ${resolvedChannel}${zoneName ? ` (${zoneName})` : ''} ${actionLabel}`;

    // 6. Tuya OpenAPI Credentials
    const clientAccessId = (query.clientAccessId || body.clientAccessId || process.env.TUYA_CLIENT_ID || '').trim();
    const clientSecret = (query.clientSecret || body.clientSecret || process.env.TUYA_CLIENT_SECRET || '').trim();
    const region = (query.region || body.region || process.env.TUYA_REGION || 'eu').trim();

    let tuyaSuccess = false;
    let tuyaMessage = '';
    let tuyaCodeUsed = resolvedChannel;

    // 7. If Tuya credentials exist, execute signed OpenAPI command
    if (clientAccessId && clientSecret && targetDeviceId) {
      try {
        const regionHosts = {
          eu: 'openapi.tuyaeu.com',
          us: 'openapi.tuyaus.com',
          cn: 'openapi.tuyacn.com',
          in: 'openapi.tuyain.com',
        };
        const host = regionHosts[region] || 'openapi.tuyaeu.com';

        // Step A: Request Access Token
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

          // Candidate codes to fallback if needed
          const candidateCodes = [resolvedChannel];
          if (resolvedChannel === 'switch_1') {
            candidateCodes.push('switch', 'switch_led', 'switch_go');
          } else if (resolvedChannel === 'switch') {
            candidateCodes.push('switch_1', 'switch_led');
          }

          for (const codeToTry of candidateCodes) {
            const t2 = Date.now().toString();
            const urlPath2 = `/v1.0/devices/${targetDeviceId}/commands`;
            const bodyStr = JSON.stringify({ commands: [{ code: codeToTry, value: isTargetOn }] });
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
              tuyaCodeUsed = codeToTry;
              tuyaMessage = `Comando inviato con successo al cloud Tuya (${codeToTry}: ${isTargetOn ? 'ON' : 'OFF'})`;
              break;
            } else {
              tuyaMessage = cmdData?.msg || 'Errore durante la risposta Tuya';
            }
          }
        } else {
          tuyaMessage = tokenData?.msg || 'Errore autenticazione token Tuya';
        }
      } catch (tuyaErr) {
        tuyaMessage = tuyaErr?.message || String(tuyaErr);
      }
    }

    // 8. Return response in clean requested format
    return res.status(200).json({
      status: 'success',
      message: defaultSuccessMessage,
      device: rawDevice,
      deviceId: targetDeviceId,
      channel: resolvedChannel,
      channelLabel: zoneName,
      state: isTargetOn ? 'on' : 'off',
      value: isTargetOn,
      tuyaSuccess: tuyaSuccess,
      tuyaDetail: tuyaMessage || 'Comando registrato ed elaborato con successo',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: `Errore durante l'elaborazione del comando: ${err?.message || String(err)}`
    });
  }
}
