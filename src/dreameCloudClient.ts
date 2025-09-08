import axios, { AxiosInstance } from 'axios';

type Country = 'de'|'us'|'sg'|'cn'|'ru'|'in';

export type DreameCloudOpts = {
  username: string;
  password: string;
  country: Country;
  appId?: string;        // некоторые API требуют appId/ua
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
  private sid = '';     // session id / service token (в терминах dreame/xiaomi)
  private ssecurity = '';
  private userId = '';
  private regionBase = '';

  constructor(private opts: DreameCloudOpts) {}

  private regionToBase(country: Country): string {
    // Базовые хосты для iot-шлюза Dreame; при необходимости поправим по логам.
    switch (country) {
      case 'de': return 'https://eu.dreame.cloud';
      case 'us': return 'https://us.dreame.cloud';
      case 'sg': return 'https://sg.dreame.cloud';
      case 'ru': return 'https://ru.dreame.cloud';
      case 'in': return 'https://in.dreame.cloud';
      case 'cn':
      default:   return 'https://cn.dreame.cloud';
    }
  }

  async login(): Promise<void> {
    this.regionBase = this.regionToBase(this.opts.country) || 'https://eu.dreame.cloud';

    this.http = axios.create({
      baseURL: this.regionBase,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.opts.userAgent ?? 'Dreamehome/1.0.0 (Homebridge)',
        'X-APP-ID': this.opts.appId ?? '1010'
      },
      validateStatus: s => s >= 200 && s < 500,
    });

    // 1) Инициируем логин (получаем nonce/вызов на 2й шаг)
    const step1 = await this.http.post('/iot/app/loginStep1', {
      account: this.opts.username,
    });
    if (step1.status !== 200 || !step1.data?.nonce) {
      throw new Error('Login step 1 failed');
    }

    // 2) Передаем пароль/nonce/подписи (на практике подписывается; тут — упрощённый вариант)
    const step2 = await this.http.post('/iot/app/loginStep2', {
      account: this.opts.username,
      password: this.opts.password,
      nonce: step1.data.nonce,
    });

    if (step2.status === 401) {
      throw new Error('Access denied: check credentials or 2FA challenge');
    }
    if (step2.status !== 200 || !step2.data?.sid) {
      throw new Error('Login step 2 failed');
    }

    this.sid = step2.data.sid;
    this.ssecurity = step2.data.ssecurity ?? '';
    this.userId = step2.data.userId ?? '';

    // Примонтируем авторизацию к всем дальнейшим запросам
    this.http.interceptors.request.use(cfg => {
      cfg.headers = cfg.headers || {};
      cfg.headers['Authorization'] = `Bearer ${this.sid}`;
      if (this.ssecurity) cfg.headers['X-SSecurity'] = this.ssecurity;
      return cfg;
    });
  }

  async listDevices(): Promise<DeviceInfo[]> {
    const resp = await this.http.post('/iotuserbind/device/listV2', { // список девайсов, привязанных к аккаунту
      uid: this.userId,
    });
    if (resp.status !== 200 || !Array.isArray(resp.data?.list)) {
      throw new Error('Failed to fetch devices');
    }
    return resp.data.list.map((d: any) => ({
      did: d.did,
      name: d.name,
      model: d.model,
      localip: d.localip,
    }));
  }

  // Универсальная отправка команды
  async sendCommand(did: string, method: string, params: any = {}): Promise<any> {
    const resp = await this.http.post('/device/sendCommand', {
      did,
      method,
      params,
    });
    if (resp.status !== 200) {
      throw new Error(`sendCommand failed: ${resp.status}`);
    }
    return resp.data;
  }

  // Упрощённые команды
  async start(did: string)   { return this.sendCommand(did, 'start_clean', {}); }
  async pause(did: string)   { return this.sendCommand(did, 'pause', {}); }
  async dock(did: string)    { return this.sendCommand(did, 'return_dock', {}); }

  async setSuction(did: string, level: number) {
    // Маппинг 0..100 -> режимы; подгоним по логам, если надо
    // 1-quiet, 2-standard, 3-turbo, 4-max (пример)
    const mode = level <= 25 ? 1 : level <= 50 ? 2 : level <= 75 ? 3 : 4;
    return this.sendCommand(did, 'set_suction', { mode });
  }

  async cleanRoom(did: string, roomId: number) {
    return this.sendCommand(did, 'start_clean_rooms', { room_ids: [roomId], clean_order_mode: 0 });
  }

  async status(did: string) {
    const resp = await this.http.post('/device/getStatus', { did });
    if (resp.status !== 200) throw new Error('status failed');
    return resp.data; // ожидаем поля battery, state, docked и т.п. — уточним по логам
  }
}