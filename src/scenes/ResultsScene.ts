import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { txt, mono } from '../ui/components';
import { audio } from '../systems/audio';
import { app } from '../core/app';
import type { RunResult } from '../core/types';
import { levelFromXp, nextMissionId } from '../core/progression';

export class ResultsScene extends Phaser.Scene {
  private result!: RunResult;

  constructor() {
    super('ResultsScene');
  }

  init(data: { result: RunResult }): void {
    this.result = data.result;
  }

  create(): void {
    addBackdrop(this);
    createHeader(this, {
      title: this.result.success ? 'MISSION COMPLETE' : 'MISSION FAILED',
      subtitle: `${this.result.mode.toUpperCase()} · ${this.result.mapId.toUpperCase()}`,
      section: 'AAR',
    });
    audio.stopMusic();
    if (this.result.success) audio.startMusic('results');
    audio.play(this.result.success ? 'success' : 'fail');

    const r = this.result;
    const rows = [
      ['OUTCOME', r.success ? 'SUCCESS' : 'FAILED'],
      ['KILLS', r.kills.toString()],
      ['ELITE KILLS', r.eliteKills.toString()],
      ['TIME', `${Math.floor(r.timeSeconds / 60).toString().padStart(2, '0')}:${(r.timeSeconds % 60).toString().padStart(2, '0')}`],
      ['SHOTS', `${r.shotsHit} / ${r.shotsFired}`],
      ['VEHICLES DESTROYED', r.vehiclesDestroyed.toString()],
      ['RESCUED', r.rescued.toString()],
      ['INTEL', r.intelRecovered.toString()],
      ['CREDITS', `+${r.creditsEarned.toLocaleString()}`],
      ['XP', `+${r.xpEarned.toLocaleString()}`],
    ];
    let y = 160;
    for (const [k, v] of rows) {
      mono(this, 520, y, k, 11, 0x8a948c);
      mono(this, 1100, y, v, 11, 0xc9b389, { origin: [1, 0] });
      y += 26;
    }
    if (r.objectives.length) {
      mono(this, 520, y + 10, 'OBJECTIVES', 11, 0x8a948c);
      y += 28;
      for (const o of r.objectives) {
        txt(this, 520, y, `${o.complete ? '✓' : '✗'} ${o.label}`, 12, o.complete ? 0x7fd8b2 : 0xd06a52);
        y += 20;
      }
    }
    if (r.stars > 0) {
      txt(this, 800, 640, `${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}`, 30, 0xe0a64b, { origin: [0.5, 0.5] });
    }
    if (r.newUnlocks.length) {
      mono(this, 800, 690, r.newUnlocks.join('  ·  '), 10, 0x7fd8b2, { origin: [0.5, 0.5] });
    }
    new TacticalButton(this, 560, 760, 220, 48, 'RETURN TO MENU', { onClick: () => this.scene.start('MenuScene') });
    if (r.missionId) {
      new TacticalButton(this, 820, 760, 220, 48, 'REPLAY', { variant: 'secondary', onClick: () => {
        this.scene.start('BriefingScene', { missionId: r.missionId });
      } });
      new TacticalButton(this, 1080, 760, 260, 48, 'NEXT MISSION', { variant: 'primary', onClick: () => {
        const next = nextMissionId(r.missionId!);
        if (next) this.scene.start('BriefingScene', { missionId: next });
        else this.scene.start('CampaignScene');
      } });
    }
    const lvl = levelFromXp(app.save.xp);
    mono(this, 800, 720, `LEVEL ${lvl} · ${app.save.credits.toLocaleString()} CR`, 10, 0x8a948c, { origin: [0.5, 0.5] });
  }
}
