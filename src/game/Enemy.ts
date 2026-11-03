import Phaser from 'phaser';
import type { DifficultyDef, EnemyClass, EnemyClassDef } from '../core/types';
import { ENEMY_MAP } from '../data/enemies';
import { RNG } from '../core/rng';
import {
  findPath,
  hasLineOfSight,
  nearestOpenWorld,
  type NavGrid,
  type Point,
} from '../systems/pathfinding';
import { audio } from '../systems/audio';
import type { BulletTarget, FireOptions } from './Projectiles';
import type { EffectsSystem } from './Effects';

export type EnemyState = 'patrol' | 'alert' | 'combat' | 'search' | 'retreat' | 'dead';

export interface EnemyDeps {
  scene: Phaser.Scene;
  nav: NavGrid;
  difficulty: DifficultyDef;
  effects: EffectsSystem;
  playerTarget(): BulletTarget | null;
  fire(options: FireOptions): void;
  coverPoints(): Point[];
  onDeath(enemy: Enemy): void;
  onAlert(enemy: Enemy, x: number, y: number): void;
  playEnemyShot(enemy: Enemy): void;
}

export interface EnemySpawnOptions {
  elite?: boolean;
  state?: EnemyState;
  homeRadius?: number;
}

const BURST_GAP = 0.075;

/**
 * Tactical enemy soldier. Owns perception (vision cone + line of sight),
 * hearing, cover selection, flanking, retreat and burst-fire behaviour.
 * Movement uses the map navigation grid so patrols path through doorways and
 * around solid props instead of pushing into walls.
 */
export class Enemy {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly def: EnemyClassDef;
  readonly elite: boolean;
  readonly scoreValue: number;
  readonly home: Point;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  state: EnemyState;
  facing: number;
  lastKnown: Point | null = null;
  private readonly deps: EnemyDeps;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly marker: Phaser.GameObjects.Text;
  private laser?: Phaser.GameObjects.Image;
  private path: Point[] = [];
  private pathIndex = 0;
  private repathTimer = 0;
  private moveTarget: Point | null = null;
  private perceptionTimer = 0;
  private lostSight = 0;
  private reactionLeft = 0;
  private burstLeft = 0;
  private shotTimer = 0;
  private burstTimer = 0;
  private sniperAim = 0;
  private alertWait = 0;
  private wanderTimer = 0;
  private wanderTarget: Point | null = null;
  private coverTimer = 0;
  private coverTarget: Point | null = null;
  private flankTimer = 0;
  private retreatTimer = 0;
  private combatTime = 0;
  private hurtFlash = 0;
  private homeRadius: number;
  private removed = false;
  private readonly rng = new RNG(Math.random() * 0xffffffff);

  constructor(deps: EnemyDeps, classId: EnemyClass, x: number, y: number, options: EnemySpawnOptions = {}) {
    this.deps = deps;
    this.def = ENEMY_MAP[classId];
    this.elite = Boolean(options.elite);
    this.home = { x, y };
    this.homeRadius = options.homeRadius ?? (classId === 'guard' ? 210 : 330);
    this.x = x;
    this.y = y;
    this.facing = this.rng.range(-Math.PI, Math.PI);
    const diff = deps.difficulty;
    const eliteHealth = this.elite ? 1.34 : 1;
    const eliteDamage = this.elite ? 1.18 : 1;
    this.maxHealth = Math.round(
      this.def.health * diff.enemyHealth * eliteHealth * (classId === 'heavy' && this.elite ? 1.1 : 1),
    );
    this.health = this.maxHealth;
    this.scoreValue = Math.round(
      this.def.scoreValue * (this.elite ? 1.6 : 1) * diff.scoreMultiplier,
    );
    this.state = options.state ?? 'patrol';
    void eliteDamage;

    this.shadow = deps.scene.add
      .image(x + 4, y + 8, 'fx_shadow')
      .setDisplaySize(54, 34)
      .setAlpha(0.5)
      .setDepth(y - 6);
    this.sprite = deps.scene.physics.add.sprite(x, y, `soldier_${classId}`).setDepth(y);
    this.sprite.setCircle(16, 32, 32);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDrag(900, 900);
    if (this.elite) this.sprite.setTint(0xffd2bc);

    this.marker = deps.scene.add
      .text(x, y - 48, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '16px',
        color: '#f0b45a',
        stroke: '#050708',
        strokeThickness: 3,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(760)
      .setVisible(false);

    if (this.state === 'combat') {
      this.reactionLeft = 0.1;
      this.lastKnown = { x, y };
    }
  }

  get alive(): boolean {
    return this.state !== 'dead' && this.health > 0;
  }

  get target(): BulletTarget {
    return {
      active: this.alive,
      x: this.x,
      y: this.y,
      radius: 17,
      faction: 'enemy',
      kind: 'enemy',
      onBulletHit: (damage, angle) => {
        this.takeDamage(damage, angle);
      },
    };
  }

  hearNoise(x: number, y: number, radius: number): void {
    if (!this.alive || this.state === 'combat') return;
    const dist = Math.hypot(this.x - x, this.y - y);
    if (dist > radius) return;
    this.lastKnown = { x, y };
    if (this.state === 'patrol' || this.state === 'search') {
      this.state = 'alert';
      this.alertWait = 3.2 + this.rng.next() * 2;
      this.setMoveTarget({ x, y });
      this.showMarker('?', '#d9c184');
    }
  }

  takeDamage(amount: number, _angle = 0): boolean {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.hurtFlash = 0.09;
    this.sprite.setTintFill(0xffffff);
    this.deps.scene.time.delayedCall(70, () => {
      if (!this.alive) return;
      if (this.elite) this.sprite.setTint(0xffd2bc);
      else this.sprite.clearTint();
    });
    // Being shot immediately reveals the shooter's direction.
    const player = this.deps.playerTarget();
    if (player?.active) {
      this.lastKnown = { x: player.x, y: player.y };
      this.state = 'combat';
      this.reactionLeft = Math.min(this.reactionLeft, 0.15);
      this.showMarker('!', '#e0795f');
    }
    if (this.health <= 0) {
      this.die();
      return true;
    }
    if (this.def.canRetreat && this.health <= this.maxHealth * 0.3 && this.state !== 'retreat') {
      this.state = 'retreat';
      this.retreatTimer = 5.5;
      this.coverTarget = null;
      this.coverTimer = 0;
      this.showMarker('<<', '#d06a52');
    }
    return false;
  }

  private die(): void {
    this.state = 'dead';
    this.sprite.setVelocity(0, 0);
    this.shadow.setVisible(false);
    this.marker.setVisible(false);
    this.laser?.destroy();
    this.laser = undefined;
    this.deps.effects.sparkBurst(this.x, this.y, 0x9a2f24, 5);
    this.sprite.setTint(0x6b2a24);
    this.deps.scene.tweens.add({
      targets: [this.sprite],
      alpha: 0.25,
      angle: this.sprite.angle + 80,
      scaleX: 0.92,
      scaleY: 0.92,
      duration: 620,
      ease: 'Sine.Out',
    });
    this.deps.onDeath(this);
    this.deps.scene.time.delayedCall(6500, () => this.cleanup());
  }

  update(dt: number): void {
    if (!this.alive || this.removed) return;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.shotTimer = Math.max(0, this.shotTimer - dt);
    this.burstTimer = Math.max(0, this.burstTimer - dt);
    this.coverTimer = Math.max(0, this.coverTimer - dt);
    this.flankTimer = Math.max(0, this.flankTimer - dt);
    this.perceptionTimer -= dt;

    if (this.perceptionTimer <= 0) {
      this.perceptionTimer = 0.16 + this.rng.next() * 0.08;
      this.perceive();
    }

    const player = this.deps.playerTarget();
    switch (this.state) {
      case 'patrol':
        this.updatePatrol(dt);
        break;
      case 'alert':
        this.updateAlert(dt);
        break;
      case 'combat':
        if (player?.active) this.updateCombat(dt, player);
        else this.updatePatrol(dt);
        break;
      case 'search':
        this.updateSearch(dt);
        break;
      case 'retreat':
        if (player?.active) this.updateRetreat(dt, player);
        else this.updatePatrol(dt);
        break;
      default:
        break;
    }

    this.x = this.sprite.x;
    this.y = this.sprite.y;
    this.sprite.setDepth(this.y + 2);
    this.shadow.setPosition(this.x + 4, this.y + 8).setDepth(this.y - 6);
    this.marker.setPosition(this.x, this.y - 48).setDepth(this.y + 80);
    if (this.laser) {
      const player2 = this.deps.playerTarget();
      if (!player2?.active) {
        this.hideLaser();
      } else {
        this.drawLaser(player2);
      }
    }
  }

  private perceive(): void {
    const player = this.deps.playerTarget();
    if (!player?.active) {
      this.lostSight = 99;
      return;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const detection = this.deps.difficulty.detection;
    let range = this.def.visionRange * detection;
    if (this.state === 'combat') range *= 1.15;
    if (dist > range || dist < 1) {
      if (this.state === 'combat') {
        this.lostSight += 0.2;
        if (this.lostSight > 4.6) this.beginSearch();
      }
      return;
    }
    const angleTo = Math.atan2(dy, dx);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(angleTo - this.facing));
    const halfFov = Phaser.Math.DegToRad(this.def.fov * 0.5);
    if (diff > halfFov && this.state !== 'combat' && dist > 120) return;
    if (!hasLineOfSight(this.deps.nav, this.x, this.y, player.x, player.y)) {
      if (this.state === 'combat') {
        this.lostSight += 0.2;
        if (this.lostSight > 4.6) this.beginSearch();
      }
      return;
    }
    this.lostSight = 0;
    this.lastKnown = { x: player.x, y: player.y };
    if (this.state !== 'combat' && this.state !== 'retreat') {
      const reaction = this.def.reaction * this.deps.difficulty.reaction;
      this.reactionLeft = Math.max(0.12, reaction * (this.state === 'alert' ? 0.7 : 1));
      this.state = 'combat';
      this.combatTime = 0;
      this.showMarker('!', '#e0795f');
      this.deps.onAlert(this, this.x, this.y);
    }
  }

  private beginSearch(): void {
    this.state = 'search';
    this.alertWait = 5.5;
    this.hideLaser();
    if (this.lastKnown) this.setMoveTarget(this.lastKnown);
    else this.state = 'patrol';
    this.showMarker('?', '#d9c184');
  }

  private updatePatrol(dt: number): void {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0 || !this.wanderTarget) {
      this.wanderTimer = 3.4 + this.rng.next() * 4.2;
      const angle = this.rng.range(-Math.PI, Math.PI);
      const radius = this.rng.range(40, this.homeRadius);
      const raw = {
        x: this.home.x + Math.cos(angle) * radius,
        y: this.home.y + Math.sin(angle) * radius,
      };
      this.wanderTarget = nearestOpenWorld(this.deps.nav, raw.x, raw.y, 5) ?? this.home;
    }
    if (this.wanderTarget) this.moveToward(this.wanderTarget, this.def.speed * 0.46, dt);
    if (this.rng.chance(0.008)) this.facing += this.rng.range(-0.6, 0.6);
  }

  private updateAlert(dt: number): void {
    this.alertWait -= dt;
    if (this.moveTarget) {
      const dist = Math.hypot(this.moveTarget.x - this.x, this.moveTarget.y - this.y);
      if (dist > 28) {
        this.moveToward(this.moveTarget, this.def.speed * 0.8, dt);
      } else {
        this.moveTarget = null;
        this.facing += dt * 1.4;
      }
    } else {
      this.facing += dt * 1.1;
    }
    if (this.alertWait <= 0) {
      this.state = 'patrol';
      this.wanderTimer = 0;
      this.hideMarker();
    }
  }

  private updateSearch(dt: number): void {
    this.alertWait -= dt;
    if (this.moveTarget) {
      const dist = Math.hypot(this.moveTarget.x - this.x, this.moveTarget.y - this.y);
      if (dist > 30) this.moveToward(this.moveTarget, this.def.speed * 0.85, dt);
      else {
        this.moveTarget = null;
        this.facing += dt * 1.6;
      }
    } else {
      this.facing += dt * 1.35;
    }
    if (this.alertWait <= 0) {
      this.state = 'patrol';
      this.wanderTimer = 0;
      this.hideMarker();
    }
  }

  private updateCombat(dt: number, player: BulletTarget): void {
    this.combatTime += dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const angleTo = Math.atan2(dy, dx);
    const turnSpeed = this.state === 'combat' ? 5.2 : 2.4;
    this.facing = Phaser.Math.Angle.RotateTo(this.facing, angleTo, turnSpeed * dt);
    this.lostSight = Math.max(
      0,
      this.lostSight + dt * (hasLineOfSight(this.deps.nav, this.x, this.y, player.x, player.y) ? -2 : 1),
    );
    if (this.lostSight > 2.6) {
      this.beginSearch();
      return;
    }

    if (this.reactionLeft > 0) {
      this.reactionLeft -= dt;
      this.stop(dt);
      return;
    }

    // Pick cover when the class values it, otherwise close to the preferred range.
    if (this.def.coverBias > 0.4 && this.coverTimer <= 0) {
      this.coverTimer = 3.4 + this.rng.next() * 1.8;
      this.coverTarget = this.chooseCover(player);
    }
    if (
      this.def.canFlank &&
      !this.coverTarget &&
      this.flankTimer <= 0 &&
      dist > this.def.preferredRange * 1.05 &&
      this.combatTime > 2
    ) {
      this.flankTimer = 5.5;
      const side = this.rng.chance(0.5) ? 1 : -1;
      const angle = angleTo + (Math.PI / 2) * side;
      this.setMoveTarget({
        x: player.x + Math.cos(angle) * this.def.preferredRange * 0.85,
        y: player.y + Math.sin(angle) * this.def.preferredRange * 0.85,
      });
    }

    const canSee = hasLineOfSight(this.deps.nav, this.x, this.y, player.x, player.y);
    const wantsDistance = dist > this.def.preferredRange * 1.28 || dist < this.def.preferredRange * 0.55;
    const destination = this.coverTarget ?? this.moveTarget;

    if (destination && (wantsDistance || dist > this.def.visionRange)) {
      const remain = Math.hypot(destination.x - this.x, destination.y - this.y);
      if (remain > 30) {
        this.moveToward(destination, this.def.speed * (this.def.id === 'assault' ? 1 : 0.86), dt);
      } else {
        if (this.coverTarget) this.coverTarget = null;
        if (this.moveTarget) this.moveTarget = null;
        this.stop(dt);
      }
    } else if (dist < this.def.preferredRange * 0.5) {
      const away = {
        x: this.x - Math.cos(angleTo) * 90,
        y: this.y - Math.sin(angleTo) * 90,
      };
      this.moveToward(away, this.def.speed * 0.8, dt);
    } else {
      this.stop(dt);
    }

    if (!canSee) {
      if (this.moveTarget == null) this.setMoveTarget(this.lastKnown ?? { x: player.x, y: player.y });
      return;
    }

    this.fireLogic(dt, player, dist);
  }

  private fireLogic(dt: number, player: BulletTarget, dist: number): void {
    if (this.def.id === 'sniper') {
      if (this.sniperAim > 0) {
        this.sniperAim -= dt;
        this.showLaser(player);
        if (this.sniperAim <= 0) {
          this.shootAt(player, 0.7);
          this.hideLaser();
          this.burstTimer = 1.7 + this.rng.next() * 0.7;
        }
        return;
      }
      if (this.burstTimer <= 0 && this.shotTimer <= 0) {
        this.sniperAim = 1.05;
        this.shotTimer = 0.2;
      }
      return;
    }

    if (this.burstTimer > 0) return;
    if (this.burstLeft <= 0) {
      this.burstLeft = this.def.burst;
      if (this.def.id === 'heavy') this.burstLeft = this.def.burst;
    }
    if (this.shotTimer > 0) return;
    if (dist > this.def.visionRange * 1.1) return;
    this.shootAt(player, Math.max(0.4, 1 - dist / (this.def.visionRange * 1.5)));
    this.burstLeft -= 1;
    this.shotTimer = Math.max(0.055, 1 / Math.max(0.5, this.def.fireRate));
    if (this.burstLeft <= 0) {
      this.burstTimer = 0.75 + this.rng.next() * 0.85;
    }
  }

  private shootAt(player: BulletTarget, distanceFactor: number): void {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const accuracy = Math.min(0.96, this.def.accuracy * this.deps.difficulty.enemyAccuracy);
    const baseSpread = (1 - accuracy) * 22 + (1 - distanceFactor) * 5;
    const moving = Math.hypot(this.sprite.body?.velocity.x ?? 0, this.sprite.body?.velocity.y ?? 0) > 20;
    const spread = baseSpread + (moving ? 4.5 : 0);
    const damage = this.def.damage * this.deps.difficulty.enemyDamage * (this.elite ? 1.18 : 1);
    this.deps.fire({
      x: this.x + Math.cos(angle) * 26,
      y: this.y + Math.sin(angle) * 26,
      angle,
      spreadDeg: spread,
      speed: this.def.id === 'sniper' ? 2800 : 1550,
      damage,
      range: this.def.visionRange * 1.15,
      faction: 'enemy',
      falloff: true,
    });
    this.deps.effects.muzzleFlash(
      this.x + Math.cos(angle) * 24,
      this.y + Math.sin(angle) * 24,
      angle,
      this.def.id === 'heavy' || this.def.id === 'sniper',
    );
    this.deps.playEnemyShot(this);
  }

  private chooseCover(player: BulletTarget): Point | null {
    const points = this.deps.coverPoints();
    let best: Point | null = null;
    let bestScore = Infinity;
    const playerPos = { x: player.x, y: player.y };
    for (const point of points) {
      const dSelf = Math.hypot(point.x - this.x, point.y - this.y);
      if (dSelf > 300 || dSelf < 18) continue;
      const dPlayer = Math.hypot(point.x - playerPos.x, point.y - playerPos.y);
      if (dPlayer < this.def.preferredRange * 0.7) continue;
      const exposed = hasLineOfSight(this.deps.nav, point.x, point.y, playerPos.x, playerPos.y);
      const score = dSelf + (exposed ? 230 : 0) + Math.abs(dPlayer - this.def.preferredRange) * 0.35;
      if (score < bestScore) {
        bestScore = score;
        best = point;
      }
    }
    return best;
  }

  private updateRetreat(dt: number, player: BulletTarget): void {
    this.retreatTimer -= dt;
    const angle = Math.atan2(this.y - player.y, this.x - player.x);
    const destination = {
      x: this.x + Math.cos(angle) * 170,
      y: this.y + Math.sin(angle) * 170,
    };
    if (!this.moveTarget && this.retreatTimer > 0) this.setMoveTarget(destination);
    if (this.moveTarget) this.moveToward(this.moveTarget, this.def.speed * 1.08, dt);
    if (this.retreatTimer <= 0) {
      this.state = 'search';
      this.alertWait = 4.5;
    }
  }

  private setMoveTarget(target: Point): void {
    const open = nearestOpenWorld(this.deps.nav, target.x, target.y, 5) ?? target;
    this.moveTarget = { x: open.x, y: open.y };
    this.path = [];
    this.pathIndex = 0;
    this.repathTimer = 0;
  }

  private moveToward(target: Point, speed: number, dt: number): void {
    if (this.repathTimer <= 0 || this.path.length === 0) {
      this.repathTimer = 0.55 + this.rng.next() * 0.35;
      const path = findPath(this.deps.nav, { x: this.x, y: this.y }, target, 6500);
      this.path = path ?? [];
      this.pathIndex = 0;
    }
    let waypoint: Point | null = this.path[this.pathIndex] ?? null;
    if (waypoint && Math.hypot(waypoint.x - this.x, waypoint.y - this.y) < 22) {
      this.pathIndex += 1;
      waypoint = this.path[this.pathIndex] ?? null;
    }
    if (!waypoint) waypoint = target;
    const dx = waypoint.x - this.x;
    const dy = waypoint.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      this.stop(dt);
      return;
    }
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    this.sprite.setVelocity(vx, vy);
    this.facing = Phaser.Math.Angle.RotateTo(this.facing, Math.atan2(vy, vx), 8 * dt);
    this.sprite.setRotation(this.facing);
  }

  private stop(dt: number): void {
    this.sprite.setVelocity(0, 0);
    this.sprite.setRotation(this.facing);
    void dt;
  }

  private showMarker(text: string, color: string): void {
    this.marker.setText(text).setColor(color).setVisible(true).setAlpha(1);
    this.deps.scene.tweens.killTweensOf(this.marker);
    this.deps.scene.tweens.add({ targets: this.marker, alpha: 0.4, duration: 420, yoyo: true, repeat: 2 });
  }

  private hideMarker(): void {
    this.marker.setVisible(false);
  }

  private showLaser(player: BulletTarget): void {
    if (!this.laser) {
      this.laser = this.deps.scene.add
        .image(this.x, this.y, 'fx_laser')
        .setOrigin(0, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(740)
        .setTint(0xff6a4a);
    }
    this.laser.setVisible(true);
    this.drawLaser(player);
  }

  private drawLaser(player: BulletTarget): void {
    if (!this.laser) return;
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    this.laser
      .setPosition(this.x, this.y)
      .setRotation(angle)
      .setDisplaySize(dist, 2)
      .setAlpha(0.55 + Math.sin(this.deps.scene.time.now * 0.03) * 0.2);
  }

  private hideLaser(): void {
    this.laser?.setVisible(false);
    this.sniperAim = 0;
  }

  cleanup(): void {
    if (this.removed) return;
    this.removed = true;
    this.sprite.destroy();
    this.shadow.destroy();
    this.marker.destroy();
    this.laser?.destroy();
    this.laser = undefined;
  }

  destroy(): void {
    this.cleanup();
  }
}

export interface EnemyManagerOptions {
  mix: EnemyClass[];
  eliteChance: number;
  spawnZones: Point[];
  playerPosition(): Point;
  reinforcementLimit: number;
}

/**
 * Owns enemy lifecycle, reinforcement waves and squad-level alert propagation.
 * Keeping this outside GameScene makes enemy spawning deterministic and easy
 * to tune per mode.
 */
export class EnemyManager {
  readonly enemies: Enemy[] = [];
  private readonly deps: EnemyDeps;
  private readonly rng: RNG;
  private options: EnemyManagerOptions;
  private reinforcementTimer = 32;
  private spawnedTotal = 0;
  private initialCount = 0;
  private wave = 0;
  private lastSpawnPoint: Point | null = null;

  constructor(deps: EnemyDeps, options: EnemyManagerOptions, seed: number) {
    this.deps = deps;
    this.options = options;
    this.rng = new RNG(seed);
  }

  get aliveCount(): number {
    return this.enemies.reduce((sum, e) => sum + (e.alive ? 1 : 0), 0);
  }

  get totalSpawned(): number {
    return this.spawnedTotal;
  }

  get currentWave(): number {
    return this.wave;
  }

  getTargets(): BulletTarget[] {
    return this.enemies.filter((e) => e.alive).map((e) => e.target);
  }

  spawnInitial(count: number, mix: EnemyClass[], eliteChance: number): void {
    this.initialCount = count;
    this.options.mix = mix.length ? mix : ['patrol'];
    this.options.eliteChance = eliteChance;
    for (let i = 0; i < count; i += 1) this.spawnOne(mix, eliteChance, 650);
  }

  spawnWave(count: number, mix: EnemyClass[], eliteChance: number): void {
    this.wave += 1;
    this.options.mix = mix.length ? mix : this.options.mix;
    this.options.eliteChance = eliteChance;
    for (let i = 0; i < count; i += 1) this.spawnOne(mix, eliteChance, 620);
  }

  private spawnOne(mix: EnemyClass[], eliteChance: number, minPlayerDistance: number): Enemy | null {
    const zones = this.options.spawnZones;
    if (!zones.length) return null;
    const player = this.options.playerPosition();
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const zone = zones[this.rng.int(0, zones.length - 1)];
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(0, 160);
      const raw = { x: zone.x + Math.cos(angle) * radius, y: zone.y + Math.sin(angle) * radius };
      if (Math.hypot(raw.x - player.x, raw.y - player.y) < minPlayerDistance) continue;
      if (this.lastSpawnPoint && Math.hypot(raw.x - this.lastSpawnPoint.x, raw.y - this.lastSpawnPoint.y) < 60) continue;
      const open = nearestOpenWorld(this.deps.nav, raw.x, raw.y, 8);
      if (!open) continue;
      const classId = mix[this.rng.int(0, mix.length - 1)] ?? 'patrol';
      const elite = this.rng.chance(eliteChance);
      const enemy = new Enemy(this.deps, classId, open.x, open.y, { elite });
      this.enemies.push(enemy);
      this.spawnedTotal += 1;
      this.lastSpawnPoint = open;
      return enemy;
    }
    return null;
  }

  /** Spawn a single enemy at an exact location (used by mounted/ambush events). */
  spawnAt(classId: EnemyClass, x: number, y: number, elite = false): Enemy {
    const enemy = new Enemy(this.deps, classId, x, y, { elite, state: 'combat' });
    this.enemies.push(enemy);
    this.spawnedTotal += 1;
    return enemy;
  }

  update(dt: number): void {
    for (const enemy of this.enemies) enemy.update(dt);
    if (this.enemies.length > 32) {
      const dead = this.enemies.filter((e) => !e.alive);
      for (const enemy of dead) {
        if (this.rng.chance(0.02)) enemy.cleanup();
      }
    }
    if (this.initialCount <= 0) return;
    this.reinforcementTimer -= dt;
    if (this.reinforcementTimer <= 0) {
      this.reinforcementTimer = 34 * this.deps.difficulty.reinforcementRate;
      const cap = Math.max(this.initialCount, Math.round(this.initialCount * this.options.reinforcementLimit));
      if (this.spawnedTotal < cap && this.aliveCount < Math.max(3, Math.ceil(this.initialCount * 0.7))) {
        const player = this.options.playerPosition();
        for (let i = 0; i < 2; i += 1) {
          const zone = this.options.spawnZones[this.rng.int(0, this.options.spawnZones.length - 1)];
          if (!zone) break;
          const angle = this.rng.range(0, Math.PI * 2);
          const open = nearestOpenWorld(this.deps.nav, zone.x + Math.cos(angle) * 90, zone.y + Math.sin(angle) * 90, 8);
          if (!open || Math.hypot(open.x - player.x, open.y - player.y) < 520) continue;
          const classId = this.options.mix[this.rng.int(0, this.options.mix.length - 1)];
          const enemy = new Enemy(this.deps, classId, open.x, open.y, {
            elite: this.rng.chance(this.options.eliteChance),
            state: 'alert',
          });
          enemy.hearNoise(player.x, player.y, 3000);
          this.enemies.push(enemy);
          this.spawnedTotal += 1;
        }
        this.deps.scene.events.emit('notification', 'REINFORCEMENTS INBOUND');
      }
    }
  }

  alertFrom(enemy: Enemy, x: number, y: number): void {
    for (const other of this.enemies) {
      if (other === enemy || !other.alive) continue;
      if (Math.hypot(other.x - x, other.y - y) < 520) other.hearNoise(x, y, 520);
    }
  }

  alertAll(x: number, y: number): void {
    for (const enemy of this.enemies) {
      if (enemy.alive) enemy.hearNoise(x, y, 4000);
    }
  }

  damageArea(x: number, y: number, radius: number, damage: number): number {
    let killed = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist > radius) continue;
      const falloff = 1 - (dist / radius) * 0.55;
      if (enemy.takeDamage(damage * falloff)) killed += 1;
    }
    return killed;
  }

  cleanup(): void {
    for (const enemy of this.enemies) enemy.cleanup();
    this.enemies.length = 0;
  }
}
