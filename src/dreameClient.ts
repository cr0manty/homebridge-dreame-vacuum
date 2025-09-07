import { EventEmitter } from 'events';
import mihome = require('node-mihome');

type MiotCall = { siid: number; aiid?: number; piid?: number; value?: any };

export class DreameClient extends EventEmitter {
  private device: any;
  constructor(
    private model: string | undefined,
    private options: {
      ip?: string; token?: string;
      cloud?: { username?: string; password?: string; country?: string };
    }
  ) { super(); }

  async connect() {
    if (this.options.ip && this.options.token) {
      mihome.miioProtocol.init();
      this.device = await mihome.device({ address: this.options.ip, token: this.options.token });
    } else if (this.options.cloud?.username && this.options.cloud?.password) {
      await mihome.miCloudProtocol.login(this.options.cloud.username, this.options.cloud.password);
      if (this.options.cloud.country) mihome.miCloudProtocol.setCountry(this.options.cloud.country);
      const dev = (await mihome.miCloudProtocol.getDevices(undefined, this.model))[0];
      if (!dev) throw new Error('Device not found in cloud');
      this.device = await mihome.device({ id: dev.did, model: dev.model, address: dev.localip, token: dev.token });
    } else {
      throw new Error('No connection method provided');
    }
  }

  // Пример: действия
  async startCleaning() { return this.callAction({ siid: 2, aiid: 1 }); }       // пример, будет переопределяться
  async pause()         { return this.callAction({ siid: 2, aiid: 2 }); }
  async dock()          { return this.callAction({ siid: 3, aiid: 1 }); }
  async setFanPower(pct: number) { /* map 0..100 -> enum/int; будет подменяться по модели */
    return this.setProperty({ siid: 18, piid: 1, value: this.mapFan(pct) });
  }
  async cleanRoom(roomId: number) {
    // для многих dreame — action с json параметром { "room_ids": [id], "clean_order_mode": 0, ... }
    return this.callAction({ siid: 24, aiid: 1, value: { "room_ids": [roomId], "clean_order_mode": 0 }});
  }

  async getStatus() {
    // примеры свойств: батарея, состояние, док
    const props = [
      { siid: 3,  piid: 1 }, // docked?
      { siid: 2,  piid: 1 }, // state
      { siid: 3,  piid: 2 }, // error?
      { siid: 4,  piid: 1 }  // battery level
    ];
    return this.getProperties(props);
  }

  // Низкоуровневые вызовы:
  async callAction(call: MiotCall) { return this.device.call('action', [call]); }
  async setProperty(call: MiotCall) { return this.device.call('set_properties', [[call]]); }
  async getProperties(props: { siid: number; piid: number }[]) {
    return this.device.call('get_properties', props.map(p => ({ ...p, did: this.device.id })));
  }

  private mapFan(pct: number) {
    // Грубое соответствие: 0 off, 25 quiet, 50 standard, 75 turbo, 100 max
    if (pct <= 10) return 0;
    if (pct <= 35) return 1;
    if (pct <= 60) return 2;
    if (pct <= 85) return 3;
    return 4;
  }
}