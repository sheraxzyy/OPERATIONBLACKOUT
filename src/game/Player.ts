import Phaser from 'phaser';
import type { Loadout, WeaponDef } from '../core/types';
import { WeaponRuntime, type WeaponStats } from '../core/weaponRuntime';
import { resolveEquipment } from '../core/progression';
import { WEAPON_MAP } from '../data/weapons';
import { bloomRecovery, movementSpreadPenalty, recoilBloom } from '../core/combat';
import { audio } from '../systems/audio';
import type { BulletTarget } from './Projectiles';
import type { InputManager } from './InputManager';

export interface PlayerShot {
  weapon: WeaponDef;
  stats: WeaponStats;
  angle: number;
  spread: number;
}

export interface VehicleLike {
  active: boolean;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  def: { name: string; weapon: string };
  rotation: number;
}

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly weapons: WeaponRuntime[] = [];
  readonly weaponIds: string[];
  readonly loadout: Loadout;
  activeSlot = 0;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  stamina = 100;
  maxStamina = 100;
  medkits: number;
  grenades: number;
  alive = true;
  aiming = false;
  sprinting = false;
  crouching = false;
  moving = false;
  flashlightOn = false;
  insideVehicle: VehicleLike | null = null;
  aimAngle = 0;
  bloom = 0;
  shotsFired = 0;
  shotsHit = 0;
  distanceTravelled = 0;
  private scene: Phaser.Scene;
  private shadow: Phaser.GameObjects.Image;
  private cone: Phaser.GameObjects.Image;
  private stepTimer = 0;
  private dryFireTimer = 0;
  private lastReloading = false;
  private staminaRegen: number;
  private speedMult: number;
  private invulnerable = 0;
  private lowStaminaLock = false;
  private readonly baseSpeed = 252;

  constructor(scene: Phaser.Scene, x: number, y: number, loadout: Loadout) {
    this.scene = scene;
    this.loadout = loadout;
    this.weaponIds = [loadout.primary, loadout.secondary, loadout.sidearm];
    const equipment = resolveEquipment(loadout.equipment);
    this.maxHealth = 100 + equipment.bonusHealth;
    this.health = this.maxHealth;
    this.maxArmor = equipment.armor;
    this.armor = equipment.armor;
    this.medkits = Math.max(0, equipment.medkits);
    this.grenades = Math.max(0, equipment.grenades);
    this.staminaRegen = equipment.staminaRegen;
    this.speedMult = Math.max(0.7, equipment.speed);
    for (const id of this.weaponIds) {
      const weapon = WEAPON_MAP[id] ?? WEAPON_MAP.m4a1;
      this.weapons.push(new WeaponRuntime(weapon, loadout.attachments[id] ?? [], { extraReserveMags: equipment.reserveMags }));
    }

    this.shadow = scene.add
      .image(x + 4, y + 8, 'fx_shadow')
      .setDisplaySize(62, 40)
      .setAlpha(0.55)
      .setDepth(y - 6);
    this.cone = scene.add
      .image(x, y, 'fx_lightcone')
      .setOrigin(0, 0.5)
      .setDisplaySize(430, 260)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.32)
      .setDepth(4002)
      .setVisible(false);
    this.sprite = scene.physics.add.sprite(x, y, 'soldier_player').setDepth(y);
    this.sprite.setCircle(17, 31, 31);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDrag(0);
  }

  get activeWeapon(): WeaponRuntime {
    return this.weapons[this.activeSlot] ?? this.weapons[0];
  }

  get target(): BulletTarget {
    return {
      active: this.alive && !this.insideVehicle,
      x: this.sprite.x,
      y: this.sprite.y,
      radius: 18,
      faction: 'player',
      kind: 'player',
      onBulletHit: (damage, angle) => {
        this.takeDamage(damage, angle);
      },
    };
  }

  get spreadDeg(): number {
    const penalty = movementSpreadPenalty({
      moving: this.moving,
      sprinting: this.sprinting,
      crouching: this.crouching,
      insideVehicle: Boolean(this.insideVehicle),
    });
    const ads = this.aiming ? 0.72 : 1;
    return (this.activeWeapon.stats.spread + penalty) * ads + this.bloom;
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.shadow.setPosition(x + 4, y + 8);
    this.cone.setPosition(x, y);
  }

  update(dt: number, input: InputManager, aim: { x: number; y: number }, canShoot: boolean): void {
    if (!this.alive) return;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.dryFireTimer = Math.max(0, this.dryFireTimer - dt);
    const active = this.activeWeapon;
    const wasReloading = this.lastReloading;
    active.update(dt);
    if (wasReloading && !active.isReloading) {
      audio.play('reload_done');
    }
    this.lastReloading = active.isReloading;

    this.bloom = bloomRecovery(this.bloom, dt);
    this.aiming = input.isDown('shoot') || input.isDown('interact') ? this.aiming : false;
    if (this.sprite.input) {
      // no-op: physics sprite input is intentionally disabled
    }
    if (this.insideVehicle) {
      this.moving = false;
      this.sprinting = false;
      this.updateVisual(aim);
      return;
    }

    const dx = (input.isDown('moveRight') ? 1 : 0) - (input.isDown('moveLeft') ? 1 : 0);
    const dy = (input.isDown('moveDown') ? 1 : 0) - (input.isDown('moveUp') ? 1 : 0);
    const length = Math.hypot(dx, dy);
    this.moving = length > 0;
    this.crouching = input.isDown('crouch');
    const wantsSprint = input.isDown('sprint') && !this.crouching && this.moving && !this.lowStaminaLock;
    this.sprinting = wantsSprint;

    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - 23 * dt);
      if (this.stamina <= 0) this.lowStaminaLock = true;
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + 15 * this.staminaRegen * dt);
      if (this.lowStaminaLock && this.stamina > 24) this.lowStaminaLock = false;
    }

    let speed = this.baseSpeed * this.speedMult;
    if (this.crouching) speed *= 0.53;
    else if (this.sprinting) speed *= 1.5;
    if (this.aiming && !this.sprinting) speed *= 0.8;

    if (length > 0) {
      const vx = (dx / length) * speed;
      const vy = (dy / length) * speed;
      this.sprite.setVelocity(vx, vy);
      const dist = Math.hypot(vx, vy) * dt;
      this.distanceTravelled += dist;
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sprinting ? 0.28 : 0.46;
        audio.play('footstep');
        if (this.sprinting) this.scene.events.emit('player-footstep', { x: this.sprite.x, y: this.sprite.y, radius: 300 });
        else if (this.crouching) {
          /* crouched movement is silent */
        } else this.scene.events.emit('player-footstep', { x: this.sprite.x, y: this.sprite.y, radius: 125 });
      }
    } else {
      this.sprite.setVelocity(0, 0);
    }

    if (!canShoot) this.sprite.setVelocity(0, 0);
    this.updateVisual(aim);
  }

  private updateVisual(aim: { x: number; y: number }): void {
    const x = this.insideVehicle ? this.insideVehicle.x : this.sprite.x;
    const y = this.insideVehicle ? this.insideVehicle.y : this.sprite.y;
    this.aimAngle = Math.atan2(aim.y - y, aim.x - x);
    this.sprite.setRotation(this.aimAngle);
    this.sprite.setDepth(y + 2);
    this.shadow.setPosition(x + 4, y + 8).setDepth(y - 6);
    this.cone
      .setPosition(x, y)
      .setRotation(this.aimAngle)
      .setVisible(this.flashlightOn && !this.insideVehicle)
      .setAlpha(this.aiming ? 0.45 : 0.3);
  }

  shoot(held: boolean, pressed: boolean): PlayerShot | null {
    if (!this.alive || this.insideVehicle) return null;
    const active = this.activeWeapon;
    if (active.isReloading) return null;
    if (active.magazine <= 0) {
      if (pressed && this.dryFireTimer <= 0) {
        this.dryFireTimer = 0.4;
        audio.play('dry_fire');
        active.startReload();
        if (active.isReloading) audio.play('reload');
      }
      return null;
    }
    if (!active.weapon.automatic && !pressed) return null;
    if (!held && active.weapon.automatic) return null;
    if (!active.fire()) return null;
    this.shotsFired += 1;
    const spread = this.spreadDeg;
    this.bloom = recoilBloom(this.bloom, active.stats.recoil);
    const suppressed = active.stats.noise < active.weapon.noise * 0.6;
    audio.play(suppressed ? 'shot_suppressed' : 'shot', active.weapon.class);
    return {
      weapon: active.weapon,
      stats: active.stats,
      angle: this.aimAngle,
      spread,
    };
  }

  registerHit(): void {
    this.shotsHit += 1;
  }

  reload(): boolean {
    if (!this.alive || this.insideVehicle) return false;
    if (this.activeWeapon.startReload()) {
      audio.play('reload');
      return true;
    }
    return false;
  }

  switchSlot(slot: number): boolean {
    if (!this.alive || slot < 0 || slot > 2 || slot === this.activeSlot) return false;
    this.activeSlot = slot;
    this.activeWeapon.cancelReload();
    this.bloom = 0;
    audio.play('ui_click');
    return true;
  }

  toggleFlashlight(): boolean {
    if (!this.alive) return false;
    const hasLight = this.activeWeapon.stats.flashlight;
    if (!hasLight) return false;
    this.flashlightOn = !this.flashlightOn;
    audio.play('ui_click');
    this.scene.events.emit('player-flashlight', this.flashlightOn);
    return true;
  }

  useMedkit(): boolean {
    if (!this.alive || this.medkits <= 0 || this.health >= this.maxHealth) return false;
    this.medkits -= 1;
    this.health = Math.min(this.maxHealth, this.health + 55);
    audio.play('pickup');
    return true;
  }

  useGrenade(): boolean {
    if (!this.alive || this.grenades <= 0) return false;
    this.grenades -= 1;
    return true;
  }

  addAmmo(rounds: number): void {
    this.activeWeapon.addReserve(rounds);
  }

  takeDamage(amount: number, angle = 0): boolean {
    if (!this.alive || this.invulnerable > 0) return false;
    this.invulnerable = 0.08;
    let remaining = Math.max(0, amount);
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining);
      this.armor -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) this.health = Math.max(0, this.health - remaining);
    audio.play('hurt');
    this.scene.cameras.main.shake(140, 0.004);
    this.scene.events.emit('player-hurt', { angle, amount });
    if (this.health <= 0) {
      this.alive = false;
      this.sprite.setVelocity(0, 0);
      this.scene.tweens.add({ targets: this.sprite, alpha: 0.35, angle: this.sprite.angle + 70, duration: 420 });
      this.shadow.setVisible(false);
      this.cone.setVisible(false);
      this.scene.events.emit('player-dead');
      return true;
    }
    return false;
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addGrenades(amount: number): void {
    this.grenades += amount;
  }

  addMedkits(amount: number): void {
    this.medkits += amount;
  }

  setVehicle(vehicle: VehicleLike | null): void {
    this.insideVehicle = vehicle;
    this.sprite.setVisible(!vehicle);
    this.shadow.setVisible(!vehicle);
    this.cone.setVisible(false);
    this.sprite.setVelocity(0, 0);
  }

  getCenter(): { x: number; y: number } {
    if (this.insideVehicle) return { x: this.insideVehicle.x, y: this.insideVehicle.y };
    return { x: this.sprite.x, y: this.sprite.y };
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.cone.destroy();
  }
}
