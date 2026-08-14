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
