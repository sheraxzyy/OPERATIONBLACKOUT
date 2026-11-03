import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { audio } from '../systems/audio';

export class SurvivalScene extends Phaser.Scene {
  constructor() {
    super('SurvivalScene');
  }
  create(): void {
    addBackdrop(this);
    createHeader(this, { title: 'SURVIVAL', subtitle: 'ENDLESS REINFORCEMENTS', section: 'SURVIVAL', onBack: () => this.scene.start('MenuScene') });
    audio.startMusic('menu');
    this.add.text(80, 200, 'Survive endless waves. Every fallen enemy grows the threat.', { color: '#e6e1d3', fontSize: '14px', fontFamily: 'Segoe UI' });
    new TacticalButton(this, 80, 300, 260, 52, 'DEPLOY', {
      variant: 'primary',
      onClick: () => this.scene.start('GameScene', {
        config: {
          mode: 'survival',
          mapId: 'dead_district',
          difficulty: 'medium',
          seed: Date.now(),
          timeOfDay: 'night',
          weather: 'rain',
          enemyDensity: 1.2,
        },
      }),
    });
    new TacticalButton(this, 80, 370, 200, 48, 'BACK', { onClick: () => this.scene.start('MenuScene') });
  }
}
