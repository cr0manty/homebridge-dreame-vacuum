export interface DeviceConfig {
  name: string;
  driver: 'dreame-cloud';
  cloud: { username: string; password: string; country: 'de'|'us'|'sg'|'cn'|'ru'|'in'; appId?: string; userAgent?: string; };
  rooms?: { name: string; roomId: number }[];
}
export interface PlatformConfig { devices: DeviceConfig[]; pollInterval?: number; }