import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { txt, mono } from '../ui/components';
import { audio } from '../systems/audio';
import { app } from '../core/app';
import { levelFromXp } from '../core/progression';
import { WEAPONS, WEAPON_MAP } from '../data/weapons';
import { ATTACHMENTS, compatibleAttachments } from '../data/attachments';
import { EQUIPMENT } from '../data/equipment';
import { VEHICLES } from '../data/vehicles';
import { MAX_ATTACHMENTS_PER_WEAPON } from '../core/progression';

export class LoadoutScene extends Phaser.Scene {
  private selectedSlot = 0;
  private slotWeaponIds = [app.save.loadout.primary, app.save.loadout.secondary, app.save.loadout.sidearm];

  constructor() {
    super('LoadoutScene');
  }

  create(): void {
    addBackdrop(this);
    createHeader(this, { title: 'LOADOUT', subtitle: 'CONFIGURE TASK FORCE KIT', section: 'ARSENAL', onBack: () => this.scene.start('MenuScene') });
    audio.startMusic('menu');

    const slots = ['PRIMARY', 'SECONDARY', 'SIDEARM'];
    slots.forEach((s, i) => {
      new TacticalButton(this, 80 + i * 200, 130, 180, 42, s, {
        variant: i === this.selectedSlot ? 'primary' : 'secondary',
        onClick: () => {
          this.selectedSlot = i;
          this.scene.restart();
        },
      });
    });

    const weaponId = this.getCurrentWeaponId();
    const weapon = WEAPON_MAP[weaponId] ?? WEAPONS[0];
    mono(this, 80, 200, `SELECTED WEAPON: ${weapon.name}`, 12, 0xc9b389);
    txt(this, 80, 230, weapon.description, 11, 0x8a948c, { wordWrapWidth: 700 });

    // Weapon picker for current slot role? Only show owned weapons matching role approximate; simplify all owned
    mono(this, 80, 300, 'OWNED WEAPONS (click to assign)', 11, 0x8a948c);
    let y = 330;
    for (const w of WEAPONS.filter((x) => app.save.unlockedWeapons.includes(x.id))) {
      new TacticalButton(this, 80, y, 360, 38, w.name, {
        variant: w.id === weaponId ? 'primary' : 'secondary',
        fontSize: 11,
        onClick: () => {
          const loadout = app.save.loadout;
          if (this.selectedSlot === 0) loadout.primary = w.id;
          else if (this.selectedSlot === 1) loadout.secondary = w.id;
          else loadout.sidearm = w.id;
          app.save.loadout = loadout;
          app.commit();
          this.scene.restart();
        },
      });
      y += 42;
      if (y > 520) break;
    }

    // Attachments
    mono(this, 640, 300, `ATTACHMENTS (MAX ${MAX_ATTACHMENTS_PER_WEAPON})`, 11, 0x8a948c);
    const equipped = app.save.loadout.attachments[weaponId] ?? [];
    let ay = 330;
    for (const a of compatibleAttachments(weapon.class).filter((x) => app.save.unlockedAttachments.includes(x.id))) {
      const isOn = equipped.includes(a.id);
      new TacticalButton(this, 640, ay, 400, 34, a.name, {
        variant: isOn ? 'primary' : 'secondary',
        fontSize: 10,
        sublabel: isOn ? 'EQUIPPED' : a.type.toUpperCase(),
        onClick: () => {
          const list = app.save.loadout.attachments[weaponId] ?? [];
          let next = list.includes(a.id) ? list.filter((id) => id !== a.id) : [...list, a.id];
          next = [...new Set(next)].slice(-MAX_ATTACHMENTS_PER_WEAPON);
          app.save.loadout.attachments[weaponId] = next;
          app.commit();
          this.scene.restart();
        },
      });
      ay += 38;
      if (ay > 700) break;
    }

    // Equipment selection
    mono(this, 1120, 130, 'EQUIPMENT (PICK 2)', 11, 0x8a948c);
    const eq = app.save.loadout.equipment;
    let ey = 160;
    for (const e of EQUIPMENT.filter((x) => app.save.unlockedEquipment.includes(x.id))) {
      const on = eq.includes(e.id);
      new TacticalButton(this, 1120, ey, 420, 36, e.name, {
        variant: on ? 'primary' : 'secondary',
        fontSize: 10,
        onClick: () => {
          const list = app.save.loadout.equipment;
          let next = list.includes(e.id) ? list.filter((x) => x !== e.id) : [...list, e.id];
          next = [...new Set(next)].slice(0, 2);
          app.save.loadout.equipment = next;
          app.commit();
          this.scene.restart();
        },
      });
      ey += 40;
    }

    // Vehicle selection
    mono(this, 1120, 470, 'VEHICLE', 11, 0x8a948c);
    let vy = 500;
    for (const v of VEHICLES.filter((x) => app.save.unlockedVehicles.includes(x.id))) {
      const on = app.save.loadout.vehicle === v.id;
      new TacticalButton(this, 1120, vy, 420, 36, v.name, {
        variant: on ? 'primary' : 'secondary',
        fontSize: 10,
        onClick: () => {
          app.save.loadout.vehicle = v.id;
          app.commit();
          this.scene.restart();
        },
      });
      vy += 40;
    }
  }

  private getCurrentWeaponId(): string {
    if (this.selectedSlot === 0) return app.save.loadout.primary;
    if (this.selectedSlot === 1) return app.save.loadout.secondary;
    return app.save.loadout.sidearm;
  }
}
