import Hls from 'hls.js';

/**
 * Tuya WebRTC & Cloud Camera Configuration
 * Store and retrieve Client ID, Client Secret, Device ID, and Region
 * for Tuya WebRTC live video streaming.
 */

export interface TuyaCameraConfig {
  clientId: string;
  clientSecret: string;
  deviceId: string;
  region: 'eu' | 'us' | 'cn' | 'in';
  useWebRTC: boolean;
  streamUrl?: string;
}

export const DEFAULT_TUYA_CONFIG: TuyaCameraConfig = {
  clientId: '',
  clientSecret: '',
  deviceId: '',
  region: 'eu',
  useWebRTC: true,
  streamUrl: '',
};

const GLOBAL_STORAGE_KEY = 'tuya_camera_config';

/**
 * Retrieve saved Tuya camera configuration from LocalStorage (global or device-specific)
 */
export function getTuyaConfig(deviceId?: string): TuyaCameraConfig {
  try {
    const globalStored = localStorage.getItem(GLOBAL_STORAGE_KEY);
    const globalConfig = globalStored ? JSON.parse(globalStored) : {};

    if (deviceId) {
      const deviceStored = localStorage.getItem(`tuya_camera_config_${deviceId}`);
      if (deviceStored) {
        const deviceConfig = JSON.parse(deviceStored);
        return {
          ...DEFAULT_TUYA_CONFIG,
          ...globalConfig,
          ...deviceConfig,
          deviceId: deviceConfig.deviceId || deviceId,
        };
      }
      return {
        ...DEFAULT_TUYA_CONFIG,
        ...globalConfig,
        deviceId,
      };
    }
    return { ...DEFAULT_TUYA_CONFIG, ...globalConfig };
  } catch (e) {
    console.error('Error reading tuya_camera_config from localStorage:', e);
  }
  return DEFAULT_TUYA_CONFIG;
}

/**
 * Save Tuya camera configuration to LocalStorage (global and per-device)
 */
export function saveTuyaConfig(config: Partial<TuyaCameraConfig>, deviceId?: string): TuyaCameraConfig {
  try {
    const targetDeviceId = deviceId || config.deviceId;
    const currentGlobal = getTuyaConfig();
    const updatedGlobal = { ...currentGlobal, ...config };

    // Save global API credentials
    localStorage.setItem(
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
      localStorage.setItem(`tuya_camera_config_${targetDeviceId}`, JSON.stringify(updatedDevice));
      return updatedDevice;
    }

    return updatedGlobal;
  } catch (e) {
    console.error('Error saving tuya_camera_config to localStorage:', e);
    return DEFAULT_TUYA_CONFIG;
  }
}

/**
 * Request real Tuya WebRTC / RTSP live stream allocation using Tuya OpenAPI
 */
export async function requestTuyaWebRTCStream(config: TuyaCameraConfig): Promise<{ 
  success: boolean; 
  streamUrl?: string; 
  streamData?: any;
  tokenData?: any;
  message: string 
}> {
  if (!config.clientId || !config.clientSecret || !config.deviceId) {
    return {
      success: false,
      message: 'Inserisci Client ID, Client Secret e Device ID per avviare il flusso WebRTC reale.',
    };
  }

  try {
    const res = await fetch('/api/tuya-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientAccessId: config.clientId,
        clientSecret: config.clientSecret,
        deviceId: config.deviceId,
        region: config.region || 'eu',
        streamType: 'webrtc',
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
          message: data.message || 'Flusso WebRTC ottenuto con successo da Tuya Cloud!',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Errore nella richiesta del flusso Tuya WebRTC.',
        };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        message: errData.message || `Errore HTTP ${res.status} durante l'allocazione dello streaming Tuya.`,
      };
    }
  } catch (err: any) {
    console.warn('Backend WebRTC allocation endpoint unavailable:', err);
    return {
      success: false,
      message: `Errore di connessione a /api/tuya-stream: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Establish real WebRTC RTCPeerConnection or HLS live stream on an HTML5 <video id="tuya-video"> element.
 */
export async function startWebRTCStream(
  videoElement: HTMLVideoElement,
  streamResult: { success: boolean; streamUrl?: string; streamData?: any; tokenData?: any },
  deviceName: string = 'Telecamera'
): Promise<RTCPeerConnection | null> {
  if (!videoElement) return null;

  // Set mandatory id attribute
  videoElement.setAttribute('id', 'tuya-video');

  try {
    const streamData = streamResult.streamData || {};
    const streamUrl = streamResult.streamUrl || streamData.url || streamData.stream_url;

    // 1. If stream URL is an HLS (.m3u8 or live.tuya.com) stream, attach with hls.js or native HTML5 video
    if (
      streamUrl &&
      typeof streamUrl === 'string' &&
      (streamUrl.includes('.m3u8') || streamUrl.includes('hls') || streamUrl.includes('live.tuya.com'))
    ) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoElement.play().catch((e) => console.log('HLS autoplay warning:', e));
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = streamUrl;
        videoElement.play().catch((e) => console.log('Native HLS autoplay warning:', e));
      } else {
        videoElement.src = streamUrl;
        videoElement.play().catch((e) => console.log('Direct video playback warning:', e));
      }
      return null;
    }

    // 2. Direct HTTP / HTTPS MP4 or FLV stream playback
    if (
      streamUrl &&
      typeof streamUrl === 'string' &&
      (streamUrl.startsWith('http://') || streamUrl.startsWith('https://') || streamUrl.startsWith('blob:')) &&
      !streamUrl.includes('v=0')
    ) {
      videoElement.srcObject = null;
      videoElement.src = streamUrl;
      videoElement.play().catch((err) => console.log('Direct HTTP stream playback warning:', err));
      return null;
    }

    // 3. WebRTC RTCPeerConnection negotiation
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];
    if (streamData.iceServers && Array.isArray(streamData.iceServers)) {
      iceServers.push(...streamData.iceServers);
    }

    const pc = new RTCPeerConnection({ iceServers });

    // Handle incoming MediaStream tracks and assign directly to videoElement.srcObject
    pc.ontrack = (event) => {
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
      videoElement.play().catch((err) => console.log('WebRTC track autoplay warning:', err));
    };

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
    return null;
  }
}

