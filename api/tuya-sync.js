import crypto from 'crypto';

function generateSignature(clientId, secret, timestamp, accessToken = '', url = '') {
  const str = clientId + accessToken + timestamp + url;
  return crypto.createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
}

export default async function handler(req, res) {
  // Permetti chiamate CORS da Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientId, secret, uid, endpoint } = req.body || {};

  if (!clientId || !secret || !uid) {
    return res.status(400).json({ error: 'Mancano parametri: clientId, secret o uid' });
  }

  const baseUrl = endpoint || 'https://openapi.tuyaeu.com';

  try {
    // 1. Richiesta Token di accesso a Tuya
    const t1 = Date.now().toString();
    const tokenPath = '/v1.0/token?grant_type=1';
    const sign1 = generateSignature(clientId, secret, t1, '', `GET${tokenPath}`);

    const tokenRes = await fetch(`${baseUrl}${tokenPath}`, {
      headers: {
        'client_id': clientId,
        'sign': sign1,
        't': t1,
        'sign_method': 'HMAC-SHA256'
      }
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.success) {
      return res.status(400).json({ error: tokenData.msg || 'Errore durante l\'autenticazione Tuya' });
    }

    const accessToken = tokenData.result.access_token;

    // 2. Richiesta elenco dispositivi dell'utente
    const t2 = Date.now().toString();
    const devPath = `/v1.0/users/${uid}/devices`;
    const sign2 = generateSignature(clientId, secret, t2, accessToken, `GET${devPath}`);

    const devRes = await fetch(`${baseUrl}${devPath}`, {
      headers: {
        'client_id': clientId,
        'access_token': accessToken,
        'sign': sign2,
        't': t2,
        'sign_method': 'HMAC-SHA256'
      }
    });

    const devData = await devRes.json();
    return res.status(200).json(devData);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Errore interno Serverless' });
  }
}