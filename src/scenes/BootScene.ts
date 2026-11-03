import Phaser from 'phaser';
import { generateAllTextures } from '../art/textures';
import { app } from '../core/app';
import { audio } from '../systems/audio';
import { MenuScene } from './MenuScene';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  async create(): Promise<void> {
    const status = document.getElementById('boot-status');
    if (status) status.textContent = 'SYNCING SAVE DATA';
    await app.init();
    audio.setVolumes(app.settings.masterVolume, app.settings.musicVolume, app.settings.sfxVolume);
    const boot = document.getElementById('boot-screen');
    if (boot) boot.classList.add('hidden');
    if (status) status.textContent = 'GENERATING FIELD ASSETS';
    // Allow boot bar to update.
    await new Promise((resolve) => setTimeout(resolve, 50));
    generateAllTextures(this);
    if (!this.scene.get('MenuScene')) {
      this.scene.add('MenuScene', MenuScene, false);
    }
    this.scene.start('MenuScene');
  }
}
