export interface DeviceConfig {
  name: string;
  ip?: string;
  token?: string;
  model?: string;
  useCloud?: boolean;
  miAccount?: { username?: string; password?: string; country?: string };
  rooms?: { name: string; roomId: number }[];
  miotOverrides?: Record<string, any>;
}
export interface PlatformConfig { devices: DeviceConfig[]; pollInterval?: number; }