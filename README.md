# homebridge-dreame-vacuum

Homebridge plugin for **Dreame** robot vacuums (MIoT/miIO).  
Adds basic Apple HomeKit control:

- Start / Pause cleaning (mapped to *Fan* service)
- Adjust suction power (RotationSpeed)
- Send to dock (separate Switch)
- Battery level (BatteryService)
- Room cleaning (each room as a separate Switch)

> ⚠️ HomeKit does not have a native “Vacuum” service. For compatibility, power/suction are mapped to the **Fan** service — same approach as most existing vacuum plugins.

## Features (MVP)
- Local connection via **miIO/MIoT** (IP + token)
- Optional cloud connection via Mi Cloud (username/password)
- MIoT ID (SIID/PIID/AIID) mapping with override support via `miotOverrides`
- Room switches for quick segmented cleaning

## Supported models
Tested with Dreame series (e.g. L10 / D9 / P2xx).  
Since MIoT specs differ between models:
- Use `miotOverrides` to customize IDs for your model/firmware.
- Presets can be added in `src/miotMaps/...`.

## Installation
See [INSTALL.md](./INSTALL.md) for detailed instructions.  
Quick start:
```bash
npm i -g homebridge-dreame-vacuum     # after publishing to npm
# or for local dev:
npm i
npm run build
sudo npm link
cd /var/lib/homebridge && sudo npm link homebridge-dreame-vacuum