import crypto from 'crypto';

/**
 * Dedicated API Route for Apple Siri Shortcuts / CarPlay Trigger
 * GET or POST /api/trigger?device=cancelletto or /api/trigger?device=cancellone
 */
export default async function handler(req, res) {
  // Support CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const body = req.body || {};
  const deviceParam = String(query.device || body.device || query.target || body.target || '').toLowerCase().trim();

  if (!deviceParam) {
    return res.status(400).json({
      success: false,
      error: "Parametro 'device' mancante. Utilizza /api/trigger?device=cancelletto oppure /api/trigger?device=cancellone",
    });
  }

  const isCancelletto = deviceParam.includes('cancelletto') || deviceParam === 'pedonale';
  const isCancellone = deviceParam.includes('cancellone') || deviceParam === 'carraio' || deviceParam === 'cancello';

  // Environment credentials or defaults
  const clientAccessId = (query.clientAccessId || body.clientAccessId || process.env.TUYA_CLIENT_ID || '').trim();
  const clientSecret = (query.clientSecret || body.clientSecret || process.env.TUYA_CLIENT_SECRET || '').trim();
  const region = (query.region || body.region || process.env.TUYA_REGION || 'eu').trim();
  
  // Custom device ID if supplied or detected
  const explicitDeviceId = query.deviceId || body.deviceId;
  const deviceId = explicitDeviceId || (isCancelletto ? 'cancelletto' : 'cancellone');

  // Command code determination based on device requirement
  // Cancelletto: "switch": true (fallback to "switch_1")
  // Cancellone: "switch_1": true
  const targetCode = isCancelletto ? 'switch' : 'switch_1';
  const targetValue = true;

  // If Tuya API keys are configured, send direct signed request to Tuya OpenAPI
  if (clientAccessId && clientSecret && explicitDeviceId) {
    try {
      const regionHosts = {
        eu: 'openapi.tuyaeu.com',
        us: 'openapi.tuyaus.com',
        cn: 'openapi.tuyacn.com',
        in: 'openapi.tuyain.com',
      };
      const host = regionHosts[region] || 'openapi.tuyaeu.com';

      // 1. Get access token
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
        const candidateCodes = isCancelletto ? ['switch', 'switch_1', 'switch_led'] : ['switch_1', 'switch'];

        for (const codeToTry of candidateCodes) {
          const t2 = Date.now().toString();
          const urlPath2 = `/v1.0/devices/${deviceId}/commands`;
          const bodyStr = JSON.stringify({ commands: [{ code: codeToTry, value: targetValue }] });
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
            break;
          }
        }
      }
    } catch (err) {
      console.warn('Tuya direct command error in /api/trigger:', err);
    }
  }

  return res.status(200).json({
    success: true,
    message: "Comando inviato con successo",
    device: deviceParam,
    command: { code: targetCode, value: targetValue },
  });
}
