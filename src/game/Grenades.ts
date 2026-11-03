import Phaser from 'phaser';
import type { EffectsSystem } from './Effects';

interface LiveGrenade {
  image: Phaser.GameObjects.Image;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
  trail: number;
  owner: 'player' | 'enemy';
}

export interface GrenadeWorld {
  isBlocked(x: number, y: number): boolean;
  onExplode(x: number, y: number, radius: number, damage: number, owner: 'player' | 'enemy'): void;
}

/** Pooled fragmentation grenades with simple wall bounces and fuse timers. */
export class GrenadeSystem {
  private effects: EffectsSystem;
  private world: GrenadeWorld;
  private grenades: LiveGrenade[] = [];

  constructor(scene: Phaser.Scene, effects: EffectsSystem, world: GrenadeWorld, count = 12) {
    this.effects = effects;
    this.world = world;
    for (let i = 0; i < count; i += 1) {
      const image = scene.add
        .image(0, 0, 'fx_grenade')
        .setActive(false)
        .setVisible(false)
        .setDepth(680)
        .setDisplaySize(14, 20);
      this.grenades.push({ image, active: false, x: 0, y: 0, vx: 0, vy: 0, fuse: 0, trail: 0, owner: 'player' });
    }
  }

  throw(x: number, y: number, angle: number, owner: 'player' | 'enemy' = 'player'): void {
    const grenade = this.grenades.find((g) => !g.active) ?? this.grenades[0];
    if (!grenade) return;
    grenade.active = true;
    grenade.x = x;
    grenade.y = y;
    grenade.vx = Math.cos(angle) * 430;
    grenade.vy = Math.sin(angle) * 430;
    grenade.fuse = 2.2;
    grenade.trail = 0;
    grenade.owner = owner;
    grenade.image.setActive(true).setVisible(true).setPosition(x, y).setRotation(0);
  }

  update(dt: number): void {
    const delta = Math.min(0.05, Math.max(0, dt));
    for (const grenade of this.grenades) {
      if (!grenade.active) continue;
      grenade.fuse -= delta;
      grenade.trail -= delta;
      grenade.x += grenade.vx * delta;
      grenade.y += grenade.vy * delta;
      const nx = grenade.x + Math.sign(grenade.vx) * 7;
      const ny = grenade.y + Math.sign(grenade.vy) * 7;
      if (this.world.isBlocked(nx, grenade.y)) {
        grenade.vx *= -0.48;
        grenade.x += grenade.vx * delta * 2;
        this.effects.sparkBurst(grenade.x, grenade.y, 0xffd08a, 2);
      }
      if (this.world.isBlocked(grenade.x, ny)) {
        grenade.vy *= -0.48;
        grenade.y += grenade.vy * delta * 2;
        this.effects.sparkBurst(grenade.x, grenade.y, 0xffd08a, 2);
      }
      grenade.vx *= 1 - 1.6 * delta;
      grenade.vy *= 1 - 1.6 * delta;
      grenade.image.setPosition(grenade.x, grenade.y);
      grenade.image.rotation += delta * 7 * (Math.abs(grenade.vx) + Math.abs(grenade.vy) > 80 ? 1 : 0.2);
      if (grenade.trail <= 0) {
        grenade.trail = 0.16;
        this.effects.smokePuff(grenade.x, grenade.y, 0x8f8a7d);
      }
      if (grenade.fuse <= 0) {
        grenade.active = false;
        grenade.image.setActive(false).setVisible(false);
        this.effects.explosion(grenade.x, grenade.y, 190);
        this.world.onExplode(grenade.x, grenade.y, 190, 125, grenade.owner);
      }
    }
  }

  clear(): void {
    for (const grenade of this.grenades) {
      grenade.active = false;
      grenade.image.setActive(false).setVisible(false);
    }
  }
}
