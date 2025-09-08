import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig as HbCfg } from 'homebridge';
import { DeviceConfig, PlatformConfig } from './types';
import { DreameCloudClient } from './dreameCloudClient';
import { VacuumAccessory } from './vacuumAccessory';

const PLATFORM_NAME = 'DreameVacuum';

export = (api: API) => api.registerPlatform(PLATFORM_NAME, DreamePlatform);

class DreamePlatform implements DynamicPlatformPlugin {
  public readonly accessories: PlatformAccessory[] = [];
  constructor(
    public readonly log: Logger,
    public readonly config: HbCfg & PlatformConfig,
    public readonly api: API,
  ) {
    this.api.on('didFinishLaunching', () => this.init().catch(e => this.log.error(String(e))));
  }

  async init() {
    const devices = this.config.devices || [];
    for (const dev of devices) {
      if (dev.driver !== 'dreame-cloud' || !dev.cloud) continue;

      const uuid = this.api.hap.uuid.generate(dev.name);
      let accessory = this.accessories.find(a => a.UUID === uuid);
      if (!accessory) {
        accessory = new this.api.platformAccessory(dev.name, uuid);
        this.api.registerPlatformAccessories('homebridge-dreame-vacuum', PLATFORM_NAME, [accessory]);
      }

      // Логин в облако
      const cloud = new DreameCloudClient({
        username: dev.cloud.username!,
        password: dev.cloud.password!,
        country: (dev.cloud.country || 'de') as any,
        userAgent: dev.cloud.userAgent,
      });
      await cloud.login();

      // Получаем список устройств и выбираем первый Dreame-пылесос (или по имени)
      const list = await cloud.listDevices();
      const found = list.find(d => /dreame\.vacuum/i.test(d.model || '') ) || list[0];
      if (!found) throw new Error('No Dreame devices found in this account/region');

      const vac = new VacuumAccessory(accessory!, this.api.hap, cloud, dev);
      vac.setDid(found.did);
    }
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.accessories.push(accessory);
  }
}