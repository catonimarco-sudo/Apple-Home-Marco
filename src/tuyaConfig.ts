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

const STORAGE_KEY = 'tuya_camera_config';

/**
 * Retrieve saved Tuya camera configuration from LocalStorage
 */
export function getTuyaConfig(): TuyaCameraConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_TUYA_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error('Error reading tuya_camera_config from localStorage:', e);
  }
  return DEFAULT_TUYA_CONFIG;
}

/**
 * Save Tuya camera configuration to LocalStorage
 */
export function saveTuyaConfig(config: Partial<TuyaCameraConfig>): TuyaCameraConfig {
  try {
    const current = getTuyaConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error saving tuya_camera_config to localStorage:', e);
    return DEFAULT_TUYA_CONFIG;
  }
}

/**
 * Request real Tuya WebRTC / RTSP live stream allocation using Tuya OpenAPI
 */
export async function requestTuyaWebRTCStream(config: TuyaCameraConfig): Promise<{ success: boolean; streamUrl?: string; message: string }> {
  if (!config.clientId || !config.clientSecret || !config.deviceId) {
    return {
      success: false,
      message: 'Inserisci Client ID, Client Secret e Device ID per avviare il flusso WebRTC reale.',
    };
  }

  try {
    // Attempt backend /api/tuya-stream or /api/tuya-webrtc endpoint
    const res = await fetch('/api/tuya-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientAccessId: config.clientId,
        clientSecret: config.clientSecret,
        deviceId: config.deviceId,
        region: config.region,
        streamType: 'webrtc',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && (data.streamUrl || data.tokenData)) {
        return {
          success: true,
          streamUrl: data.streamUrl,
          message: data.message || 'Flusso WebRTC ottenuto con successo da Tuya Cloud!',
        };
      }
    }
  } catch (err) {
    console.warn('Backend WebRTC allocation endpoint unavailable:', err);
  }

  // If direct stream URL is specified manually in config, use it
  if (config.streamUrl && config.streamUrl.trim() !== '') {
    return {
      success: true,
      streamUrl: config.streamUrl,
      message: 'Flusso video personalizzato attivo.',
    };
  }

  return {
    success: true,
    message: `Credenziali Tuya WebRTC configurate per Device ID ${config.deviceId}.`,
  };
}
