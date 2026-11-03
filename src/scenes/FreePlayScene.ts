import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { audio } from '../systems/audio';
import { DIFFICULTIES } from '../data/enemies';
import { getMap } from '../data/maps';
import { REGIONS } from '../data/missions';

export class FreePlayScene extends Phaser.Scene {
  private mapId = 'blackwood';
  private difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  constructor() {
    super('FreePlayScene');
  }

  create(): void {
    addBackdrop(this);
    createHeader(this, {
      title: 'FREE PLAY',
      subtitle: 'OPEN THEATRE',
      section: 'SANDBOX',
      onBack: () => this.scene.start('MenuScene'),
    });
    audio.startMusic('menu');

    monoText(this, 'Select map:', 80, 160);
    REGIONS.forEach((r, i) => {
      new TacticalButton(this, 80 + i * 175, 200, 160, 44, r.code, {
        onClick: () => {
          this.mapId = r.mapId as typeof this.mapId;
          this.scene.restart({ mapId: this.mapId, difficulty: this.difficulty });
        },
      });
    });

    monoText(this, 'Difficulty:', 80, 300);
    (['easy', 'medium', 'hard'] as const).forEach((d, i) => {
      new TacticalButton(this, 80 + i * 175, 340, 160, 44, d.toUpperCase(), {
        variant: d === this.difficulty ? 'primary' : 'secondary',
        onClick: () => {
          this.difficulty = d;
          this.scene.restart({ mapId: this.mapId, difficulty: d });
        },
      });
    });

    // import mono dynamically? Use helper below not available. Instead use this.add.text
    new TacticalButton(this, 80, 460, 260, 52, 'DEPLOY', {
      variant: 'primary',
      onClick: () => {
        const map = getMap(this.mapId as never);
        void map;
        this.scene.start('GameScene', {
          config: {
            mode: 'freeplay',
            mapId: this.mapId,
            difficulty: this.difficulty,
            seed: Date.now(),
            timeOfDay: (map.recommendedTime as never) ?? 'day',
            weather: 'clear',
            enemyDensity: 1,
          },
        });
      },
    });
  }
  init(data: { mapId?: string; difficulty?: 'easy' | 'medium' | 'hard' }): void {
    this.mapId = data.mapId ?? this.mapId;
    this.difficulty = data.difficulty ?? this.difficulty;
  }
}

function monoText(scene: Phaser.Scene, text: string, x: number, y: number): void {
  scene.add.text(x, y, text, { color: '#8a948c', fontSize: '12px', fontFamily: 'Consolas, monospace' });
}
