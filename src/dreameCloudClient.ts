import axios, { AxiosInstance } from 'axios';

type Country = 'de'|'us'|'sg'|'cn'|'ru'|'in';

export type DreameCloudOpts = {
  username: string;
  password: string;
  country: Country;
  userAgent?: string;
};

export type DeviceInfo = {
  did: string;
  name?: string;
  model?: string;
  localip?: string;
};

export class DreameCloudClient {
  private http!: AxiosInstance;
  private sid = '';        // bearer (session/service token)
  private region: Country;

  constructor(private opts: DreameCloudOpts) {
    this.region = opts.country;
  }

  private base(region: Country) {
    return `https://${region}.iot.dreame.tech:13267`;
  }

  private buildHttp(region: Country) {
    return axios.create({
      baseURL: this.base(region),
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.opts.userAgent ?? 'Dreamehome/1.0.0 (Homebridge)'
      },
      validateStatus: s => s >= 200 && s < 500,
    });
  }

  async login(): Promise<void> {
    const tryRegions: Country[] = [this.region, ...(this.region === 'cn' ? [] : ['cn'])];

    let lastErr: any;
    for (const r of tryRegions) {
      const http = this.buildHttp(r);
      try {
        const resp = await http.post('/dreame-auth/oauth/token', {
          account: this.opts.username,
          password: this.opts.password,
        });

        if (resp.status === 200 && resp.data?.access_token) {
          this.sid = resp.data.access_token;
          this.region = r;
          this.http = this.buildHttp(r);
          // навешиваем Authorization
          this.http.interceptors.request.use(cfg => {
            cfg.headers = cfg.headers || {};
            cfg.headers['Authorization'] = `Bearer ${this.sid}`;
            return cfg;
          });
          return;
        }

        // 401/403 — требует доп.проверку или неверные учётки
        if (resp.status === 401 || resp.status === 403) {
          throw new Error('Access denied: check credentials / 2FA challenge');
        }

        throw new Error(`Login failed (HTTP ${resp.status})`);
      } catch (e: any) {
        lastErr = e;
        continue;
      }
    }

    throw lastErr ?? new Error('Login failed in all regions tried');
  }

  async listDevices(): Promise<DeviceInfo[]> {
    const resp = await this.http.post('/dreame-user-iot/iotuserbind/device/listV2', {});
    if (resp.status !== 200 || !Array.isArray(resp.data?.list)) {
      throw new Error(`Failed to fetch devices (HTTP ${resp.status})`);
    }
    return resp.data.list.map((d: any) => ({
      did: d.did,
      name: d.name,
      model: d.model,
      localip: d.localip,
    }));
  }

  async sendCommand(did: string, method: string, params: any = {}): Promise<any> {
    const resp = await this.http.post('/dreame-iot-com-10000/device/sendCommand', {
      did, method, params,
    });
    if (resp.status !== 200) {
      throw new Error(`sendCommand failed (HTTP ${resp.status})`);
    }
    return resp.data;
  }

  async start(did: string) { return this.sendCommand(did, 'start_clean'); }
  async pause(did: string) { return this.sendCommand(did, 'pause'); }
  async dock(did: string)  { return this.sendCommand(did, 'return_dock'); }

  async setSuction(did: string, level: number) {
    const mode = level <= 25 ? 1 : level <= 50 ? 2 : level <= 75 ? 3 : 4; // quiet/standard/turbo/max
    return this.sendCommand(did, 'set_suction', { mode });
  }

  async cleanRoom(did: string, roomId: number) {
    return this.sendCommand(did, 'start_clean_rooms', {
      room_ids: [roomId],
      clean_order_mode: 0
    });
  }

  async status(did: string) {
    const resp = await this.sendCommand(did, 'get_status');
    return resp?.result ?? resp;
  }
}