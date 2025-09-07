import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig as HbCfg, Service, Characteristic } from 'homebridge';
import { PlatformConfig, DeviceConfig } from './types';
import { DreameClient } from './dreameClient';
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
      const uuid = this.api.hap.uuid.generate(dev.name);
      let accessory = this.accessories.find(a => a.UUID === uuid);
      if (!accessory) {
        accessory = new this.api.platformAccessory(dev.name, uuid);
        this.api.registerPlatformAccessories('homebridge-dreame-vacuum', PLATFORM_NAME, [accessory]);
      }
      const client = new DreameClient(dev.model, {
        ip: dev.ip, token: dev.token,
        cloud: dev.useCloud ? dev.miAccount : undefined,
      });
      await client.connect();
      new VacuumAccessory(accessory, this.api.hap, client, dev);
    }
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.accessories.push(accessory);
  }
}