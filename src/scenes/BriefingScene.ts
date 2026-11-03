import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { txt, mono } from '../ui/components';
import { audio } from '../systems/audio';
import { app } from '../core/app';
import { getMission } from '../data/missions';
import { getMap } from '../data/maps';
import { levelFromXp } from '../core/progression';

export class BriefingScene extends Phaser.Scene {
  private missionId = 'bw1';
  private difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  constructor() {
    super('BriefingScene');
  }

  init(data: { missionId?: string; difficulty?: 'easy' | 'medium' | 'hard' }): void {
    this.missionId = data.missionId ?? this.missionId;
    this.difficulty = data.difficulty ?? this.difficulty;
  }

  create(): void {
    const mission = getMission(this.missionId);
    const map = getMap(mission.mapId);
    addBackdrop(this);
    createHeader(this, {
      title: mission.name,
      subtitle: `${mission.codename} · ${map.name}`,
      section: 'BRIEFING',
      onBack: () => this.scene.start('CampaignScene'),
    });
    audio.startMusic('menu');

    mono(this, 80, 130, `RECOMMENDED LEVEL ${mission.recommendedLevel} · YOUR LEVEL ${levelFromXp(app.save.xp)}`, 11, 0x9fbfae);
    txt(this, 80, 170, mission.briefing, 13, 0xe6e1d3, { wordWrapWidth: 700, lineSpacing: 6 });
    mono(this, 80, 330, 'INTEL', 11, 0x8a948c);
    txt(this, 80, 355, mission.intel, 12, 0xc9b389, { wordWrapWidth: 700, lineSpacing: 5 });

    mono(this, 860, 130, 'OBJECTIVES', 11, 0x8a948c);
    let y = 160;
    for (const obj of mission.objectives) {
      txt(this, 860, y, `• ${obj.label}`, 12, 0xe6e1d3, { wordWrapWidth: 680 });
      y += 24;
    }
    mono(this, 860, y + 10, `ENEMIES ${mission.enemyCount} · ${mission.enemyMix.join(', ').toUpperCase()}`, 10, 0x8a948c);
    mono(this, 860, y + 32, `WEATHER ${mission.weather.toUpperCase()} · ${mission.timeOfDay.toUpperCase()}`, 10, 0x8a948c);

    mono(this, 80, 560, 'DIFFICULTY', 11, 0x8a948c);
    const diffs: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];
    diffs.forEach((d, i) => {
      new TacticalButton(this, 80 + i * 170, 590, 150, 42, d.toUpperCase(), {
        variant: d === this.difficulty ? 'primary' : 'secondary',
        onClick: () => {
          this.difficulty = d;
          this.scene.restart({ missionId: this.missionId, difficulty: d });
        },
      });
    });

    const startRun = () => {
      const config = {
        mode: 'campaign' as const,
        mapId: mission.mapId,
        missionId: mission.id,
        difficulty: this.difficulty,
        seed: Date.now(),
        timeOfDay: mission.timeOfDay,
        weather: mission.weather,
      };
      this.scene.start('GameScene', { config });
    };
    new TacticalButton(this, 80, 690, 260, 52, 'DEPLOY', { variant: 'primary', onClick: startRun });
    new TacticalButton(this, 360, 690, 200, 52, 'LOADOUT', { onClick: () => this.scene.start('LoadoutScene') });
  }
}
