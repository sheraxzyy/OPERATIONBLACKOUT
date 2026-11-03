import Phaser from 'phaser';
import { generateAllTextures } from './art/textures';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { CampaignScene } from './scenes/CampaignScene';
import { BriefingScene } from './scenes/BriefingScene';
import { LoadoutScene } from './scenes/LoadoutScene';
import { ArmoryScene } from './scenes/ArmoryScene';
import { GarageScene } from './scenes/GarageScene';
import { StatsScene } from './scenes/StatsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { FreePlayScene } from './scenes/FreePlayScene';
import { TrainingScene } from './scenes/TrainingScene';
import { SurvivalScene } from './scenes/SurvivalScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { ResultsScene } from './scenes/ResultsScene';
import { audio } from './systems/audio';
import { app } from './core/app';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: 'game',
  width: 1600,
  height: 900,
  backgroundColor: '#070b0c',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene, MenuScene, CampaignScene, BriefingScene, LoadoutScene, ArmoryScene,
    GarageScene, StatsScene, SettingsScene, FreePlayScene, TrainingScene, SurvivalScene,
    GameScene, HudScene, ResultsScene,
  ],
};

const game = new Phaser.Game(config);

// Initialize application data, then textures, then move to menu.
window.addEventListener('load', async () => {
  try {
    await app.init();
    audio.setVolumes(app.settings.masterVolume, app.settings.musicVolume, app.settings.sfxVolume);
    const bootStatus = document.getElementById('boot-status');
    if (bootStatus) bootStatus.textContent = 'LOADING FIELD KIT';
  } catch (err) {
    console.error(err);
    const fatal = document.getElementById('fatal');
    if (fatal) {
      fatal.style.display = 'flex';
      fatal.textContent = String(err);
    }
  }
});

export default game;
