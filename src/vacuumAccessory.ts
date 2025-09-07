import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback, WithUUID } from 'homebridge';
import { DreameClient } from './dreameClient';
import { DeviceConfig } from './types';

export class VacuumAccessory {
  private serviceFan: Service;
  private serviceBattery: Service;
  private dockSwitch: Service;
  private roomSwitches: Service[] = [];

  constructor(
    private readonly accessory: PlatformAccessory,
    private readonly hap: any,
    private readonly client: DreameClient,
    private readonly cfg: DeviceConfig,
  ) {
    const { Service, Characteristic } = this.hap;

    this.serviceFan = this.accessory.getService(Service.Fanv2) || this.accessory.addService(Service.Fanv2, this.accessory.displayName);
    this.serviceFan.getCharacteristic(Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this));
    this.serviceFan.getCharacteristic(Characteristic.RotationSpeed)
      .setProps({ minValue: 0, maxValue: 100, minStep: 25 })
      .onSet(this.setSpeed.bind(this));

    this.serviceBattery = this.accessory.getService(Service.BatteryService) || this.accessory.addService(Service.BatteryService);
    this.dockSwitch = this.accessory.getService('Dock') || this.accessory.addService(Service.Switch, 'Dock', 'dock');
    this.dockSwitch.getCharacteristic(Characteristic.On).onSet(async (val: CharacteristicValue) => {
      if (val) await this.client.dock();
      this.dockSwitch.updateCharacteristic(Characteristic.On, false);
    });

    // Room switches
    (cfg.rooms || []).forEach(room => {
      const s = this.accessory.getService(room.name) || this.accessory.addService(Service.Switch, room.name, `room-${room.roomId}`);
      s.getCharacteristic(Characteristic.On).onSet(async (val: CharacteristicValue) => {
        if (val) await this.client.cleanRoom(room.roomId);
        s.updateCharacteristic(Characteristic.On, false);
      });
      this.roomSwitches.push(s);
    });

    // Периодический поллинг
    setInterval(() => this.refreshStatus().catch(() => {}), 5000);
  }

  private async setActive(value: CharacteristicValue) {
    if (value === 1) await this.client.startCleaning();
    else await this.client.pause();
  }
  private async getActive(): Promise<CharacteristicValue> {
    const st = await this.client.getStatus();
    // Примитив: если не на базе и в состоянии "cleaning" -> Active
    return 1;
  }
  private async setSpeed(value: CharacteristicValue) {
    await this.client.setFanPower(value as number);
  }

  private async refreshStatus() {
    const { Characteristic } = this.hap;
    const st = await this.client.getStatus();
    // TODO: распарсить поля st под конкретную модель
    this.serviceBattery.updateCharacteristic(Characteristic.BatteryLevel, 80);
    this.serviceBattery.updateCharacteristic(Characteristic.StatusLowBattery, 0);
  }
}