import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { txt, mono } from '../ui/components';
import { audio } from '../systems/audio';
import { app } from '../core/app';
import { WEAPONS } from '../data/weapons';
import { ATTACHMENTS } from '../data/attachments';
import { EQUIPMENT } from '../data/equipment';
import { VEHICLES } from '../data/vehicles';
import { levelFromXp } from '../core/progression';
import {
  canBuyWeapon, canBuyAttachment, canBuyEquipment, canBuyVehicle,
  purchaseWeapon, purchaseAttachment, purchaseEquipment, purchaseVehicle,
} from '../core/progression';

export class ArmoryScene extends Phaser.Scene {
  private tab = 0;
  constructor() {
    super('ArmoryScene');
  }
  init(data: { tab?: number }): void {
    this.tab = data.tab ?? this.tab;
  }
  create(): void {
    addBackdrop(this);
    createHeader(this, { title: 'ARMORY', subtitle: 'PROCURE WEAPONS & GEAR', section: 'STORE', onBack: () => this.scene.start('MenuScene') });
    audio.startMusic('menu');
    const tabs = ['WEAPONS', 'ATTACHMENTS', 'EQUIPMENT', 'VEHICLES'];
    tabs.forEach((t, i) => {
      new TacticalButton(this, 80 + i * 190, 120, 180, 40, t, {
        variant: i === this.tab ? 'primary' : 'secondary',
        fontSize: 11,
        onClick: () => this.scene.restart({ tab: i }),
      });
    });
    mono(this, 1520, 120, `CREDITS ${app.save.credits.toLocaleString()} · LVL ${levelFromXp(app.save.xp)}`, 11, 0xc9b389, { origin: [1, 0] });

    const y0 = 180;
    if (this.tab === 0) {
      let y = y0;
      for (const w of WEAPONS) {
        const owned = app.save.unlockedWeapons.includes(w.id);
        const check = owned ? { ok: false, reason: 'OWNED' } : canBuyWeapon(app.save, w.id);
        new TacticalButton(this, 80, y, 700, 52, `${w.name}  ·  ${w.price.toLocaleString()} CR`, {
          variant: owned ? 'secondary' : check.ok ? 'primary' : 'ghost',
          sublabel: owned ? 'OWNED' : check.reason || `LVL ${w.levelReq}`,
          disabled: owned || !check.ok,
          fontSize: 11,
          onClick: () => {
            if (purchaseWeapon(app.save, w.id)) { app.commit(); this.scene.restart({ tab: this.tab }); }
          },
        });
        y += 60;
      }
    } else if (this.tab === 1) {
      let y = y0;
      for (const a of ATTACHMENTS) {
        const owned = app.save.unlockedAttachments.includes(a.id);
        const check = owned ? { ok: false, reason: 'OWNED' } : canBuyAttachment(app.save, a.id);
        new TacticalButton(this, 80, y, 700, 52, `${a.name}  ·  ${a.price.toLocaleString()} CR`, {
          variant: owned ? 'secondary' : check.ok ? 'primary' : 'ghost',
          sublabel: owned ? 'OWNED' : check.reason || a.type.toUpperCase(),
          disabled: owned || !check.ok,
          fontSize: 11,
          onClick: () => {
            if (purchaseAttachment(app.save, a.id)) { app.commit(); this.scene.restart({ tab: this.tab }); }
          },
        });
        y += 60;
      }
    } else if (this.tab === 2) {
      let y = y0;
      for (const e of EQUIPMENT) {
        const owned = app.save.unlockedEquipment.includes(e.id);
        const check = owned ? { ok: false, reason: 'OWNED' } : canBuyEquipment(app.save, e.id);
        new TacticalButton(this, 80, y, 700, 52, `${e.name}  ·  ${e.price.toLocaleString()} CR`, {
          variant: owned ? 'secondary' : check.ok ? 'primary' : 'ghost',
          sublabel: owned ? 'OWNED' : check.reason || e.slot.toUpperCase(),
          disabled: owned || !check.ok,
          fontSize: 11,
          onClick: () => {
            if (purchaseEquipment(app.save, e.id)) { app.commit(); this.scene.restart({ tab: this.tab }); }
          },
        });
        y += 60;
      }
    } else {
      let y = y0;
      for (const v of VEHICLES) {
        const owned = app.save.unlockedVehicles.includes(v.id);
        const check = owned ? { ok: false, reason: 'OWNED' } : canBuyVehicle(app.save, v.id);
        new TacticalButton(this, 80, y, 700, 52, `${v.name}  ·  ${v.price.toLocaleString()} CR`, {
          variant: owned ? 'secondary' : check.ok ? 'primary' : 'ghost',
          sublabel: owned ? 'OWNED' : check.reason || v.role,
          disabled: owned || !check.ok,
          fontSize: 11,
          onClick: () => {
            if (purchaseVehicle(app.save, v.id)) { app.commit(); this.scene.restart({ tab: this.tab }); }
          },
        });
        y += 60;
      }
    }
  }
}
