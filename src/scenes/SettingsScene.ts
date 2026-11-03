import Phaser from 'phaser';
import { addBackdrop, createHeader, TacticalButton, TacticalSlider, confirmModal } from '../ui/components';
import { mono } from '../ui/components';
import { audio } from '../systems/audio';
import { app } from '../core/app';
import { DEFAULT_SETTINGS } from '../core/progression';
import { KeyAction } from '../core/types';

export class SettingsScene extends Phaser.Scene {
  private capturing: KeyAction | null = null;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor() {
    super('SettingsScene');
  }

  create(): void {
    addBackdrop(this);
    createHeader(this, { title: 'SETTINGS', subtitle: 'AUDIO · VIDEO · CONTROLS', section: 'OPTIONS', onBack: () => this.scene.start('MenuScene') });

    new TacticalSlider(this, 80, 150, {
      label: 'MASTER VOLUME', value: app.settings.masterVolume, min: 0, max: 1, step: 0.01,
      onChange: (v) => { app.updateSettings({ masterVolume: v }); audio.setVolumes(app.settings.masterVolume, app.settings.musicVolume, app.settings.sfxVolume); },
    });
    new TacticalSlider(this, 80, 210, {
      label: 'MUSIC VOLUME', value: app.settings.musicVolume, min: 0, max: 1, step: 0.01,
      onChange: (v) => { app.updateSettings({ musicVolume: v }); audio.setVolumes(app.settings.masterVolume, app.settings.musicVolume, app.settings.sfxVolume); },
    });
    new TacticalSlider(this, 80, 270, {
      label: 'SFX VOLUME', value: app.settings.sfxVolume, min: 0, max: 1, step: 0.01,
      onChange: (v) => { app.updateSettings({ sfxVolume: v }); audio.setVolumes(app.settings.masterVolume, app.settings.musicVolume, app.settings.sfxVolume); },
    });
    new TacticalSlider(this, 80, 330, {
      label: 'CAMERA ZOOM', value: app.settings.cameraZoom, min: 0.75, max: 1.5, step: 0.05, format: (v) => v.toFixed(2) + '×',
      onChange: (v) => app.updateSettings({ cameraZoom: v }),
    });

    // toggles
    const toggles: Array<[string, keyof typeof app.settings]> = [
      ['SCREEN SHAKE', 'screenShake'],
      ['WEATHER EFFECTS', 'weatherEffects'],
      ['HIGH QUALITY', 'highQuality'],
      ['SHOW FPS', 'showFps'],
    ];
    toggles.forEach(([label, key], i) => {
      const current = Boolean(app.settings[key]);
      new TacticalButton(this, 420, 150 + i * 52, 300, 42, `${label}: ${current ? 'ON' : 'OFF'}`, {
        onClick: () => {
          app.updateSettings({ [key]: !app.settings[key] } as never);
          this.scene.restart();
        },
      });
    });

    // Crosshair color preset
    new TacticalButton(this, 420, 360, 300, 42, 'RESET SETTINGS', {
      variant: 'danger',
      onClick: () => {
        app.updateSettings({ ...DEFAULT_SETTINGS });
        audio.setVolumes(app.settings.masterVolume, app.settings.musicVolume, app.settings.sfxVolume);
        this.scene.restart();
      },
    });

    // Keybinds
    mono(this, 760, 140, 'KEYBINDS (click then press key)', 12, 0xc9b389);
    const actions: KeyAction[] = [
      'moveUp','moveDown','moveLeft','moveRight','shoot','reload','interact','sprint','crouch','weapon1','weapon2','weapon3','grenade','vehicle','flashlight','medkit','pause'
    ];
    let y = 170;
    let col = 0;
    for (const action of actions) {
      const code = app.save.keybinds[action];
      const btn = new TacticalButton(this, 760 + col * 280, y, 260, 34, `${action} · ${code}`, {
        fontSize: 10,
        onClick: () => {
          this.capturing = action;
          btn.setLabel(`${action} · PRESS KEY...`);
        },
      });
      void btn;
      col += 1;
      if (col > 1) {
        col = 0;
        y += 40;
      }
    }

    new TacticalButton(this, 760, y + 20, 220, 42, 'RESET PROGRESS', {
      variant: 'danger',
      onClick: () => confirmModal(this, 'RESET PROGRESS', 'This will erase all campaign progress, credits, XP and unlocks. Settings and controls are preserved.', 'RESET', async () => {
        await app.resetProgress();
        app.commit();
        this.scene.start('MenuScene');
      }, () => { /* cancel */ }),
    });

    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.capturing) return;
      const action = this.capturing;
      // update keybinds
      const kb = { ...app.save.keybinds };
      kb[action] = e.code;
      app.save.keybinds = kb;
      app.commit();
      this.capturing = null;
      this.scene.restart();
      e.preventDefault();
    };
    this.input.keyboard?.on('keydown', this.keydownHandler);
  }

  shutdown(): void {
    if (this.keydownHandler) this.input.keyboard?.off('keydown', this.keydownHandler);
  }
}
