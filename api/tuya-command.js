import crypto from 'crypto';

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
    const deviceId = body.deviceId;

    if (!deviceId) {
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

    // 2. Candidate DP codes fallback for Tuya lights, plugs, switches
    const primaryCmd = commandList[0];
    let candidateCodes = [primaryCmd.code];

    if (typeof primaryCmd.value === 'boolean') {
      const powerCandidates = ['switch_led', 'switch_1', 'switch', 'led_switch', 'switch_led_1', 'switch_a'];
      candidateCodes = Array.from(new Set([primaryCmd.code, ...powerCandidates]));
    } else if (typeof primaryCmd.code === 'string' && primaryCmd.code.includes('bright')) {
      const brightCandidates = ['bright_value', 'bright_value_v2', 'brightness', 'value'];
      candidateCodes = Array.from(new Set([primaryCmd.code, ...brightCandidates]));
    }

    let lastErrorMsg = '';
    let lastErrorCode = '';
    let successResult = null;

    for (const codeToTry of candidateCodes) {
      const cmdPayload = [{ code: codeToTry, value: primaryCmd.value }];
      const t2 = Date.now().toString();
      const urlPath2 = `/v1.0/devices/${deviceId}/commands`;
      const bodyObj = { commands: cmdPayload };
      const bodyStr = JSON.stringify(bodyObj);
      const bodySha256_2 = crypto.createHash('sha256').update(bodyStr).digest('hex');
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
            result: commandData.result,
            message: `Comando '${codeToTry}: ${primaryCmd.value}' inviato con successo a Tuya Cloud!`,
          };
          break;
        }

        lastErrorCode = commandData?.code || 'COMMAND_FAILED';
        lastErrorMsg = commandData?.msg || 'Errore sconosciuto';

        if (lastErrorCode === '2001' || lastErrorCode === '2008' || lastErrorCode === '1106') {
          break;
        }
      } catch (err) {
        lastErrorMsg = err?.message || String(err);
      }
    }

    if (successResult) {
      return res.status(200).json(successResult);
    }

    return res.status(400).json({
      success: false,
      code: lastErrorCode,
      message: `Tuya Cloud (${host}): Errore ${lastErrorCode}: ${lastErrorMsg}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Errore interno server Tuya Command: ${error?.message || String(error)}`,
    });
  }
}
