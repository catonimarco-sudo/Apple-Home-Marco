import Hls from 'hls.js';
import flvjs from 'flv.js';
import { safeStorage } from './utils/safeStorage';

/**
 * Tuya WebRTC, HLS & FLV Cloud Camera Configuration
 * Store and retrieve Client ID, Client Secret, Device ID, and Region
 * for live camera video streaming on PC, Web, and Samsung Family Hub.
 */

export interface TuyaCameraConfig {
  clientId: string;
  clientSecret: string;
  deviceId: string;
  region: 'eu' | 'us' | 'cn' | 'in';
  useWebRTC: boolean;
  streamUrl?: string;
  directStreamUrl?: string; // Direct RTSP/HLS/MJPEG/MP4 URL (bypasses Tuya Cloud quota)
}

export const DEFAULT_TUYA_CONFIG: TuyaCameraConfig = {
  clientId: '',
  clientSecret: '',
  deviceId: '',
  region: 'eu',
  useWebRTC: true,
  streamUrl: '',
  directStreamUrl: '',
};

const GLOBAL_STORAGE_KEY = 'tuya_camera_config';

/**
 * Retrieve saved Tuya camera configuration from safeStorage (global, main credentials, or device-specific)
 */
export function getTuyaConfig(deviceId?: string): TuyaCameraConfig {
  try {
    const globalStored = safeStorage.getItem(GLOBAL_STORAGE_KEY);
    const globalConfig = globalStored ? JSON.parse(globalStored) : {};

    // Also check primary Tuya credentials stored from sync
    let mainCredentials: any = {};
    const mainStored = safeStorage.getItem('tuya_credentials') || safeStorage.getItem('smartlife_hub_tuya_credentials');
    if (mainStored) {
      try {
        const parsed = JSON.parse(mainStored);
        mainCredentials = {
          clientId: parsed.clientAccessId || parsed.clientId || '',
          clientSecret: parsed.clientSecret || '',
          region: parsed.region || 'eu',
        };
      } catch {}
    }

    const mergedBase = {
      ...DEFAULT_TUYA_CONFIG,
      ...mainCredentials,
      ...globalConfig,
    };

    if (deviceId) {
      const deviceStored = safeStorage.getItem(`tuya_camera_config_${deviceId}`);
      if (deviceStored) {
        const deviceConfig = JSON.parse(deviceStored);
        return {
          ...mergedBase,
          ...deviceConfig,
          deviceId: deviceConfig.deviceId || deviceId,
        };
      }
      return {
        ...mergedBase,
        deviceId,
      };
    }
    return mergedBase;
  } catch (e) {
    console.error('Error reading tuya_camera_config from storage:', e);
  }
  return DEFAULT_TUYA_CONFIG;
}

/**
 * Save Tuya camera configuration to safeStorage (global and per-device)
 */
export function saveTuyaConfig(config: Partial<TuyaCameraConfig>, deviceId?: string): TuyaCameraConfig {
  try {
    const targetDeviceId = deviceId || config.deviceId;
    const currentGlobal = getTuyaConfig();
    const updatedGlobal = { ...currentGlobal, ...config };

    // Save global API credentials
    safeStorage.setItem(
      GLOBAL_STORAGE_KEY,
      JSON.stringify({
        clientId: updatedGlobal.clientId,
        clientSecret: updatedGlobal.clientSecret,
        region: updatedGlobal.region,
      })
    );

    // Save per-device configuration if targetDeviceId is specified
    if (targetDeviceId) {
      const currentDevice = getTuyaConfig(targetDeviceId);
      const updatedDevice = { ...currentDevice, ...config, deviceId: targetDeviceId };
      safeStorage.setItem(`tuya_camera_config_${targetDeviceId}`, JSON.stringify(updatedDevice));
      return updatedDevice;
    }

    return updatedGlobal;
  } catch (e) {
    console.error('Error saving tuya_camera_config to storage:', e);
    return DEFAULT_TUYA_CONFIG;
  }
}

export function resetTuyaConfig(deviceId?: string): TuyaCameraConfig {
  try {
    if (deviceId) {
      safeStorage.removeItem(`tuya_camera_config_${deviceId}`);
    }
  } catch (e) {
    console.error('Error resetting tuya camera config:', e);
  }
  return getTuyaConfig(deviceId);
}

export function resetAllCameraConfigs(): void {
  try {
    const keys = Object.keys(localStorage || {});
    for (const key of keys) {
      if (key.startsWith('tuya_camera_config_')) {
        safeStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error('Error resetting all camera configs:', e);
  }
}

/**
 * Request real Tuya WebRTC / HLS / FLV live stream allocation using Tuya OpenAPI
 * Automatically generates temporary stream links using /v1.0/devices/{device_id}/stream/allocate
 */
export async function requestTuyaStream(
  config: TuyaCameraConfig,
  streamType: 'webrtc' | 'hls' | 'flv' = 'webrtc'
): Promise<{
  success: boolean;
  streamUrl?: string;
  streamData?: any;
  tokenData?: any;
  code?: string;
  message: string;
}> {
  // If direct stream URL is specified as optional fallback, use it
  if (config.directStreamUrl && config.directStreamUrl.trim().length > 0) {
    return {
      success: true,
      streamUrl: config.directStreamUrl.trim(),
      message: 'Flusso video diretto (HLS / MJPEG / RTSP-Web) attivo!',
    };
  }

  if (!config.clientId || !config.clientSecret || !config.deviceId) {
    return {
      success: false,
      code: 'MISSING_CREDENTIALS',
      message: 'Inserisci Client ID, Client Secret e Device ID per avviare il flusso video Tuya automatico.',
    };
  }

  // 1. Primary request to /api/tuya-stream
  try {
    const res = await fetch('/api/tuya-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientAccessId: config.clientId,
        clientSecret: config.clientSecret,
        deviceId: config.deviceId,
        region: config.region || 'eu',
        streamType,
        audio: true,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        const url = data.streamUrl || data.streamData?.url || data.tuyaRawResponse?.result?.url || config.streamUrl;
        return {
          success: true,
          streamUrl: url,
          streamData: data.streamData || data.tuyaRawResponse,
          tokenData: data.tokenData,
          message: data.message || `Flusso ${streamType.toUpperCase()} generato automaticamente con successo da Tuya Cloud!`,
        };
      }

      // If WebRTC failed, try automatic fallback to HLS
      if (streamType === 'webrtc') {
        try {
          const fallbackRes = await fetch('/api/tuya-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientAccessId: config.clientId,
              clientSecret: config.clientSecret,
              deviceId: config.deviceId,
              region: config.region || 'eu',
              streamType: 'hls',
              audio: true,
            }),
          });
          if (fallbackRes.ok) {
            const fbData = await fallbackRes.json();
            if (fbData.success) {
              const url = fbData.streamUrl || fbData.streamData?.url || fbData.tuyaRawResponse?.result?.url;
              return {
                success: true,
                streamUrl: url,
                streamData: fbData.streamData || fbData.tuyaRawResponse,
                tokenData: fbData.tokenData,
                message: `Flusso HLS generato automaticamente da Tuya Cloud!`,
              };
            }
          }
        } catch {}
      }

      return {
        success: false,
        code: data.code || 'STREAM_ERROR',
        message: data.message || `Errore nella generazione automatica dello streaming Tuya.`,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        code: errData.code || 'HTTP_ERROR',
        message: errData.message || `Errore HTTP ${res.status} durante l'allocazione automatica dello streaming Tuya.`,
      };
    }
  } catch (err: any) {
    console.warn('Backend stream allocation endpoint error:', err);
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: `Errore di connessione a /api/tuya-stream: ${err?.message || String(err)}`,
    };
  }
}

// Alias for backward compatibility
export const requestTuyaWebRTCStream = requestTuyaStream;

// Global weakmap to track active Hls and Flv player instances attached to video elements
const activeHlsMap = new WeakMap<HTMLVideoElement, Hls>();
const activeFlvMap = new WeakMap<HTMLVideoElement, flvjs.Player>();

export function cleanupVideoMedia(videoElement: HTMLVideoElement) {
  if (!videoElement) return;

  // Cleanup HLS instance
  if (activeHlsMap.has(videoElement)) {
    try {
      const hls = activeHlsMap.get(videoElement);
      hls?.destroy();
    } catch {}
    activeHlsMap.delete(videoElement);
  }

  // Cleanup FLV instance
  if (activeFlvMap.has(videoElement)) {
    try {
      const flvPlayer = activeFlvMap.get(videoElement);
      flvPlayer?.unload();
      flvPlayer?.detachMediaElement();
      flvPlayer?.destroy();
    } catch {}
    activeFlvMap.delete(videoElement);
  }

  try {
    videoElement.pause();
    videoElement.srcObject = null;
    videoElement.removeAttribute('src');
    videoElement.load();
  } catch {}
}

/**
 * Attach and play an HLS stream onto a video element
 */
export function playHlsStream(videoElement: HTMLVideoElement, streamUrl: string): Hls | null {
  cleanupVideoMedia(videoElement);

  videoElement.muted = true;
  videoElement.defaultMuted = true;
  videoElement.setAttribute('playsinline', 'true');
  videoElement.setAttribute('autoplay', 'true');
  videoElement.setAttribute('muted', 'true');

  if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
    });
    hls.loadSource(streamUrl);
    hls.attachMedia(videoElement);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoElement.play().catch((e) => console.log('HLS autoplay muted notice:', e));
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      }
    });
    activeHlsMap.set(videoElement, hls);
    return hls;
  } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari / iOS WebKit native HLS support
    videoElement.src = streamUrl;
    videoElement.play().catch((e) => console.log('Native HLS autoplay notice:', e));
  } else {
    videoElement.src = streamUrl;
    videoElement.play().catch((e) => console.log('Direct video playback notice:', e));
  }
  return null;
}

/**
 * Attach and play an HTTP-FLV stream onto a video element using flv.js
 */
export function playFlvStream(videoElement: HTMLVideoElement, streamUrl: string): flvjs.Player | null {
  cleanupVideoMedia(videoElement);

  videoElement.muted = true;
  videoElement.defaultMuted = true;
  videoElement.setAttribute('playsinline', 'true');
  videoElement.setAttribute('autoplay', 'true');
  videoElement.setAttribute('muted', 'true');

  if (flvjs.isSupported()) {
    try {
      const flvPlayer = flvjs.createPlayer({
        type: 'flv',
        isLive: true,
        url: streamUrl,
        hasAudio: true,
        hasVideo: true,
      });
      flvPlayer.attachMediaElement(videoElement);
      flvPlayer.load();
      const playPromise = flvPlayer.play();
      if (playPromise && typeof (playPromise as Promise<void>).catch === 'function') {
        (playPromise as Promise<void>).catch((e) => console.log('FLV autoplay muted notice:', e));
      }
      activeFlvMap.set(videoElement, flvPlayer);
      return flvPlayer;
    } catch (err) {
      console.warn('flv.js initialization error:', err);
    }
  }
  return null;
}

/**
 * Establish real WebRTC RTCPeerConnection with STUN ICE Servers and automatic HLS/FLV fallback
 * on an HTML5 <video id="tuya-video"> element.
 */
export async function startWebRTCStream(
  videoElement: HTMLVideoElement,
  streamResult: { success: boolean; streamUrl?: string; streamData?: any; tokenData?: any; message?: string },
  deviceName: string = 'Telecamera',
  configFallback?: TuyaCameraConfig
): Promise<RTCPeerConnection | null> {
  if (!videoElement) return null;

  // Set mandatory attributes for Chrome/Edge PC and Tizen OS autoplay
  videoElement.setAttribute('id', 'tuya-video');
  videoElement.muted = true;
  videoElement.defaultMuted = true;
  videoElement.setAttribute('playsinline', 'true');
  videoElement.setAttribute('autoplay', 'true');
  videoElement.setAttribute('muted', 'true');

  try {
    const streamData = streamResult.streamData || {};
    const streamUrl = streamResult.streamUrl || streamData.url || streamData.stream_url;

    // 1. If stream URL is an HLS (.m3u8) stream, attach with hls.js or native HTML5 video
    if (
      streamUrl &&
      typeof streamUrl === 'string' &&
      (streamUrl.includes('.m3u8') || streamUrl.includes('hls') || streamUrl.includes('live.tuya.com'))
    ) {
      playHlsStream(videoElement, streamUrl);
      return null;
    }

    // 2. If stream URL is an FLV (.flv) stream, attach with flv.js
    if (
      streamUrl &&
      typeof streamUrl === 'string' &&
      streamUrl.includes('.flv')
    ) {
      playFlvStream(videoElement, streamUrl);
      return null;
    }

    // 3. Direct HTTP / HTTPS MP4 playback
    if (
      streamUrl &&
      typeof streamUrl === 'string' &&
      (streamUrl.startsWith('http://') || streamUrl.startsWith('https://') || streamUrl.startsWith('blob:')) &&
      !streamUrl.includes('v=0')
    ) {
      cleanupVideoMedia(videoElement);
      videoElement.src = streamUrl;
      videoElement.play().catch((err) => console.log('Direct HTTP stream playback notice:', err));
      return null;
    }

    // 4. WebRTC RTCPeerConnection negotiation with Google STUN ICE Servers
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ];
    if (streamData.iceServers && Array.isArray(streamData.iceServers)) {
      iceServers.push(...streamData.iceServers);
    }

    const pc = new RTCPeerConnection({ iceServers });

    let hasReceivedTrack = false;

    // Handle incoming MediaStream tracks and assign directly to videoElement.srcObject
    pc.ontrack = (event) => {
      hasReceivedTrack = true;
      let currentStream = videoElement.srcObject as MediaStream | null;
      if (event.streams && event.streams[0]) {
        videoElement.srcObject = event.streams[0];
      } else if (event.track) {
        if (!currentStream || !(currentStream instanceof MediaStream)) {
          currentStream = new MediaStream();
          videoElement.srcObject = currentStream;
        }
        currentStream.addTrack(event.track);
      }
      videoElement.play().catch((err) => console.log('WebRTC track autoplay notice:', err));
    };

    // Automatic fallback if WebRTC connection fails or gets disconnected
    const triggerHlsFallback = async () => {
      if (configFallback && configFallback.clientId && configFallback.clientSecret && configFallback.deviceId) {
        console.log(`[WebRTC Fallback] Activating HLS stream fallback for ${deviceName}...`);
        try {
          const hlsRes = await requestTuyaStream(configFallback, 'hls');
          if (hlsRes.success && hlsRes.streamUrl) {
            playHlsStream(videoElement, hlsRes.streamUrl);
          }
        } catch (fbErr) {
          console.warn('[WebRTC Fallback] HLS fallback failed:', fbErr);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`WebRTC connectionState: ${pc.connectionState} for ${deviceName}`);
        triggerHlsFallback();
      }
    };

    // Stall watchdog: If WebRTC does not produce frames within 4 seconds, fallback to HLS
    setTimeout(() => {
      if (!hasReceivedTrack || videoElement.readyState < 2 || videoElement.currentTime === 0) {
        if (configFallback && !videoElement.paused && videoElement.currentTime === 0) {
          triggerHlsFallback();
        }
      }
    }, 4500);

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    const sdpOffer =
      streamData.offer ||
      streamData.sdp ||
      (typeof streamUrl === 'string' && streamUrl.includes('v=0') ? streamUrl : null);

    if (sdpOffer) {
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: 'offer',
          sdp: sdpOffer,
        })
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
    } else {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
    }

    return pc;
  } catch (err) {
    console.error('Error in startWebRTCStream:', err);
    if (configFallback) {
      try {
        const hlsRes = await requestTuyaStream(configFallback, 'hls');
        if (hlsRes.success && hlsRes.streamUrl) {
          playHlsStream(videoElement, hlsRes.streamUrl);
        }
      } catch {}
    }
    return null;
  }
}


