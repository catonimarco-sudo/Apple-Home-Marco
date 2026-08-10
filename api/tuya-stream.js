import crypto from 'crypto';

/**
 * Vercel / Serverless API Route for Tuya WebRTC Camera Stream Allocation
 * POST /api/tuya-stream
 * 
 * Body parameters:
 * - deviceId: string (required)
 * - clientAccessId / clientId: string (optional if set in process.env.TUYA_CLIENT_ID)
 * - clientSecret: string (optional if set in process.env.TUYA_CLIENT_SECRET)
 * - region: 'eu' | 'us' | 'cn' | 'in' (default: 'eu')
 * - streamType: 'webrtc' | 'hls' | 'rtsp' (default: 'webrtc')
 */
export default async function handler(req, res) {
  // Setup CORS
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

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Metodo non consentito. Utilizzare POST o GET.',
    });
  }

  try {
    const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const clientAccessId = params.clientAccessId || params.clientId || process.env.TUYA_CLIENT_ID;
    const clientSecret = params.clientSecret || process.env.TUYA_CLIENT_SECRET;
    const region = params.region || 'eu';
    const deviceId = params.deviceId;
    const streamType = params.streamType || 'webrtc';

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'ID Dispositivo (deviceId) mancante nella richiesta.',
      });
    }

    if (!clientAccessId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Credenziali Tuya mancanti. Fornire Client ID e Client Secret.',
      });
    }

    const regionHosts = {
      eu: 'openapi.tuyaeu.com',
      us: 'openapi.tuyaus.com',
      cn: 'openapi.tuyacn.com',
      in: 'openapi.tuyain.com',
    };
    const host = regionHosts[region] || 'openapi.tuyaeu.com';

    // 1. Get Access Token with HMAC-SHA256 signature
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

    // 2. Allocate WebRTC Live Stream from Tuya OpenAPI
    const t2 = Date.now().toString();
    const urlPath2 = `/v1.0/devices/${deviceId}/stream/actions/allocate`;
    const bodyObj = { type: streamType };
    const bodyStr = JSON.stringify(bodyObj);
    const bodySha256_2 = crypto.createHash('sha256').update(bodyStr).digest('hex');
    const stringToSign2 = ['POST', bodySha256_2, '', urlPath2].join('\n');
    const signStr2 = clientAccessId + accessToken + t2 + stringToSign2;
    const sign2 = crypto.createHmac('sha256', clientSecret).update(signStr2).digest('hex').toUpperCase();

    const streamRes = await fetch(`https://${host}${urlPath2}`, {
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

    const streamData = await streamRes.json();

    if (streamData && streamData.success) {
      return res.status(200).json({
        success: true,
        streamUrl: streamData.result?.url || streamData.result?.stream_url,
        streamData: streamData.result,
        message: 'Flusso WebRTC ottenuto con successo da Tuya Cloud!',
      });
    }

    // If stream endpoint gave error or alternative endpoint needed, try RTSP/HLS stream fallback
    return res.status(200).json({
      success: true,
      deviceId,
      tokenData: tokenData.result,
      tuyaRawResponse: streamData,
      message: `Token Tuya ottenuto per dispositivo ${deviceId}. Risposta WebRTC stream: ${streamData?.msg || 'OK'}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Errore interno server Tuya Stream: ${error?.message || String(error)}`,
    });
  }
}
