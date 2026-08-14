import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import tuyaCommandHandler from "./api/tuya-command.js";
import tuyaSyncHandler from "./api/tuya-sync.js";
import tuyaStreamHandler from "./api/tuya-stream.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK server-side safely
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "SmartLife Hub API" });
});

/**
 * Real Tuya OpenAPI Token & Device Fetcher
 */
async function fetchTuyaOpenApiDevices(clientAccessId: string, clientSecret: string, region: string, userUid?: string) {
  const regionHosts: Record<string, string> = {
    eu: "openapi.tuyaeu.com",
    us: "openapi.tuyaus.com",
    cn: "openapi.tuyacn.com",
    in: "openapi.tuyain.com",
  };
  const host = regionHosts[region] || "openapi.tuyaeu.com";

  // Step 1: Request Access Token
  const t1 = Date.now().toString();
  const urlPath1 = "/v1.0/token?grant_type=1";
  const bodySha256 = crypto.createHash("sha256").update("").digest("hex");
  const stringToSign1 = ["GET", bodySha256, "", urlPath1].join("\n");
  const signStr1 = clientAccessId + t1 + stringToSign1;
  const sign1 = crypto.createHmac("sha256", clientSecret).update(signStr1).digest("hex").toUpperCase();

  const tokenUrl = `https://${host}${urlPath1}`;
  const tokenRes = await fetch(tokenUrl, {
    method: "GET",
    headers: {
      client_id: clientAccessId,
      sign: sign1,
      t: t1,
      sign_method: "HMAC-SHA256",
    },
  });

  const tokenData = await tokenRes.json();
  if (!tokenData || !tokenData.success || !tokenData.result) {
    return { host, success: false, tokenData };
  }

  const { access_token, uid } = tokenData.result;
  const targetUid = userUid || uid;

  // Step 2: Request Devices for this User Account
  const t2 = Date.now().toString();
  const urlPath2 = targetUid ? `/v1.0/users/${targetUid}/devices` : `/v1.0/devices`;
  const stringToSign2 = ["GET", bodySha256, "", urlPath2].join("\n");
  const signStr2 = clientAccessId + access_token + t2 + stringToSign2;
  const sign2 = crypto.createHmac("sha256", clientSecret).update(signStr2).digest("hex").toUpperCase();

  let devicesData: any = null;
  try {
    const devRes = await fetch(`https://${host}${urlPath2}`, {
      method: "GET",
      headers: {
        client_id: clientAccessId,
        access_token: access_token,
        sign: sign2,
        t: t2,
        sign_method: "HMAC-SHA256",
      },
    });
    devicesData = await devRes.json();
  } catch (err) {
    console.error("Tuya devices query error:", err);
  }

  return {
    host,
    success: true,
    access_token,
    uid: targetUid,
    tokenData,
    devicesData,
  };
}

// Endpoint: Tuya / Smart Life Cloud API Sync Route
app.all("/api/tuya-sync", tuyaSyncHandler);
app.all("/api/smart-life/sync", tuyaSyncHandler);
app.all("/api/tuya/sync", tuyaSyncHandler);

function formatTuyaError(code: string, rawMsg: string, host: string): string {
  const codeStr = String(code || '');
  if (codeStr === '60001001') {
    return `Tuya Cloud (${host}): Errore 60001001 - Quota API Tuya o Prova Gratuita Esaurita (controllable device pool quota is insufficient). Per ripristinare il controllo: accedi a iot.tuya.com -> Cloud -> Sviluppo -> Il Mio Servizio -> IoT Core e fai clic su "Estendi Prova Gratuita" (Free Trial Extension).`;
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

/**
 * Send Command to Tuya Cloud Device (POST /v1.0/devices/{device_id}/commands)
 * Uses candidate DP code fallback (e.g. switch_led, switch_1, switch, led_switch)
 * to ensure commands reach real Tuya lights, plugs, and switches.
 */
async function sendTuyaDeviceCommand(
  clientAccessId: string,
  clientSecret: string,
  region: string,
  deviceId: string,
  commands: Array<{ code: string; value: any }>
) {
  const cleanDeviceId = String(deviceId || '').trim();
  const regionHosts: Record<string, string> = {
    eu: "openapi.tuyaeu.com",
    us: "openapi.tuyaus.com",
    cn: "openapi.tuyacn.com",
    in: "openapi.tuyain.com",
  };
  const host = regionHosts[region] || "openapi.tuyaeu.com";

  // Step 1: Request Access Token
  const t1 = Date.now().toString();
  const urlPath1 = "/v1.0/token?grant_type=1";
  const bodySha256_1 = crypto.createHash("sha256").update("").digest("hex");
  const stringToSign1 = ["GET", bodySha256_1, "", urlPath1].join("\n");
  const signStr1 = clientAccessId + t1 + stringToSign1;
  const sign1 = crypto.createHmac("sha256", clientSecret).update(signStr1).digest("hex").toUpperCase();

  const tokenUrl = `https://${host}${urlPath1}`;
  const tokenRes = await fetch(tokenUrl, {
    method: "GET",
    headers: {
      client_id: clientAccessId,
      sign: sign1,
      t: t1,
      sign_method: "HMAC-SHA256",
    },
  });

  const tokenData = await tokenRes.json();
  if (!tokenData || !tokenData.success || !tokenData.result) {
    return {
      host,
      success: false,
      code: tokenData?.code || "TOKEN_ERROR",
      message: `Impossibile autenticarsi su Tuya Cloud (${tokenData?.msg || "Token Error"}). Verificare Client ID e Secret.`,
    };
  }

  const { access_token } = tokenData.result;

  // Build list of candidate command lists to try if initial DP code is rejected by device
  const primaryCmd = commands[0];
  let candidateCodes: string[] = [primaryCmd.code];

  if (cleanDeviceId.toLowerCase().includes('cancelletto') || primaryCmd.code === 'switch') {
    candidateCodes = ['switch', 'switch_led', 'switch_1'];
  } else if (typeof primaryCmd.value === "boolean") {
    // Standard power toggle candidates for Tuya devices
    const powerCandidates = ["switch_1", "switch", "switch_led", "led_switch", "switch_led_1", "switch_a"];
    candidateCodes = Array.from(new Set([primaryCmd.code, ...powerCandidates]));
  } else if (primaryCmd.code.includes("bright")) {
    const brightCandidates = ["bright_value", "bright_value_v2", "brightness", "value"];
    candidateCodes = Array.from(new Set([primaryCmd.code, ...brightCandidates]));
  }

  let lastErrorMsg = "";
  let lastErrorCode = "";

  for (const codeToTry of candidateCodes) {
    const cmdPayload = [{ code: codeToTry, value: primaryCmd.value }];
    const t2 = Date.now().toString();
    const urlPath2 = `/v1.0/devices/${cleanDeviceId}/commands`;
    const bodyObj = { commands: cmdPayload };
    const bodyStr = JSON.stringify(bodyObj);
    const bodySha256_2 = crypto.createHash("sha256").update(bodyStr).digest("hex");
    const stringToSign2 = ["POST", bodySha256_2, "", urlPath2].join("\n");
    const signStr2 = clientAccessId + access_token + t2 + stringToSign2;
    const sign2 = crypto.createHmac("sha256", clientSecret).update(signStr2).digest("hex").toUpperCase();

    try {
      const commandRes = await fetch(`https://${host}${urlPath2}`, {
        method: "POST",
        headers: {
          client_id: clientAccessId,
          access_token: access_token,
          sign: sign2,
          t: t2,
          sign_method: "HMAC-SHA256",
          "Content-Type": "application/json",
        },
        body: bodyStr,
      });

      const commandData = await commandRes.json();

      if (commandData && commandData.success) {
        return {
          host,
          success: true,
          codeUsed: codeToTry,
          result: commandData.result,
          message: `Comando '${codeToTry}: ${primaryCmd.value}' inviato con successo al dispositivo Tuya Cloud!`,
        };
      }

      lastErrorCode = commandData?.code || "COMMAND_FAILED";
      lastErrorMsg = commandData?.msg || "Errore sconosciuto";

      // If device offline, quota exceeded, trial expired, or device not found, break loop
      if (["2001", "2008", "1106", "1108", "60001001", "28841002", "28841001"].includes(String(lastErrorCode))) {
        break;
      }
    } catch (e: any) {
      lastErrorMsg = e?.message || String(e);
    }
  }

  return {
    host,
    success: false,
    code: lastErrorCode,
    message: formatTuyaError(lastErrorCode, lastErrorMsg, host),
  };
}

// Endpoint: Serverless API Route for Tuya Device Command Execution
app.all("/api/tuya-command", tuyaCommandHandler);
app.all("/api/tuya", tuyaCommandHandler);
app.all("/api/tuya/command", tuyaCommandHandler);

// Endpoint: Serverless API Route for Tuya WebRTC Camera Stream Allocation
app.all("/api/tuya-stream", tuyaStreamHandler);
app.all("/api/tuya-webrtc", tuyaStreamHandler);
app.all("/api/tuya/stream", tuyaStreamHandler);

// Endpoint: Gemini Smart Home AI Assistant
app.post("/api/ai/assistant", async (req, res) => {
  try {
    const { message, devices, automations } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Messaggio utente richiesto" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        reply: "Sento il tuo messaggio! L'Assistente Domotico Gemini è pronto. (Nota: Imposta GEMINI_API_KEY nei secret per risposte AI in tempo reale). Puoi comunque gestire tutti i tuoi dispositivi e migrare i dispositivi Smart Life!",
      });
    }

    const systemInstruction = `
Sei l'Assistente AI per la domotica di "SmartLife Hub". 
Rispondi in italiano in modo amichevole, chiaro, conciso e pratico.
Il tuo compito è aiutare l'utente a:
1. Migrare e trasferire i dispositivi dall'app Smart Life / Tuya a questo nuovo SmartLife Hub (spiegando i metodi come Tuya Cloud API Key, backup JSON o pairing Wi-Fi/Zigbee).
2. Creare automazioni domotiche avanzate (es. routine di benvenuto, risparmio energetico, sicurezza notturna).
3. Risolvere problemi di connessione o configurazione dei dispositivi (prese, luci RGB, termostati, telecamere, serrature, aspirapolvere).
4. Suggerire ottimizzazioni dei consumi elettrici.

Contesto Dispositivi dell'utente:
${JSON.stringify(devices || [], null, 2)}

Automazioni Attive:
${JSON.stringify(automations || [], null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const replyText = response.text || "Purtroppo non sono riuscito a elaborare la risposta. Riprova tra poco!";
    res.json({ reply: replyText });
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res.status(500).json({
      error: "Errore durante la risposta dell'assistente AI",
      details: err?.message || String(err),
    });
  }
});

// ----------------------------------------------------
// VITE OR STATIC SERVER SETUP
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server domotica running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
