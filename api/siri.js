import crypto from 'crypto';

/**
 * Serverless API Route for Apple Siri Shortcuts, Siri Voice Control, Webhooks & CarPlay
 * 
 * Uses Vercel Environment Variables:
 * - process.env.ID -> Tuya Client ID / Access Key
 * - process.env.ID_SEGRETO -> Tuya Client Secret
 * - process.env.UID -> Tuya User ID / Device ID
 * 
 * Supports GET and POST:
 *   GET /api/siri?device=luce_Flavio&channel=switch_1&state=on
 *   GET /api/siri?device=irrigazione&channel=switch_1&state=on
 *   GET /api/siri?device=irrigazione&channel=2&state=off
 *   POST /api/siri with JSON: { "device": "luce_Flavio", "channel": "switch_1", "state": "on" }
 *   GET /api/siri?device=cancellone&state=on
 *   GET /api/siri?device=presa&state=off
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
  switch_1: 'Lato Cancellone / Canale 1',
  switch_2: 'Centrale / Canale 2',
  switch_3: 'Lato Cancelletto / Canale 3',
  switch_4: 'Canale 4',
};

// Helper: Normalize string for fuzzy matching device names
function normalizeName(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

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

    // 1. Read Vercel & Project Environment Variables
    const clientAccessId = (
      process.env.ID ||
      process.env.TUYA_CLIENT_ID ||
      query.clientAccessId ||
      body.clientAccessId ||
      query.id ||
      body.id ||
      ''
    ).trim();

    const clientSecret = (
      process.env.ID_SEGRETO ||
      process.env.TUYA_CLIENT_SECRET ||
      query.clientSecret ||
      body.clientSecret ||
      query.id_segreto ||
      body.id_segreto ||
      ''
    ).trim();

    const tuyaUid = (
      process.env.UID ||
      process.env.TUYA_UID ||
      query.uid ||
      body.uid ||
      ''
    ).trim();

    const region = (
      process.env.TUYA_REGION ||
      process.env.REGION ||
      query.region ||
      body.region ||
      'eu'
    ).trim();

    // 2. Parse device parameter
    const rawDevice = String(
      query.device ||
      body.device ||
      query.deviceId ||
      body.deviceId ||
      query.target ||
      body.target ||
      query.name ||
      ''
    ).trim();

    if (!rawDevice) {
      return res.status(400).json({
        status: 'error',
        message: "Parametro 'device' mancante. Esempio: /api/siri?device=luce_Flavio&channel=switch_1&state=on",
        usage: {
          url: '/api/siri?device=luce_Flavio&channel=switch_1&state=on',
          methods: ['GET', 'POST'],
          parameters: {
            device: 'Nome o ID del dispositivo (es. luce_Flavio, irrigazione, presa, cancellone, o Tuya ID)',
            channel: 'Canale relè (es. switch_1, switch_2, switch_3, switch_4, 1, 2, 3, 4, centrale, lato cancellone)',
            state: 'Stato desiderato: on / off / true / false / 1 / 0 / accendi / spegni / apri / chiudi (default: on)'
          },
          envVariablesConfigured: {
            ID: Boolean(process.env.ID || process.env.TUYA_CLIENT_ID),
            ID_SEGRETO: Boolean(process.env.ID_SEGRETO || process.env.TUYA_CLIENT_SECRET),
            UID: Boolean(process.env.UID || process.env.TUYA_UID),
          }
        }
      });
    }

    const deviceKey = rawDevice.toLowerCase();

    // 3. Parse channel parameter
    const rawChannel = String(
      query.channel ||
      body.channel ||
      query.dpCode ||
      body.dpCode ||
      query.dp ||
      body.dp ||
      query.gang ||
      body.gang ||
      ''
    ).trim().toLowerCase();

    let resolvedChannel = CHANNEL_ALIASES[rawChannel] || rawChannel;

    if (!resolvedChannel) {
      if (deviceKey.includes('irrigaz') || deviceKey.includes('solenoide') || deviceKey.includes('giardino')) {
        resolvedChannel = 'switch_1';
      } else if (deviceKey.includes('cancelletto') || deviceKey.includes('pedonale')) {
        resolvedChannel = 'switch';
      } else {
        resolvedChannel = 'switch_1';
      }
    }

    // 4. Parse state parameter
    const rawState = String(
      query.state ||
      body.state ||
      query.action ||
      body.action ||
      query.power ||
      body.power ||
      query.value ||
      body.value ||
      'on'
    ).trim().toLowerCase();

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

    // 5. Initial Device ID resolution
    let targetDeviceId = query.deviceId || body.deviceId;
    let targetDeviceDisplayName = rawDevice;

    if (!targetDeviceId) {
      for (const [key, id] of Object.entries(KNOWN_DEVICE_IDS)) {
        if (deviceKey.includes(key)) {
          targetDeviceId = id;
          break;
        }
      }
    }

    // If still not matched, check if rawDevice itself is a Tuya ID (e.g. alphanumeric 16+ chars)
    if (!targetDeviceId) {
      if (/^[a-zA-Z0-9_-]{15,35}$/.test(rawDevice) && !rawDevice.includes(' ') && !rawDevice.includes('_Flavio')) {
        targetDeviceId = rawDevice;
      }
    }

    // 6. Execute Real HTTP Tuya Cloud Call if credentials are present
    let tuyaSuccess = false;
    let tuyaMessage = '';
    let tuyaCodeUsed = resolvedChannel;

    const regionHosts = {
      eu: 'openapi.tuyaeu.com',
      us: 'openapi.tuyaus.com',
      cn: 'openapi.tuyacn.com',
      in: 'openapi.tuyain.com',
    };
    const host = regionHosts[region] || 'openapi.tuyaeu.com';

    if (clientAccessId && clientSecret) {
      try {
        // Step A: Obtain Tuya Access Token (HMAC-SHA256)
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

          // Step B: If targetDeviceId is not resolved yet or is a friendly name like "luce_Flavio", query user devices via Tuya UID
          if ((!targetDeviceId || targetDeviceId === rawDevice) && tuyaUid) {
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
                const searchNorm = normalizeName(rawDevice);
                const matchedDevice = uidData.result.find((d) => {
                  const dName = normalizeName(d.name);
                  const dCustom = normalizeName(d.custom_name);
                  return (
                    dName === searchNorm ||
                    dCustom === searchNorm ||
                    dName.includes(searchNorm) ||
                    searchNorm.includes(dName) ||
                    (d.id && d.id.toLowerCase() === rawDevice.toLowerCase())
                  );
                });

                if (matchedDevice && matchedDevice.id) {
                  targetDeviceId = matchedDevice.id;
                  targetDeviceDisplayName = matchedDevice.name || matchedDevice.custom_name || rawDevice;
                } else if (uidData.result.length === 1 && !targetDeviceId) {
                  targetDeviceId = uidData.result[0].id;
                  targetDeviceDisplayName = uidData.result[0].name || rawDevice;
                }
              }
            } catch (userDevErr) {
              console.warn('[Tuya Siri] Error resolving user devices via UID:', userDevErr);
            }
          }

          // Fallback: if targetDeviceId is still empty, and tuyaUid looks like a direct Device ID
          if (!targetDeviceId && tuyaUid && /^[a-zA-Z0-9_-]{15,35}$/.test(tuyaUid)) {
            targetDeviceId = tuyaUid;
          }
          if (!targetDeviceId) {
            targetDeviceId = rawDevice;
          }

          // Step C: Send Device Command to Tuya Cloud
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
    } else {
      tuyaMessage = 'Variabili d\'ambiente Tuya non impostate (process.env.ID / process.env.ID_SEGRETO)';
    }

    // 7. Human-readable response
    const zoneName = CHANNEL_LABELS[resolvedChannel] || resolvedChannel;
    const actionText = isTargetOn ? 'attivato' : 'disattivato';
    const cleanMessage = `Canale ${actionText}`;

    return res.status(200).json({
      status: 'success',
      message: cleanMessage,
      device: targetDeviceDisplayName,
      deviceId: targetDeviceId,
      channel: resolvedChannel,
      channelLabel: zoneName,
      state: isTargetOn ? 'on' : 'off',
      value: isTargetOn,
      tuyaSuccess: tuyaSuccess,
      tuyaDetail: tuyaMessage,
      credentialsUsed: {
        idConfigured: Boolean(process.env.ID || process.env.TUYA_CLIENT_ID),
        idSegretoConfigured: Boolean(process.env.ID_SEGRETO || process.env.TUYA_CLIENT_SECRET),
        uidConfigured: Boolean(process.env.UID || process.env.TUYA_UID),
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: `Errore durante l'elaborazione del comando: ${err?.message || String(err)}`
    });
  }
}
