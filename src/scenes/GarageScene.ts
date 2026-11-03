import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { mono } from '../ui/components';
import { audio } from '../systems/audio';
import { app } from '../core/app';
import { VEHICLES } from '../data/vehicles';

export class GarageScene extends Phaser.Scene {
  constructor() {
    super('GarageScene');
  }
  create(): void {
    addBackdrop(this);
    createHeader(this, { title: 'GARAGE', subtitle: 'VEHICLE MOTOR POOL', section: 'GARAGE', onBack: () => this.scene.start('MenuScene') });
    audio.startMusic('menu');
    const owned = VEHICLES.filter((v) => app.save.unlockedVehicles.includes(v.id));
    let y = 160;
    for (const v of owned) {
      const selected = app.save.loadout.vehicle === v.id;
      mono(this, 80, y, v.name, 12, 0xc9b389);
      mono(this, 80, y + 22, `${v.role} · HP ${v.health} · ${v.weapon.toUpperCase()}`, 10, 0x8a948c);
      new TacticalButton(this, 500, y, 180, 42, selected ? 'SELECTED' : 'SELECT', {
        variant: selected ? 'primary' : 'secondary',
        onClick: () => {
          app.save.loadout.vehicle = v.id;
          app.commit();
          this.scene.restart();
        },
      });
      y += 80;
    }
    new TacticalButton(this, 80, y + 20, 200, 48, 'ARMORY', { onClick: () => this.scene.start('ArmoryScene', { tab: 3 }) });
  }
}
