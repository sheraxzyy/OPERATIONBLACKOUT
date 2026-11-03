import Phaser from 'phaser';
import { damageAtRange } from '../core/combat';
import type { EffectsSystem } from './Effects';

export type BulletFaction = 'player' | 'enemy';
export type BulletTargetKind = 'player' | 'enemy' | 'vehicle' | 'training' | 'objective';

export interface BulletTarget {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  faction: BulletFaction;
  kind: BulletTargetKind;
  onBulletHit(damage: number, angle: number, point: { x: number; y: number }): void;
}

export interface ProjectileWorld {
  isBlocked(x: number, y: number): boolean;
  getTargets(faction: BulletFaction): BulletTarget[];
}

interface Bullet {
  active: boolean;
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  angle: number;
  baseDamage: number;
  range: number;
  travelled: number;
  faction: BulletFaction;
  pierce: number;
  falloff: boolean;
  onHit?: (target: BulletTarget) => void;
}

export interface FireOptions {
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  range: number;
  faction: BulletFaction;
  pierce?: number;
  falloff?: boolean;
  spreadDeg?: number;
  onHit?: (target: BulletTarget) => void;
}

/** Pooled projectile system with per-step wall collision and hit resolution. */
export class ProjectileSystem {
  private scene: Phaser.Scene;
  private effects: EffectsSystem;
  private world: ProjectileWorld;
  private bullets: Bullet[] = [];

  constructor(scene: Phaser.Scene, effects: EffectsSystem, world: ProjectileWorld, count = 220) {
    this.scene = scene;
    this.effects = effects;
    this.world = world;
    for (let i = 0; i < count; i += 1) {
      const image = scene.add
        .image(0, 0, 'fx_tracer')
        .setDisplaySize(22, 2.6)
        .setActive(false)
        .setVisible(false)
        .setDepth(705)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.bullets.push({
        active: false,
        image,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        speed: 0,
        angle: 0,
        baseDamage: 0,
        range: 0,
        travelled: 0,
        faction: 'player',
        pierce: 0,
        falloff: true,
        onHit: undefined,
      });
    }
  }

  fire(opts: FireOptions): void {
    const bullet = this.bullets.find((b) => !b.active) ?? this.bullets[0];
    if (!bullet) return;
    const spread = ((opts.spreadDeg ?? 0) * Math.PI) / 180;
    const angle = opts.angle + (Math.random() - 0.5) * spread;
    bullet.active = true;
    bullet.x = opts.x;
    bullet.y = opts.y;
    bullet.speed = opts.speed;
    bullet.vx = Math.cos(angle) * opts.speed;
    bullet.vy = Math.sin(angle) * opts.speed;
    bullet.angle = angle;
    bullet.baseDamage = opts.damage;
    bullet.range = opts.range;
    bullet.travelled = 0;
    bullet.faction = opts.faction;
    bullet.pierce = opts.pierce ?? 0;
    bullet.falloff = opts.falloff ?? true;
    bullet.onHit = opts.onHit;
    bullet.image
      .setActive(true)
      .setVisible(true)
      .setPosition(opts.x, opts.y)
      .setRotation(angle)
      .setAlpha(0.96)
      .setTint(opts.faction === 'player' ? 0xfff2c9 : 0xff8866)
      .setDisplaySize(opts.faction === 'player' ? 24 : 18, 2.4);
  }

  update(dt: number): void {
    const delta = Math.min(0.05, Math.max(0, dt));
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      const distance = bullet.speed * delta;
      bullet.travelled += distance;
      if (bullet.travelled > bullet.range) {
        this.retire(bullet);
        continue;
      }
      const steps = Math.max(1, Math.ceil(distance / 9));
      const stepX = (bullet.vx * delta) / steps;
      const stepY = (bullet.vy * delta) / steps;
      let retired = false;
      for (let step = 0; step < steps; step += 1) {
        const prevX = bullet.x;
        const prevY = bullet.y;
        bullet.x += stepX;
        bullet.y += stepY;
        if (this.world.isBlocked(bullet.x, bullet.y)) {
          const hitX = prevX + (bullet.x - prevX) * 0.45;
          const hitY = prevY + (bullet.y - prevY) * 0.45;
          this.effects.impact(hitX, hitY, bullet.angle, 'wall');
          this.retire(bullet);
          retired = true;
          break;
        }
        const targets = this.world.getTargets(bullet.faction);
        let hitTarget: BulletTarget | null = null;
        for (const target of targets) {
          if (!target.active) continue;
          if (Math.hypot(target.x - bullet.x, target.y - bullet.y) <= target.radius) {
            hitTarget = target;
            break;
          }
        }
        if (hitTarget) {
          const raw = bullet.falloff
            ? damageAtRange(bullet.baseDamage, bullet.travelled, bullet.range)
            : bullet.baseDamage;
          const damage = Math.max(0, raw);
          if (damage > 0) {
            hitTarget.onBulletHit(damage, bullet.angle, { x: bullet.x, y: bullet.y });
          }
          bullet.onHit?.(hitTarget);
          this.effects.impact(
            bullet.x,
            bullet.y,
            bullet.angle,
            hitTarget.kind === 'vehicle' || hitTarget.kind === 'objective' ? 'metal' : 'flesh',
          );
          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else {
            this.retire(bullet);
            retired = true;
            break;
          }
        }
      }
      if (!retired && bullet.active) {
        bullet.image.setPosition(bullet.x, bullet.y).setRotation(bullet.angle);
      }
    }
  }

  private retire(bullet: Bullet): void {
    bullet.active = false;
    bullet.image.setActive(false).setVisible(false);
  }

  clear(): void {
    for (const bullet of this.bullets) this.retire(bullet);
  }
}
