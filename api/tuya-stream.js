import crypto from 'crypto';

/**
 * Serverless API Route for Tuya Camera Live Stream Allocation
 * POST & GET /api/tuya-stream
 * 
 * Supports WebRTC, HLS (.m3u8), and FLV stream allocation from Tuya OpenAPI.
 * Gracefully handles Tuya quota errors (60001001), trial expirations, and missing permissions.
 */
export default async function handler(req, res) {
  // Setup CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const clientAccessId = params.clientAccessId || params.clientId || process.env.TUYA_CLIENT_ID;
    const clientSecret = params.clientSecret || process.env.TUYA_CLIENT_SECRET;
    const region = params.region || 'eu';
    const deviceId = params.deviceId;
    const streamType = (params.streamType || 'webrtc').toLowerCase();

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_DEVICE_ID',
        message: 'ID Dispositivo (deviceId) mancante nella richiesta. Seleziona o inserisci il Device ID della telecamera.',
      });
    }

    if (!clientAccessId || !clientSecret) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_CREDENTIALS',
        message: 'Credenziali Tuya Cloud non configurate. Inserisci Tuya Client ID (Access ID) e Client Secret nelle impostazioni o sulla scheda della telecamera.',
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
    if (!tokenData || !tokenData.success || !tokenData.result?.access_token) {
      const code = String(tokenData?.code || 'TOKEN_ERROR');
      let msg = tokenData?.msg || 'Errore di autenticazione Tuya';
      if (code === '1102' || code === '1100') {
        msg = 'Client ID o Client Secret non validi. Verifica le chiavi nel portale Tuya Developer (iot.tuya.com).';
      }
      return res.status(400).json({
        success: false,
        code,
        message: `Autenticazione Tuya Cloud fallita: ${msg}`,
      });
    }

    const accessToken = tokenData.result.access_token;

    // 2. Candidate stream endpoints and formats to try on Tuya OpenAPI
    const requestedType = streamType.toLowerCase();
    
    // Priority order: first user requested format (webrtc or hls), then the alternative
    const formatsToTry = requestedType === 'hls' 
      ? ['HLS', 'hls', 'WEBRTC', 'webrtc', 'FLV', 'flv', 'RTSP', 'rtsp']
      : ['WEBRTC', 'webrtc', 'HLS', 'hls', 'FLV', 'flv', 'RTSP', 'rtsp'];

    // Candidate Tuya OpenAPI endpoints for camera stream allocation
    const candidateEndpoints = [
      `/v1.0/devices/${deviceId}/stream/allocate`,
      `/v1.0/devices/${deviceId}/stream/actions/allocate`,
      `/v1.0/users/digital-cloud/live-stream`,
      `/v1.0/users/things/${deviceId}/stream/actions/allocate`,
      `/v1.0/ipc/live/streams`,
    ];

    let lastError = null;

    for (const urlPath of candidateEndpoints) {
      for (const format of formatsToTry) {
        try {
          const t = Date.now().toString();
          
          // Construct payload body according to endpoint spec
          let bodyObj;
          if (urlPath.includes('digital-cloud')) {
            bodyObj = {
              device_id: deviceId,
              type: format,
              audio: true,
            };
          } else {
            bodyObj = {
              type: format,
              audio: true,
            };
          }

          const bodyStr = JSON.stringify(bodyObj);
          const bodySha256 = crypto.createHash('sha256').update(bodyStr).digest('hex');
          const stringToSign = ['POST', bodySha256, '', urlPath].join('\n');
          const signStr = clientAccessId + accessToken + t + stringToSign;
          const sign = crypto.createHmac('sha256', clientSecret).update(signStr).digest('hex').toUpperCase();

          const streamRes = await fetch(`https://${host}${urlPath}`, {
            method: 'POST',
            headers: {
              client_id: clientAccessId,
              access_token: accessToken,
              sign,
              t,
              sign_method: 'HMAC-SHA256',
              'Content-Type': 'application/json',
            },
            body: bodyStr,
          });

          const streamData = await streamRes.json();

          if (streamData && streamData.success && (streamData.result?.url || streamData.result?.sdp || streamData.result?.stream_url || streamData.result?.hls || streamData.result?.webrtc || streamData.result?.data?.url)) {
            const finalUrl = 
              streamData.result.url || 
              streamData.result.stream_url || 
              streamData.result.hls || 
              streamData.result.webrtc || 
              streamData.result.data?.url || 
              (streamData.result.sdp ? 'webrtc-stream-active' : undefined);

            return res.status(200).json({
              success: true,
              streamType: format.toLowerCase(),
              streamUrl: finalUrl,
              streamData: streamData.result,
              endpointUsed: urlPath,
              message: `Flusso ${format.toUpperCase()} generato automaticamente con successo da Tuya Cloud (${urlPath})!`,
            });
          }

          lastError = streamData;
          const errCode = String(streamData?.code || '');

          // If quota exceeded or permission denied, stop polling more endpoints and report immediately
          if (errCode === '60001001' || errCode === '28841002' || errCode === '28841001') {
            break;
          }
        } catch (e) {
          lastError = { code: 'FETCH_ERROR', msg: e?.message || String(e) };
        }
      }

      const errCode = String(lastError?.code || '');
      if (errCode === '60001001' || errCode === '28841002') {
        break;
      }
    }

    // 3. Precise Error Handling for Tuya Errors (e.g. 60001001, 28841002, 2001)
    const errorCode = String(lastError?.code || 'STREAM_ALLOCATION_FAILED');
    const rawMsg = lastError?.msg || 'Impossibile allocare il flusso video';

    let userFriendlyMsg = `Tuya Cloud (${host}): Errore ${errorCode}: ${rawMsg}`;

    if (errorCode === '60001001') {
      userFriendlyMsg = `Tuya Cloud: Errore 60001001 - Quota Dispositivi o Prova Gratuita Esaurita (controllable device pool quota is insufficient). Per sbloccare: accedi a iot.tuya.com -> Cloud -> Sviluppo -> Il Mio Servizio -> IoT Core e clicca su "Estendi Prova Gratuita" (Free Trial Extension). In alternativa puoi inserire un URL Stream diretto o usare lo Snapshot Live.`;
    } else if (errorCode === '28841002' || errorCode === '28841001') {
      userFriendlyMsg = `Tuya Cloud: Errore ${errorCode} - Licenza API o IPC scaduta. Accedi a iot.tuya.com -> Cloud -> Sviluppo -> Il Mio Servizio per rinnovare la prova gratuita.`;
    } else if (errorCode === '2001') {
      userFriendlyMsg = `Tuya Cloud: Errore 2001 - Telecamera offline o non connessa al Wi-Fi.`;
    } else if (errorCode === '2008' || errorCode === '1106') {
      userFriendlyMsg = `Tuya Cloud: Errore ${errorCode} - ID Dispositivo "${deviceId}" non trovato nell'account Tuya Developer.`;
    }

    return res.status(200).json({
      success: false,
      code: errorCode,
      rawError: lastError,
      message: userFriendlyMsg,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: `Errore interno server Tuya Stream: ${error?.message || String(error)}`,
    });
  }
}
