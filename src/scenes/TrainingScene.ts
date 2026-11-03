import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { audio } from '../systems/audio';

export class TrainingScene extends Phaser.Scene {
  constructor() {
    super('TrainingScene');
  }
  create(): void {
    addBackdrop(this);
    createHeader(this, { title: 'TRAINING', subtitle: 'WEAPON QUALIFICATION RANGE', section: 'TRAINING', onBack: () => this.scene.start('MenuScene') });
    audio.startMusic('menu');
    this.add.text(80, 200, 'Eliminate training targets for 60 seconds to qualify.', { color: '#e6e1d3', fontSize: '14px', fontFamily: 'Segoe UI' });
    new TacticalButton(this, 80, 300, 260, 52, 'START QUALIFICATION', {
      variant: 'primary',
      onClick: () => this.scene.start('GameScene', {
        config: {
          mode: 'training',
          mapId: 'iron_fortress',
          difficulty: 'easy',
          seed: Date.now(),
          timeOfDay: 'day',
          weather: 'clear',
          trainingType: 'shooting',
        },
      }),
    });
    new TacticalButton(this, 80, 370, 200, 48, 'BACK', { onClick: () => this.scene.start('MenuScene') });
  }
}
