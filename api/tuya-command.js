import crypto from 'crypto';

/**
 * Helper to execute signed GET requests to Tuya OpenAPI
 */
async function tuyaGet(urlPath, host, clientAccessId, clientSecret, accessToken) {
  try {
    const t = Date.now().toString();
    const bodySha256 = crypto.createHash('sha256').update('').digest('hex');
    const stringToSign = ['GET', bodySha256, '', urlPath].join('\n');
    const signStr = clientAccessId + accessToken + t + stringToSign;
    const sign = crypto.createHmac('sha256', clientSecret).update(signStr).digest('hex').toUpperCase();

    const res = await fetch(`https://${host}${urlPath}`, {
      method: 'GET',
      headers: {
        client_id: clientAccessId,
        access_token: accessToken,
        sign: sign,
        t: t,
        sign_method: 'HMAC-SHA256',
      },
    });
    return await res.json();
  } catch (err) {
    return null;
  }
}

/**
 * Vercel / Serverless API Route for Tuya Device Command Execution
 * POST /api/tuya-command
 * 
 * Body parameters:
 * - deviceId: string (required)
 * - command: { code: string, value: any } or code/value or commands array
 * - clientAccessId: string (optional if set in env process.env.TUYA_CLIENT_ID)
 * - clientSecret: string (optional if set in env process.env.TUYA_CLIENT_SECRET)
 * - region: 'eu' | 'us' | 'cn' | 'in' (default: 'eu')
 */
function formatTuyaError(code, rawMsg, host) {
  const codeStr = String(code || '');
  if (codeStr === '60001001') {
    return `Tuya Cloud (${host}): Errore 60001001 - Limite Dispositivi Controllabili o Rate Limit Superato (controllable device pool quota is insufficient). Nei progetti Tuya Cloud (anche rinnovati) esiste un limite di max 10 dispositivi controllabili simultaneamente nel 'Controllable Device Pool'. Se l'account Smart Life ha più di 10 dispositivi collegati al progetto Tuya su iot.tuya.com (Cloud -> My Project -> Devices), rimuovere quelli in eccesso.`;
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

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Metodo non consentito. Utilizzare POST.',
    });
  }

  try {
    const body = req.body || {};
    const clientAccessId = body.clientAccessId || process.env.TUYA_CLIENT_ID;
    const clientSecret = body.clientSecret || process.env.TUYA_CLIENT_SECRET;
    const region = body.region || 'eu';
    const cleanDeviceId = String(body.deviceId || '').trim();

    if (!cleanDeviceId) {
      return res.status(400).json({
        success: false,
        message: 'ID Dispositivo (deviceId) mancante nella richiesta.',
      });
    }

    if (!clientAccessId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Credenziali Tuya mancanti. Fornire clientAccessId e clientSecret o impostarli nelle variabili d\'ambiente.',
      });
    }

    // Determine commands payload
    let commandList = [];
    if (body.command && typeof body.command === 'object' && body.command.code) {
      commandList = [body.command];
    } else if (Array.isArray(body.commands) && body.commands.length > 0) {
      commandList = body.commands;
    } else if (body.code !== undefined && body.value !== undefined) {
      commandList = [{ code: body.code, value: body.value }];
    } else {
      commandList = [{ code: 'switch_1', value: true }];
    }

    const regionHosts = {
      eu: 'openapi.tuyaeu.com',
      us: 'openapi.tuyaus.com',
      cn: 'openapi.tuyacn.com',
      in: 'openapi.tuyain.com',
    };
    const host = regionHosts[region] || 'openapi.tuyaeu.com';

    // 1. Get Tuya Access Token with HMAC-SHA256 signature
    const t1 = Date.now().toString();
    const urlPath1 = '/v1.0/token?grant_type=1';
    const bodySha256_1 = crypto.createHash('sha256').update('').digest('hex');
    const stringToSign1 = ['GET', bodySha256_1, '', urlPath1].join('\n');
    const signStr1 = clientAccessId + t1 + stringToSign1;
    const sign1 = crypto.createHmac('sha256', clientSecret).update(signStr1).digest('hex').toUpperCase();

    const tokenUrl = `https://${host}${urlPath1}`;
    const tokenRes = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        client_id: clientAccessId,
        sign: sign1,
        t: t1,
        sign_method: 'HMAC-SHA256',
      },
    });

    const tokenData = await tokenRes.json();
    if (!tokenData || !tokenData.success || !tokenData.result) {
      return res.status(400).json({
        success: false,
        code: tokenData?.code || 'TOKEN_ERROR',
        message: `Autenticazione Tuya Cloud fallita (${tokenData?.msg || 'Errore Token'}). Verificare Client ID e Secret Key.`,
      });
    }

    const accessToken = tokenData.result.access_token;

    // Assemble primary candidate DP codes directly (fast-path without heavy GET requests)
    const primaryCmd = commandList[0];
    let candidateCodes = [];

    const isGate = body.isGate || body.category === 'gate' || body.category === 'pulsed_switch';
    const deviceNameStr = (body.deviceName || body.name || '').toLowerCase();
    const isCancelletto =
      deviceNameStr.includes('cancelletto') ||
      cleanDeviceId.toLowerCase().includes('cancelletto') ||
      body.dpCode === 'switch' ||
      primaryCmd.code === 'switch';

    if (isCancelletto) {
      // Per il solo "Cancelletto" invia primariamente il codice "switch"
      // Payload: { "commands": [{ "code": "switch", "value": ... }] } con fallback "switch_led", "switch_1"
      candidateCodes.push('switch', 'switch_led', 'switch_1');
    } else {
      // MANTIENI INVARIATO il codice e la logica per tutti gli altri dispositivi (incluso il "Cancellone", che deve continuare a inviare "code": "switch_1")
      if (body.dpCode) {
        candidateCodes.push(body.dpCode);
      }
      if (primaryCmd.code) {
        candidateCodes.push(primaryCmd.code);
      }

      if (isGate) {
        candidateCodes.push('switch_1', 'switch', 'doorcontrol_1', 'gate_control');
      } else if (typeof primaryCmd.value === 'boolean') {
        candidateCodes.push('switch_1', 'switch', 'switch_led', 'power', 'on_off');
      }
    }

    candidateCodes = Array.from(new Set(candidateCodes)).filter(Boolean);

    let dynamicCodes = [];
    let isSubDevice = false;
    let gatewayId = null;
    let lastErrorMsg = '';
    let lastErrorCode = '';
    let successResult = null;

    const urlPath2 = `/v1.0/devices/${cleanDeviceId}/commands`;

    // Fast-path execution loop
    for (const codeToTry of candidateCodes) {
      const cmdPayload = [{ code: codeToTry, value: primaryCmd.value }];
      const bodyObj = { commands: cmdPayload };
      const bodyStr = JSON.stringify(bodyObj);
      const bodySha256_2 = crypto.createHash('sha256').update(bodyStr).digest('hex');

      const t2 = Date.now().toString();
      const stringToSign2 = ['POST', bodySha256_2, '', urlPath2].join('\n');
      const signStr2 = clientAccessId + accessToken + t2 + stringToSign2;
      const sign2 = crypto.createHmac('sha256', clientSecret).update(signStr2).digest('hex').toUpperCase();

      try {
        const commandRes = await fetch(`https://${host}${urlPath2}`, {
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

        const commandData = await commandRes.json();

        if (commandData && commandData.success) {
          successResult = {
            host,
            success: true,
            codeUsed: codeToTry,
            isSubDevice,
            gatewayId,
            result: commandData.result,
            message: `Comando '${codeToTry}: ${primaryCmd.value}' inviato con successo a Tuya Cloud!`,
          };
          break;
        }

        if (commandData?.code) {
          lastErrorCode = String(commandData.code);
          lastErrorMsg = commandData.msg || 'Errore sconosciuto';
        } else if (!lastErrorCode) {
          lastErrorCode = 'COMMAND_FAILED';
          lastErrorMsg = 'Errore sconosciuto';
        }

        // Account-level, Quota-level, or Offline errors: stop retrying immediately to preserve API quota
        if (['2001', '2008', '1106', '1108', '60001001', '28841002', '28841001'].includes(String(commandData?.code))) {
          break;
        }
      } catch (err) {
        lastErrorMsg = err?.message || String(err);
      }
    }

    const formattedErrMsg = formatTuyaError(lastErrorCode, lastErrorMsg, host);

    if (isGate) {
      console.log("Tuya Response Gate:", successResult || {
        success: false,
        code: lastErrorCode,
        message: formattedErrMsg,
      });
    }

    if (successResult) {
      return res.status(200).json(successResult);
    }

    return res.status(400).json({
      success: false,
      code: lastErrorCode,
      isSubDevice,
      gatewayId,
      message: formattedErrMsg,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Errore interno server Tuya Command: ${error?.message || String(error)}`,
    });
  }
}

