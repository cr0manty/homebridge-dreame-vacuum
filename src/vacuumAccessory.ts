import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DreameCloudClient, DeviceInfo } from './dreameCloudClient';
import { DeviceConfig } from './types';

export class VacuumAccessory {
  private serviceFan: Service;
  private serviceBattery: Service;
  private dockSwitch: Service;
  private roomSwitches: Service[] = [];
  private did = '';

  constructor(
    private readonly accessory: PlatformAccessory,
    private readonly hap: any,
    private readonly cloud: DreameCloudClient,
    private readonly cfg: DeviceConfig,
  ) {
    const { Service, Characteristic } = this.hap;

    this.serviceFan = this.accessory.getService(Service.Fanv2) || this.accessory.addService(Service.Fanv2, this.accessory.displayName);
    this.serviceFan.getCharacteristic(Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(async () => 0);
    this.serviceFan.getCharacteristic(Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 100, minStep: 25 })
      .onSet(this.setSpeed.bind(this));

    this.serviceBattery = this.accessory.getService(Service.BatteryService) || this.accessory.addService(Service.BatteryService);

    this.dockSwitch = this.accessory.getService('Dock') || this.accessory.addService(Service.Switch, 'Dock', 'dock');
    this.dockSwitch.getCharacteristic(Characteristic.On).onSet(async (val: CharacteristicValue) => {
      if (val) await this.cloud.dock(this.did).catch(()=>{});
      this.dockSwitch.updateCharacteristic(Characteristic.On, false);
    });

    (cfg.rooms || []).forEach(room => {
      const s = this.accessory.getService(room.name) || this.accessory.addService(Service.Switch, room.name, `room-${room.roomId}`);
      s.getCharacteristic(Characteristic.On).onSet(async (val: CharacteristicValue) => {
        if (val) await this.cloud.cleanRoom(this.did, room.roomId).catch(()=>{});
        s.updateCharacteristic(Characteristic.On, false);
      });
      this.roomSwitches.push(s);
    });

    setInterval(() => this.refreshStatus().catch(()=>{}), (cfg as any).pollInterval ?? 5000);
  }

  setDid(did: string) { this.did = did; }

  private async setActive(value: CharacteristicValue) {
    if (!this.did) return;
    if (value === 1) await this.cloud.start(this.did);
    else await this.cloud.pause(this.did);
  }

  private async setSpeed(value: CharacteristicValue) {
    if (!this.did) return;
    await this.cloud.setSuction(this.did, value as number);
  }

  private async refreshStatus() {
    if (!this.did) return;
    const st = await this.cloud.status(this.did).catch(()=>null);
    const { Characteristic } = this.hap;
    if (st?.battery != null) {
      this.serviceBattery.updateCharacteristic(Characteristic.BatteryLevel, st.battery);
      this.serviceBattery.updateCharacteristic(Characteristic.StatusLowBattery, st.battery < 20 ? 1 : 0);
    }
  }
}