import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { txt, mono } from '../ui/components';
import { audio } from '../systems/audio';
import { app } from '../core/app';
import { MISSIONS, REGIONS } from '../data/missions';
import { isMissionUnlocked, missionRecord } from '../core/progression';
import { getMap } from '../data/maps';

export class CampaignScene extends Phaser.Scene {
  constructor() {
    super('CampaignScene');
  }

  create(): void {
    addBackdrop(this);
    createHeader(this, {
      title: 'CAMPAIGN',
      subtitle: '20 MISSIONS · 5 SECTORS',
      section: 'THEATRE SELECT',
      onBack: () => this.scene.start('MenuScene'),
    });
    audio.startMusic('menu');

    let y = 150;
    for (const region of REGIONS) {
      mono(this, 80, y, region.name, 12, region.accent);
      y += 24;
      const missions = MISSIONS.filter((m) => m.mapId === region.mapId);
      let col = 0;
      for (const m of missions) {
        const unlocked = isMissionUnlocked(app.save, m.id);
        const record = missionRecord(app.save, m.id);
        const label = `${m.id.toUpperCase()} · ${m.name}`;
        const sub = unlocked ? `LVL ${m.recommendedLevel} · ${record.completed ? record.stars + '★' : 'LOCKED REWARD'}` : 'LOCKED';
        const btn = new TacticalButton(this, 90 + col * 470, y, 440, 62, label, {
          sublabel: sub,
          disabled: !unlocked,
          onClick: () => this.scene.start('BriefingScene', { missionId: m.id }),
        });
        void btn;
        col += 1;
        if (col % 2 === 0) {
          col = 0;
          y += 72;
        }
      }
      if (col !== 0) y += 72;
      y += 10;
    }
    const mapInfo = getMap('blackwood');
    mono(this, 800, 860, mapInfo.description, 9, 0x8a948c, { origin: [0.5, 1] });
  }
}
