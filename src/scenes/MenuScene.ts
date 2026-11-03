import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton } from '../ui/components';
import { audio } from '../systems/audio';
import { app } from '../core/app';
import { levelFromXp } from '../core/progression';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.input.on('pointerdown', () => void audio.unlock());
    audio.play('ui_click');
    addBackdrop(this);
    createHeader(this, {
      title: 'OPERATION: BLACKOUT',
      subtitle: 'TASK FORCE 09 · FIELD COMMAND',
      section: 'MAIN MENU',
    });
    audio.startMusic('menu');

    const buttons = [
      { label: 'CAMPAIGN', sub: '20-mission theatre', onClick: () => this.scene.start('CampaignScene') },
      { label: 'SURVIVAL', sub: 'Endless waves', onClick: () => this.scene.start('SurvivalScene', { mode: 'survival' }) },
      { label: 'TRAINING', sub: 'Weapon qualification', onClick: () => this.scene.start('TrainingScene') },
      { label: 'FREE PLAY', sub: 'Open sandbox', onClick: () => this.scene.start('FreePlayScene') },
      { label: 'LOADOUT', sub: 'Weapons & attachments & equipment', onClick: () => this.scene.start('LoadoutScene') },
      { label: 'ARMORY', sub: 'Buy weapons & attachments', onClick: () => this.scene.start('ArmoryScene') },
      { label: 'GARAGE', sub: 'Buy & select vehicles', onClick: () => this.scene.start('GarageScene') },
      { label: 'STATISTICS', sub: 'Career statistics', onClick: () => this.scene.start('StatsScene') },
      { label: 'SETTINGS', sub: 'Audio, video, controls', onClick: () => this.scene.start('SettingsScene') },
    ];
    buttons.forEach((b, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      new TacticalButton(this, 140 + col * 460, 210 + row * 110, 420, 84, b.label, {
        sublabel: b.sub,
        onClick: b.onClick,
      });
    });
    this.add
      .text(800, 620, `LEVEL ${levelFromXp(app.save.xp)} · CREDITS ${app.save.credits.toLocaleString()}`, {
        color: '#8a948c', fontSize: '13px', fontFamily: 'Consolas, monospace',
      })
      .setOrigin(0.5);
  }
}
