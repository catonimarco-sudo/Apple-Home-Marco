/**
 * Tuya WebRTC & Cloud Camera Configuration (JavaScript export)
 */

export const tuyaConfig = {
  clientId: '',
  clientSecret: '',
  deviceId: '',
  region: 'eu',
  useWebRTC: true,
  streamUrl: '',
};

export function getTuyaConfig() {
  try {
    const stored = localStorage.getItem('tuya_camera_config');
    if (stored) {
      return { ...tuyaConfig, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Error reading tuya_camera_config from localStorage:', e);
  }
  return tuyaConfig;
}

export function saveTuyaConfig(newConfig) {
  try {
    const current = getTuyaConfig();
    const updated = { ...current, ...newConfig };
    localStorage.setItem('tuya_camera_config', JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error saving tuya_camera_config to localStorage:', e);
    return tuyaConfig;
  }
}
