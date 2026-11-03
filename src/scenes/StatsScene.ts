import Phaser from 'phaser';
import { addBackdrop, createHeader } from '../ui/components';
import { txt, mono } from '../ui/components';
import { audio } from '../systems/audio';
import { app } from '../core/app';
import { levelFromXp, xpProgress } from '../core/progression';

export class StatsScene extends Phaser.Scene {
  constructor() {
    super('StatsScene');
  }
  create(): void {
    addBackdrop(this);
    createHeader(this, { title: 'STATISTICS', subtitle: 'CAREER DOSSIER', section: 'RECORD', onBack: () => this.scene.start('MenuScene') });
    audio.startMusic('menu');
    const s = app.save.stats;
    const rows = Object.entries(s).map(([k, v]) => [k, typeof v === 'number' ? v.toLocaleString() : String(v)]);
    let y = 160;
    for (const [k, v] of rows) {
      mono(this, 120, y, k.toUpperCase(), 11, 0x8a948c);
      mono(this, 620, y, v, 11, 0xc9b389, { origin: [1, 0] });
      y += 24;
    }
    const xp = xpProgress(app.save.xp);
    mono(this, 760, 160, `LEVEL ${levelFromXp(app.save.xp)}`, 13, 0xc9b389);
    mono(this, 760, 190, `XP ${xp.current} / ${xp.needed}`, 11, 0x8a948c);
    mono(this, 760, 240, `CREDITS ${app.save.credits.toLocaleString()}`, 11, 0xc9b389);
    mono(this, 760, 270, `MISSIONS COMPLETE ${s.missionsCompleted}`, 11, 0x8a948c);
    mono(this, 760, 300, `SECTOR BONUSES ${app.save.sectorBonuses.length}/5`, 11, 0x8a948c);
  }
}
