export type DeviceCategory = 
  | 'plug'
  | 'light'
  | 'thermostat'
  | 'camera'
  | 'lock'
  | 'sensor'
  | 'vacuum'
  | 'curtains'
  | 'switch'
  | 'gate'
  | 'pulsed_switch';

export type RoomName = 
  | 'Salotto'
  | 'Cucina'
  | 'Camera da Letto'
  | 'Bagno'
  | 'Giardino'
  | 'Garage'
  | 'Studio'
  | 'Ingresso'
  | (string & {});

export interface CustomRoomInfo {
  name: string;
  iconName?: string;
  color?: string;
  order?: number;
}

export interface RoomConfig {
  name: string;
  iconName?: string;
  customImageUrl?: string;
  wallpaperUrl?: string;
  color?: string;
  order?: number;
}

export type DeviceVendor = 'Smart Life (Tuya)' | 'Zigbee Gateway' | 'SmartLife Hub' | 'Local Wi-Fi';

export interface DevicePlugState {
  power: boolean;
  watts: number;
  voltage: number;
  current: number; // Amperes
  totalKwh: number;
  timerActive?: boolean;
  timerMinutesLeft?: number;
}

export interface DeviceLightState {
  power: boolean;
  brightness: number; // 0-100
  color: string; // HEX
  colorTemp: number; // 2700-6500 Kelvin
  mode: 'white' | 'color' | 'scene';
  sceneName?: string;
}

export interface DeviceThermostatState {
  power: boolean;
  currentTemp: number;
  targetTemp: number;
  humidity: number;
  mode: 'heat' | 'cool' | 'eco' | 'auto' | 'off';
  fanSpeed: 'low' | 'mid' | 'high' | 'auto';
}

export interface DeviceCameraState {
  power: boolean;
  motionDetected: boolean;
  recording: boolean;
  nightVision: boolean;
  streamUrl?: string;
  ptzAngleX: number;
  ptzAngleY: number;
}

export interface DeviceLockState {
  locked: boolean;
  doorClosed: boolean;
  battery: number;
  lastAccessUser?: string;
  lastAccessTime?: string;
}

export interface DeviceSensorState {
  triggered: boolean;
  sensorType: 'motion' | 'door' | 'water' | 'temp';
  temperature?: number;
  humidity?: number;
  battery: number;
  lastTriggerTime?: string;
}

export interface DeviceVacuumState {
  status: 'docked' | 'cleaning' | 'returning' | 'error';
  battery: number;
  suctionPower: 'eco' | 'standard' | 'strong';
  cleanedAreaSqm: number;
  cleaningTimeMinutes: number;
}

export interface DeviceCurtainsState {
  openPercent: number; // 0 (closed) to 100 (open)
}

export interface DeviceSwitchState {
  power: boolean;
  gangs: boolean[]; // Multi-switch gang state
  channelStates?: {
    switch_1?: boolean;
    switch_2?: boolean;
    switch_3?: boolean;
    switch_4?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface DeviceSchedule {
  id: string;
  deviceId: string;
  time: string; // "HH:MM" 24h format (e.g. "07:30")
  days: string[]; // ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
  action: boolean; // true = ON / Accendi, false = OFF / Spegni
  enabled: boolean; // true = active, false = paused
  channel?: string; // e.g. "switch_1", "switch_2", "switch_3", "switch_4" (for 4CH relay / irrigation)
  label?: string; // Optional user note or reminder
}

export interface SmartDevice {
  id: string;
  tuyaDeviceId?: string; // Original Smart Life / Tuya Device ID
  name: string;
  category: DeviceCategory;
  room: RoomName;
  vendor: DeviceVendor;
  isOnline: boolean;
  signalStrength: number; // -30 to -90 dBm
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion?: string;
  transferredFromSmartLife: boolean;
  transferredAt?: string;
  customIcon?: string;
  customImageUrl?: string;
  channel?: string | null; // Tuya switch channel (e.g. 'switch_1', 'switch_2', 'switch_3', 'switch_4')
  dpCode?: string | null;
  cardSpan?: 1 | 2; // 1 = Standard 1-col card, 2 = Wide full-row 2-col card
  forceOnline?: boolean; // Force keep device online in UI, ignoring sleepy battery/Zigbee status
  alwaysOnline?: boolean; // User preference override to prevent false offline reporting
  lastCommandAt?: number; // Timestamp of last successful command
  schedules?: DeviceSchedule[]; // Smart Life device timer / schedules list
  state: {
    plug?: DevicePlugState;
    light?: DeviceLightState;
    thermostat?: DeviceThermostatState;
    camera?: DeviceCameraState;
    lock?: DeviceLockState;
    sensor?: DeviceSensorState;
    vacuum?: DeviceVacuumState;
    curtains?: DeviceCurtainsState;
    switch?: DeviceSwitchState;
  };
}

export interface TuyaCloudCredentials {
  clientAccessId: string;
  clientSecret: string;
  region: 'eu' | 'us' | 'cn' | 'in';
  uidDeviceID?: string;
  userUid?: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  devices: SmartDevice[];
  source: 'tuya_cloud' | 'json_backup' | 'qr_code' | 'manual_pairing';
}

export interface AutomationRule {
  id: string;
  title: string;
  description: string;
  iconName: string;
  type: 'tap_to_run' | 'schedule' | 'device_condition' | 'weather';
  enabled: boolean;
  scheduleTime?: string; // e.g. "07:30"
  scheduleDays?: string[]; // e.g. ["Lun", "Mar", "Mer", "Gio", "Ven"]
  triggerCondition?: {
    deviceId: string;
    property: string;
    operator: '==' | '>' | '<';
    value: any;
  };
  actions: {
    deviceId: string;
    targetState: Record<string, any>;
    actionDescription: string;
  }[];
}

export interface EnergyDataPoint {
  time: string;
  watts: number;
  kwh: number;
  costEur: number;
  salottoW: number;
  cucinaW: number;
  studioW: number;
  altriW: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  suggestedAction?: {
    type: 'create_automation' | 'import_devices' | 'toggle_all_off' | 'optimize_eco';
    payload?: any;
  };
}

export function isCameraDevice(device?: SmartDevice | null): boolean {
  if (!device) return false;
  return Boolean(
    device.category === 'camera' ||
    device.customIcon === 'camera' ||
    (device.name || '').toLowerCase().includes('telecamera') ||
    (device.name || '').toLowerCase().includes('camera')
  );
}

export function isMultiButtonDevice(device?: SmartDevice | null): boolean {
  if (!device) return false;
  if (device.cardSpan === 1) return false;
  if (device.cardSpan === 2) return true;

  const name = (device.name || '').toLowerCase();
  const icon = (device.customIcon || '').toLowerCase();
  const cat = device.category;
  const switchState = device.state?.switch;

  // Gate / Cancellone / Impulse switches should NEVER be multi-button/wide by default
  if (
    cat === 'gate' ||
    cat === 'pulsed_switch' ||
    icon === 'gate' ||
    icon === 'pulsed_switch' ||
    name.includes('cancello') ||
    name.includes('cancellone') ||
    name.includes('cancelletto') ||
    name.includes('varco') ||
    name.includes('portoncino')
  ) {
    return false;
  }

  // Irrigation relays
  if (
    name.includes('irrigaz') ||
    name.includes('solenoide') ||
    icon === 'droplet' ||
    icon === 'irrigation'
  ) {
    return true;
  }

  // Multi-gang relay modules explicitly labeled 4CH or with 4+ channels
  if (
    name.includes('4ch') ||
    name.includes('4-channel') ||
    name.includes('4 canali') ||
    name.includes('multicanale')
  ) {
    return true;
  }

  if (cat === 'switch' && switchState?.gangs && switchState.gangs.length >= 4) {
    return true;
  }

  return false;
}

export function isWideDeviceCard(device?: SmartDevice | null): boolean {
  if (!device) return false;
  // If user explicitly chose cardSpan (1 or 2), respect user setting
  if (device.cardSpan === 1) return false;
  if (device.cardSpan === 2) return true;

  // Gate / Cancellone / standard switches are 1 column by default
  const name = (device.name || '').toLowerCase();
  if (
    name.includes('cancello') ||
    name.includes('cancellone') ||
    name.includes('cancelletto') ||
    device.category === 'gate' ||
    device.category === 'pulsed_switch'
  ) {
    return false;
  }

  return isCameraDevice(device) || isMultiButtonDevice(device);
}
