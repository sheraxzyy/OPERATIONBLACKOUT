import Phaser from 'phaser';
import type { VehicleDef } from '../core/types';
import { audio } from '../systems/audio';
import type { BulletTarget, FireOptions } from './Projectiles';
import type { EffectsSystem } from './Effects';

export interface VehicleDeps {
  scene: Phaser.Scene;
  effects: EffectsSystem;
  fire(options: FireOptions): void;
}

/**
 * Drivable armoured vehicle. Handles acceleration, steering, collision body,
 * armour mitigation, mounted weapon fire and destruction. The player is
 * hidden while riding and enemy fire is redirected into the chassis.
 */
export class Vehicle {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly def: VehicleDef;
  health: number;
  maxHealth: number;
  rotation: number;
  speed = 0;
  occupied = false;
  active = true;
  damageSmokeTimer = 0;
  private readonly deps: VehicleDeps;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly engineGlow: Phaser.GameObjects.Image;
  private weaponCooldown = 0;
  private hurtFlash = 0;

  constructor(deps: VehicleDeps, def: VehicleDef, x: number, y: number, rotation = 0) {
    this.deps = deps;
    this.def = def;
    this.rotation = rotation;
    this.maxHealth = def.health;
    this.health = def.health;
    this.shadow = deps.scene.add
      .image(x + 5, y + 9, 'fx_shadow')
      .setDisplaySize(def.length * 0.95, def.width * 0.75)
      .setAlpha(0.55)
      .setRotation(rotation)
      .setDepth(y - 5);
    this.sprite = deps.scene.physics.add.sprite(x, y, `vehicle_${def.id}`).setDepth(y);
    this.sprite.setRotation(rotation);
    this.sprite.setBodySize(def.width * 0.68, def.length * 0.72, true);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDrag(0, 0);
    this.engineGlow = deps.scene.add
      .image(x, y, 'fx_glow')
      .setDisplaySize(64, 64)
      .setTint(0xffb35c)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(y + 20);
  }

  /** Live world position (the sprite drives the authoritative transform). */
  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get target(): BulletTarget {
    return {
      active: this.active && this.occupied,
      x: this.sprite.x,
      y: this.sprite.y,
      radius: Math.max(34, this.def.width * 0.55),
      faction: 'player',
      kind: 'vehicle',
      onBulletHit: (damage, angle) => {
        this.takeDamage(damage, angle);
      },
    };
  }

  get mounted(): boolean {
    return this.def.weapon !== 'none';
  }

  drive(dt: number, throttle: number, steer: number): void {
    if (!this.active) return;
    this.occupied = true;
    const maxForward = this.def.topSpeed;
    const maxReverse = this.def.reverseSpeed;
    if (throttle !== 0) {
      this.speed += throttle * this.def.acceleration * dt;
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 190 * dt);
    }
    this.speed = Phaser.Math.Clamp(this.speed, -maxReverse, maxForward);
    if (Math.abs(this.speed) > 5) {
      const speedRatio = Math.min(1, Math.abs(this.speed) / maxForward);
      const direction = this.speed >= 0 ? 1 : -1;
      this.rotation += steer * this.def.turnRate * dt * (0.36 + speedRatio * 0.78) * direction;
    }
    const vx = Math.cos(this.rotation) * this.speed;
    const vy = Math.sin(this.rotation) * this.speed;
    this.sprite.setVelocity(vx, vy);
    this.sprite.setRotation(this.rotation);
    this.engineGlow.setAlpha(0.25 + Math.min(1, Math.abs(this.speed) / maxForward) * 0.5);
    this.engineGlow.setPosition(
      this.sprite.x - Math.cos(this.rotation) * this.def.length * 0.38,
      this.sprite.y - Math.sin(this.rotation) * this.def.length * 0.38,
    );
  }

  coast(dt: number): void {
    if (!this.active) return;
    this.occupied = false;
    this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 320 * dt);
    if (Math.abs(this.speed) < 3) this.speed = 0;
    this.sprite.setVelocity(Math.cos(this.rotation) * this.speed, Math.sin(this.rotation) * this.speed);
    this.engineGlow.setAlpha(Math.max(0, this.engineGlow.alpha - dt * 3));
  }

  fireMounted(angle: number): boolean {
    if (!this.active || !this.mounted || this.weaponCooldown > 0) return false;
    this.weaponCooldown = this.def.weapon === 'heavy_mg' ? 0.12 : 0.16;
    const muzzleX = this.sprite.x + Math.cos(angle) * this.def.length * 0.4;
    const muzzleY = this.sprite.y + Math.sin(angle) * this.def.length * 0.4;
    this.deps.fire({
      x: muzzleX,
      y: muzzleY,
      angle,
      spreadDeg: 2.4,
      speed: 2300,
      damage: this.def.weaponDamage,
      range: 1500,
      faction: 'player',
      falloff: true,
    });
    this.deps.effects.muzzleFlash(muzzleX, muzzleY, angle, this.def.weapon === 'heavy_mg');
    audio.play(this.def.weapon === 'heavy_mg' ? 'shot_heavy' : 'shot', 'lmg');
    return true;
  }

  takeDamage(amount: number, _angle = 0): boolean {
    if (!this.active) return false;
    this.hurtFlash = 0.1;
    this.sprite.setTintFill(0xffe2c2);
    this.deps.scene.time.delayedCall(80, () => {
      if (this.active) this.sprite.clearTint();
    });
    const mitigated = Math.max(1, amount * (1 - this.def.armor));
    this.health = Math.max(0, this.health - mitigated);
    this.deps.effects.sparkBurst(this.sprite.x, this.sprite.y, 0xffd08a, 4);
    audio.play('vehicle_hit');
    if (this.health <= 0) {
      this.destroyVehicle();
      return true;
    }
    return false;
  }

  private destroyVehicle(): void {
    this.active = false;
    this.health = 0;
    this.occupied = false;
    this.speed = 0;
    this.sprite.setVelocity(0, 0);
    this.sprite.setTint(0x4a3830);
    this.engineGlow.setAlpha(0);
    this.deps.effects.explosion(this.sprite.x, this.sprite.y, 190);
    audio.play('explosion');
    this.deps.scene.tweens.add({ targets: this.sprite, alpha: 0.55, duration: 700 });
    this.deps.scene.events.emit('vehicle-destroyed', this);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.weaponCooldown = Math.max(0, this.weaponCooldown - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.damageSmokeTimer -= dt;
    if (this.health < this.maxHealth * 0.5 && this.damageSmokeTimer <= 0) {
      this.damageSmokeTimer = this.health < this.maxHealth * 0.2 ? 0.16 : 0.4;
      this.deps.effects.smokePuff(this.sprite.x + (Math.random() - 0.5) * 20, this.sprite.y, 0x5c5852);
    }
    const x = this.sprite.x;
    const y = this.sprite.y;
    this.sprite.setDepth(y);
    this.shadow
      .setPosition(x + 5, y + 9)
      .setRotation(this.rotation)
      .setDepth(y - 5);
    this.engineGlow.setDepth(y + 20);
  }

  cleanup(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.engineGlow.destroy();
  }
}
