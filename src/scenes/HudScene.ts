import Phaser from 'phaser';
import { txt, mono, addScanlines } from '../ui/components';
import { THEME, hexToCss } from '../ui/theme';
import { app } from '../core/app';
import { GameScene } from './GameScene';

export class HudScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private pausedOverlay?: Phaser.GameObjects.Container;
  private notificationText?: Phaser.GameObjects.Text;
  private notificationTimer = 0;
  private killText?: Phaser.GameObjects.Text;
  private objectiveLines: Phaser.GameObjects.Text[] = [];
  private healthBar?: Phaser.GameObjects.Graphics;
  private interactBar?: Phaser.GameObjects.Graphics;
  private crosshair?: Phaser.GameObjects.Image;

  constructor() {
    super('HudScene');
  }

  create(data: { gameScene?: GameScene }): void {
    this.gameScene = data.gameScene ?? (this.scene.get('GameScene') as GameScene);
    addScanlines(this, 60);
    this.crosshair = this.add.image(800, 450, 'hud_crosshair').setDepth(1000).setDisplaySize(28, 28);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.crosshair?.setPosition(p.x, p.y);
    });
    this.notificationText = txt(this, 800, 120, '', 14, THEME.colors.amber, { origin: [0.5, 0.5] }).setDepth(1200).setAlpha(0);
    this.killText = mono(this, 1540, 60, 'KILLS 0', 11, THEME.colors.sand, { origin: [1, 0] }).setDepth(100);
    this.healthBar = this.add.graphics().setDepth(100);

    const evt = this.gameScene.events;
    evt.on('notification', (message: string) => this.showNotification(message));
    this.gameScene.events.on('player-dead', () => this.showNotification('OPERATOR DOWN'));

    this.createPauseButton();
  }

  private createPauseButton(): void {
    const btn = this.add.text(1540, 24, 'PAUSE  (ESC)', {
      fontFamily: 'Consolas, monospace', fontSize: '11px', color: '#c9b389',
    }).setOrigin(1, 0).setDepth(100).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      this.gameScene.togglePause();
      this.togglePauseOverlay();
    });
    const esc = this.input.keyboard?.addKey('Escape');
    esc?.on('down', () => {
      this.gameScene.togglePause();
      this.togglePauseOverlay();
    });
  }

  private togglePauseOverlay(): void {
    if (this.pausedOverlay) {
      this.pausedOverlay.destroy();
      this.pausedOverlay = undefined;
      return;
    }
    const state = this.gameScene.getHudState();
    void state;
    (this.gameScene as unknown as { paused?: boolean }).paused;
    // Determine if paused by checking focus? We'll just always create overlay on toggle.
    const container = this.add.container(0, 0).setDepth(1500);
    const shade = this.add.rectangle(800, 450, 1600, 900, 0x020404, 0.7).setInteractive();
    container.add(shade);
    const title = txt(this, 800, 380, 'PAUSED', 34, THEME.colors.white, { origin: [0.5, 0.5], letterSpacing: 4 });
    container.add(title);
    const resume = this.add.text(800, 460, 'RESUME', { color: '#c9b389', fontSize: '16px', fontFamily: 'Consolas, monospace' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    resume.on('pointerdown', () => {
      this.gameScene.togglePause();
      this.togglePauseOverlay();
    });
    container.add(resume);
    const quit = this.add.text(800, 510, 'ABORT MISSION', { color: '#d06a52', fontSize: '14px', fontFamily: 'Consolas, monospace' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    quit.on('pointerdown', () => {
      this.gameScene.events.emit('force-end', false);
    });
    container.add(quit);
    this.pausedOverlay = container;
  }

  private showNotification(message: string): void {
    this.notificationTimer = 2.6;
    this.notificationText?.setText(message).setAlpha(1);
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      this.notificationText?.setAlpha(Math.min(1, this.notificationTimer));
      if (this.notificationTimer <= 0) this.notificationText?.setAlpha(0);
    }
    const state = this.gameScene.getHudState();
    if (!state) return;

    // health bar
    const g = this.healthBar!;
    g.clear();
    g.fillStyle(0x1b2526, 0.9);
    g.fillRect(60, 840, 260, 6);
    g.fillStyle(state.health < state.maxHealth * 0.3 ? 0xd06a52 : 0x7fd8b2, 0.95);
    g.fillRect(60, 840, (state.health / Math.max(1, state.maxHealth)) * 260, 6);
    g.fillStyle(0x7ea6bb, 0.9);
    g.fillRect(60, 830, (state.armor / Math.max(1, Math.max(1, state.maxArmor))) * 260, 3);

    // ammo/weapon info
    (this as unknown as { ammo?: Phaser.GameObjects.Text }).ammo;
    // Rebuild right panel minimal text if missing
    if (!(this as unknown as { rightText?: Phaser.GameObjects.Text }).rightText) {
      (this as unknown as { rightText: Phaser.GameObjects.Text }).rightText = mono(this, 1540, 100, '', 11, THEME.colors.sand, { origin: [1, 0] }).setDepth(100);
    }
    const rt = (this as unknown as { rightText: Phaser.GameObjects.Text }).rightText;
    rt.setText(
      `${state.weaponName}\n${state.magazine} / ${state.reserve}\n${state.reloading ? 'RELOADING ' + Math.round(state.reloadProgress * 100) + '%' : ''}\nGRN ${state.grenades}  MED ${state.medkits}`,
    );

    if (this.killText) this.killText.setText(`KILLS ${state.kills}`);

    // objectives side list: rebuild each frame? keep simple
    // clear old
    for (const t of this.objectiveLines) t.destroy();
    this.objectiveLines = [];
    let y = 150;
    for (const o of state.objectives) {
      const line = txt(this, 60, y, `${o.complete ? '✓' : '○'} ${o.label}`, 11, o.complete ? THEME.colors.signal : THEME.colors.white, { letterSpacing: 1 });
      line.setAlpha(0.9);
      this.objectiveLines.push(line);
      y += 18;
    }

    // interact prompt
    if (state.interact) {
      // progress bar at bottom
      if (!this.interactBar) this.interactBar = this.add.graphics().setDepth(100);
      const ig = this.interactBar;
      ig.clear();
      ig.fillStyle(0x1b2526, 0.9);
      ig.fillRect(620, 790, 360, 6);
      ig.fillStyle(THEME.colors.amber, 0.95);
      ig.fillRect(620, 790, 360 * state.interact.progress, 6);
    } else if (this.interactBar) {
      this.interactBar.clear();
    }

    // hide crosshair on player death? no
  }
}
