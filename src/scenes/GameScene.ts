import Phaser from 'phaser';
import type { BulletTarget, FireOptions } from '../game/Projectiles';
import type { RunConfig, RunResult, MissionDef } from '../core/types';
import { app } from '../core/app';
import { audio } from '../systems/audio';
import { InputManager } from '../game/InputManager';
import { Player } from '../game/Player';
import { Vehicle } from '../game/Vehicle';
import { EffectsSystem } from '../game/Effects';
import { ProjectileSystem } from '../game/Projectiles';
import { GrenadeSystem } from '../game/Grenades';
import { EnemyManager } from '../game/Enemy';
import { WeatherSystem } from '../game/Weather';
import { ObjectiveManager } from '../game/Objectives';
import { MapBuilder } from '../world/mapBuilder';
import { getMission } from '../data/missions';
import { getMap } from '../data/maps';
import { DIFFICULTY_MAP } from '../data/enemies';
import { VEHICLE_MAP, VEHICLES } from '../data/vehicles';
import { ENEMY_MAP } from '../data/enemies';
import { isBlocked } from '../systems/pathfinding';
import { levelFromXp, applyMissionCompletion, calculateRewards, calculateMissionStars } from '../core/progression';

interface TrainingDummy {
  sprite: Phaser.GameObjects.Image;
  target: BulletTarget;
  health: number;
  maxHealth: number;
  alive: boolean;
}

export class GameScene extends Phaser.Scene {
  private config!: RunConfig;
  private mission: MissionDef | null = null;
  private builtMap!: ReturnType<MapBuilder['build']>;
  private inputManager!: InputManager;
  private effects!: EffectsSystem;
  private projectileSystem!: ProjectileSystem;
  private grenadeSystem!: GrenadeSystem;
  private objectives: ObjectiveManager | null = null;
  private player!: Player;
  private enemyManager!: EnemyManager;
  private vehicles: Vehicle[] = [];
  private nearVehicle: Vehicle | null = null;
  private weather!: WeatherSystem;
  private playerTraining: TrainingDummy[] = [];
  private paused = false;
  private ended = false;
  private runSeconds = 0;
  private kills = 0;
  private eliteKills = 0;
  private vehiclesDestroyed = 0;
  private rescued = 0;
  private intel = 0;
  private lastFrameTargets: BulletTarget[] = [];
  private cachedPlayerTargets: BulletTarget[] = [];
  private cachedEnemyTargets: BulletTarget[] = [];
  private colliderSet = new WeakSet<Phaser.Physics.Arcade.Sprite>();
  private darkOverlay?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('GameScene');
  }

  init(data: { config?: RunConfig } | RunConfig): void {
    const candidate = (data as { config?: RunConfig }).config ?? (data as RunConfig);
    this.config = candidate;
  }

  create(): void {
    this.mission = this.config.missionId ? getMission(this.config.missionId) : null;
    const mapDef = getMap(this.config.mapId);
    const timeOfDay = this.config.timeOfDay ?? this.mission?.timeOfDay ?? mapDef.recommendedTime;
    const weather = this.config.weather ?? this.mission?.weather ?? 'clear';
    const highQuality = app.settings.highQuality;
    const builder = new MapBuilder(this, mapDef, timeOfDay, this.config.seed, highQuality);
    this.builtMap = builder.build();
    this.physics.world.setBounds(0, 0, this.builtMap.worldW, this.builtMap.worldH);
    this.cameras.main.setBounds(0, 0, this.builtMap.worldW, this.builtMap.worldH);
    this.cameras.main.setZoom(app.settings.cameraZoom);

    this.inputManager = new InputManager(this, app.save.keybinds);
    this.effects = new EffectsSystem(this, highQuality);
    const world = {
      isBlocked: (x: number, y: number) => isBlocked(this.builtMap.nav, x, y),
      getTargets: (_faction: 'player' | 'enemy') => (_faction === 'player' ? this.cachedPlayerTargets : this.cachedEnemyTargets),
    };
    this.projectileSystem = new ProjectileSystem(this, this.effects, world, 260);
    this.grenadeSystem = new GrenadeSystem(this, this.effects, {
      isBlocked: (x: number, y: number) => isBlocked(this.builtMap.nav, x, y),
      onExplode: (x, y, radius, damage, owner) => this.onExplode(x, y, radius, damage, owner),
    });

    const difficulty = DIFFICULTY_MAP[this.config.difficulty] ?? DIFFICULTY_MAP.medium;
    this.player = new Player(this, this.builtMap.spawn.x, this.builtMap.spawn.y, app.save.loadout);

    this.vehicles = this.builtMap.vehicleSpawns.map((s) => {
      const def = VEHICLE_MAP[s.type] ?? VEHICLES[0];
      return new Vehicle({ scene: this, effects: this.effects, fire: this.projectileSystem.fire.bind(this.projectileSystem) }, def, s.x, s.y);
    });

    const spawnMix = this.mission?.enemyMix ?? ['patrol', 'guard', 'assault'];
    const enemyDeps = {
      scene: this,
      nav: this.builtMap.nav,
      difficulty,
      effects: this.effects,
      playerTarget: () => this.getEnemyPlayerTarget(),
      fire: this.projectileSystem.fire.bind(this.projectileSystem),
      coverPoints: () => this.builtMap.props.map((p) => ({ x: p.x, y: p.y })),
      onDeath: (enemy: unknown) => {
        this.kills += 1;
        // elite tracking
        const e = enemy as { elite?: boolean };
        if (e.elite) this.eliteKills += 1;
        this.objectives?.registerKill();
        audio.play('kill');
      },
      onAlert: (src: unknown, x: number, y: number) => {
        void src;
        this.enemyManager.alertFrom(src as never, x, y);
      },
      playEnemyShot: (enemy: unknown) => {
        const e = enemy as { def?: { id?: string } };
        const id = e?.def?.id;
        if (id === 'heavy') audio.play('shot_heavy');
        else if (id === 'sniper') audio.play('shot', 'sniper');
        else audio.play('shot', 'assault');
      },
    };
    this.enemyManager = new EnemyManager(enemyDeps as never, {
      mix: this.mission?.enemyMix ?? ['patrol', 'guard', 'assault'],
      eliteChance: this.config.enemyDensity ? 0.12 : (this.mission?.eliteChance ?? 0.1),
      spawnZones: this.builtMap.enemySpawnZones,
      playerPosition: () => this.player.getCenter(),
      reinforcementLimit: 1.25,
    }, this.config.seed + 11);

    const count = this.getEnemyCount();
    this.enemyManager.spawnInitial(count, this.mission?.enemyMix ?? ['patrol', 'guard', 'assault'], this.config.enemyDensity ? 0.14 : (this.mission?.eliteChance ?? 0.1));

    // Training dummies
    if (this.config.mode === 'training') {
      const zones = ['objectiveA', 'objectiveB', 'objectiveC', 'center', 'cache', 'overlook']
        .map((name) => this.builtMap.zones[name])
        .filter(Boolean);
      const positions = zones.length ? zones : [{ x: this.builtMap.worldW / 2, y: this.builtMap.worldH / 2 }];
      for (let i = 0; i < 12; i += 1) {
        const p = positions[i % positions.length];
        const x = p.x + (Math.random() - 0.5) * 120;
        const y = p.y + (Math.random() - 0.5) * 120;
        const sprite = this.add.image(x, y, 'soldier_dummy').setDepth(y + 2).setDisplaySize(58, 58);
        const dummy: TrainingDummy = { sprite, health: 100, maxHealth: 100, alive: true, target: undefined as unknown as BulletTarget };
        const target: BulletTarget = {
          active: true,
          x,
          y,
          radius: 18,
          faction: 'enemy',
          kind: 'training',
          onBulletHit: (damage) => {
            if (!dummy.alive) return;
            dummy.health = Math.max(0, dummy.health - damage);
            if (dummy.health <= 0) {
              dummy.alive = false;
              target.active = false;
              this.effects.sparkBurst(dummy.sprite.x, dummy.sprite.y, 0x9a2f24, 8);
              this.kills += 1;
              audio.play('kill');
              this.tweens.add({ targets: dummy.sprite, alpha: 0.3, duration: 300 });
            }
          },
        };
        dummy.target = target;
        // keep target position updated
        const updateTarget = () => {
          target.x = dummy.sprite.x;
          target.y = dummy.sprite.y;
          target.active = dummy.alive;
        };
        (dummy as unknown as { updateTarget: () => void }).updateTarget = updateTarget;
        this.playerTraining.push(dummy);
      }
    }

    // Objectives
    if (this.config.mode === 'campaign' && this.mission) {
      const enemyPlayer = { x: this.player.sprite.x, y: this.player.sprite.y };
      void enemyPlayer;
      const objectiveDeps = {
        scene: this,
        effects: this.effects,
        playerPosition: () => this.player.getCenter(),
        interactKey: app.save.keybinds.interact,
        onComplete: (objective: { def: { type: string; label: string }; complete: boolean }) => {
          if (objective.def.type === 'extract' && !this.ended) this.finishRun(true);
          if (objective.def.type === 'rescue') this.rescued += 1;
          if (objective.def.type === 'intel') this.intel += 1;
        },
        onProgress: () => {},
      };
      this.objectives = new ObjectiveManager(objectiveDeps as never, this.mission.objectives, this.builtMap);
    } else if (this.config.mode === 'freeplay') {
      const objectiveDeps = {
        scene: this,
        effects: this.effects,
        playerPosition: () => this.player.getCenter(),
        interactKey: app.save.keybinds.interact,
        onComplete: (objective: { def: { type: string } }) => {
          if (objective.def.type === 'extract' && !this.ended) this.finishRun(true);
        },
        onProgress: () => {},
      };
      this.objectives = new ObjectiveManager(objectiveDeps as never, [
        { id: 'fp-elim', type: 'eliminate', label: 'Clear hostiles in the sector', count: 8 },
        { id: 'fp-extract', type: 'extract', label: 'Exfiltrate', zone: 'extraction' },
      ], this.builtMap);
    }

    // Weather
    const w = weather;
    this.weather = new WeatherSystem(this, app.settings.weatherEffects ? w : 'clear', highQuality);

    // Colliders
    this.physics.add.collider(this.player.sprite, this.builtMap.solids);
    for (const vehicle of this.vehicles) this.physics.add.collider(vehicle.sprite, this.builtMap.solids);

    // Lighting overlay (darkness for night/dusk)
    const night = timeOfDay === 'night' || timeOfDay === 'dusk';
    if (night) {
      this.darkOverlay = this.add
      .rectangle(0, 0, this.builtMap.worldW, this.builtMap.worldH, 0x000000, timeOfDay === 'night' ? 0.38 : 0.2)
      .setOrigin(0)
      .setDepth(4000);
    }

    // Training targets collider with bullets? handled by world.

    this.scene.run('HudScene', { gameScene: this });

    audio.startMusic(this.config.mode === 'survival' ? 'survival' : this.config.mode === 'training' ? 'menu' : 'mission');
    audio.startAmbience(weather, night);

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private getEnemyCount(): number {
    if (this.mission) return this.mission.enemyCount;
    if (this.config.mode === 'survival') return Math.max(6, Math.round((this.config.enemyDensity ?? 1) * 6));
    if (this.config.mode === 'freeplay') return 10;
    if (this.config.mode === 'training') return 0;
    return 8;
  }

  private getEnemyPlayerTarget(): (BulletTarget | null) {
    if (this.player.alive && !this.player.insideVehicle) return this.player.target;
    if (this.player.insideVehicle) {
      const v = this.vehicles.find((veh) => veh === this.player.insideVehicle) ?? null;
      // player.insideVehicle is VehicleLike, not necessarily same ref? compare x/y
      return (this.vehicles.find((veh) => veh.x === this.player.insideVehicle?.x && veh.y === this.player.insideVehicle?.y))?.target ?? null;
    }
    return null;
  }

  private onExplode(x: number, y: number, radius: number, damage: number, owner: 'player' | 'enemy'): void {
    if (owner === 'player') {
      const killed = this.enemyManager.damageArea(x, y, radius, damage);
      void killed;
      // objectives destroyable area damage
      if (this.objectives) {
        for (const t of this.objectives.destroyedTargets) {
          const d = Math.hypot(t.x - x, t.y - y);
          if (d <= radius) this.objectives.damageDestroyable(t, damage * (1 - d / radius * 0.5));
        }
      }
      // training
      for (const d of this.playerTraining) {
        if (!d.alive) continue;
        const dd = Math.hypot(d.target.x - x, d.target.y - y);
        if (dd <= radius) d.target.onBulletHit?.(damage * (1 - dd / radius * 0.5), 0, { x, y });
      }
    } else {
      // enemy grenade
      if (this.player.alive && !this.player.insideVehicle) {
        const d = Math.hypot(this.player.sprite.x - x, this.player.sprite.y - y);
        if (d < radius) this.player.takeDamage(damage * 0.5);
      }
      for (const v of this.vehicles) {
        if (!v.occupied) continue;
        const d = Math.hypot(v.x - x, v.y - y);
        if (d < radius) v.takeDamage(damage * 0.5);
      }
    }
    this.effects.explosion(x, y, radius);
    audio.play('explosion');
  }

  togglePause(): void {
    if (this.ended) return;
    this.paused = !this.paused;
    if (this.paused) this.physics.pause();
    else this.physics.resume();
  }

  getHudState(): {
    health: number; maxHealth: number; armor: number; maxArmor: number; stamina: number; maxStamina: number;
    weaponName: string; magazine: number; reserve: number; reloading: boolean; reloadProgress: number;
    grenades: number; medkits: number; kills: number; wave: number; timeSeconds: number; objectives: { label: string; complete: boolean; progress: number; target: number }[];
    interact: { text: string; progress: number; keyLabel: string } | null;
    nearVehicle: string | null; mounted: boolean;
    fps?: number;
  } {
    const w = this.player.activeWeapon;
    const objectives = this.objectives
      ? this.objectives.objectives.map((o) => ({ label: o.def.label, complete: o.complete, progress: o.progress, target: o.target }))
      : [];
    return {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      armor: this.player.armor,
      maxArmor: this.player.maxArmor,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      weaponName: w.weapon.name,
      magazine: w.magazine,
      reserve: w.reserve,
      reloading: w.isReloading,
      reloadProgress: w.reloadProgress,
      grenades: this.player.grenades,
      medkits: this.player.medkits,
      kills: this.kills,
      wave: this.enemyManager.currentWave,
      timeSeconds: this.runSeconds,
      objectives,
      interact: this.objectives?.prompt
        ? { text: this.objectives.prompt.text, progress: this.objectives.prompt.progress, keyLabel: this.objectives.prompt.keyLabel }
        : null,
      nearVehicle: this.nearVehicle ? this.nearVehicle.def.name : null,
      mounted: Boolean(this.player.insideVehicle),
    };
  }

  update(time: number, deltaMs: number): void {
    const dt = Math.min(0.05, Math.max(0, deltaMs / 1000));
    if (!this.scene.isActive('HudScene') && !this.ended) this.scene.run('HudScene', { gameScene: this });
    if (this.ended) return;
    this.inputManager.update();
    if (this.inputManager.justPressed('pause')) this.togglePause();
    if (this.paused) {
      // still update HUD by doing nothing; weather frozen maybe
      return;
    }

    this.runSeconds += dt;

    // Mounted vehicle handling
    const occupied = this.player.insideVehicle as Vehicle | null;
    if (occupied) {
      const activeVehicle = this.vehicles.find((v) => v.x === occupied.x && v.y === occupied.y) ?? null;
      const throttle = (this.inputManager.isDown('moveUp') ? 1 : 0) - (this.inputManager.isDown('moveDown') ? 1 : 0);
      const steer = (this.inputManager.isDown('moveRight') ? 1 : 0) - (this.inputManager.isDown('moveLeft') ? 1 : 0);
      if (activeVehicle) {
        activeVehicle.drive(dt, throttle, steer);
        audio.startEngine();
        const max = activeVehicle.def.topSpeed;
        audio.setEngineLoad(Math.min(1, Math.abs(activeVehicle.speed) / Math.max(1, max)));
      }
      if (this.inputManager.justPressed('vehicle')) {
        // exit
        const v = activeVehicle;
        if (v) {
          v.occupied = false;
          v.coast(dt);
          this.player.setVehicle(null);
          this.player.setPosition(v.x + 40, v.y + 20);
        }
      }
      if (this.inputManager.isDown('shoot')) {
        const aim = this.player.aimAngle;
        const activeV = activeVehicle;
        if (activeV) activeV.fireMounted(aim);
      }
    } else {
      audio.stopEngine();
      // movement/shooting handled by player
      const aim = this.inputManager.aimPoint(this.cameras.main);
      this.player.update(dt, this.inputManager, aim, true);
      if (this.inputManager.justPressed('reload')) this.player.reload();
      if (this.inputManager.justPressed('weapon1')) this.player.switchSlot(0);
      if (this.inputManager.justPressed('weapon2')) this.player.switchSlot(1);
      if (this.inputManager.justPressed('weapon3')) this.player.switchSlot(2);
      if (this.inputManager.justPressed('flashlight')) this.player.toggleFlashlight();
      if (this.inputManager.justPressed('medkit')) this.player.useMedkit();
      const shot = this.player.shoot(this.inputManager.isDown('shoot'), this.inputManager.justPressed('shoot'));
      if (shot) {
        const pellets = Math.max(1, shot.weapon.pellets);
        for (let i = 0; i < pellets; i += 1) {
          this.projectileSystem.fire({
            x: this.player.getCenter().x + Math.cos(shot.angle) * 24,
            y: this.player.getCenter().y + Math.sin(shot.angle) * 24,
            angle: shot.angle,
            speed: shot.weapon.projectileSpeed,
            damage: shot.stats.damage,
            range: shot.stats.range,
            faction: 'player',
            falloff: true,
            spreadDeg: shot.spread,
            onHit: (target) => {
              this.player.registerHit();
              audio.play('hit');
              if (target.kind === 'enemy') {
                // enemy kill tracking? Enemy handles via target
              }
            },
          });
        }
        // alert enemies by noise
        const center = this.player.getCenter();
        const radius = shot.stats.noise;
        for (const e of this.enemyManager.enemies) {
          if (e.alive) e.hearNoise(center.x, center.y, radius);
        }
        this.enemyManager.alertAll(center.x, center.y);
      }
      // Auto cancellation? no
      if (this.inputManager.justPressed('grenade') && this.player.useGrenade()) {
        const center = this.player.getCenter();
        const aimPoint = this.inputManager.aimPoint(this.cameras.main);
        const angle = Math.atan2(aimPoint.y - center.y, aimPoint.x - center.x);
        this.grenadeSystem.throw(center.x, center.y, angle, 'player');
        for (const e of this.enemyManager.enemies) {
          if (e.alive) e.hearNoise(center.x, center.y, 460);
        }
      }
      // vehicle entry
      const center = this.player.getCenter();
      this.nearVehicle = this.vehicles.find((v) => v.active && Phaser.Math.Distance.Between(v.x, v.y, center.x, center.y) < 96) ?? null;
      if (this.inputManager.justPressed('vehicle') && this.nearVehicle) {
        this.nearVehicle.occupied = true; // ensure target active
        this.player.setVehicle(this.nearVehicle as unknown as Parameters<Player['setVehicle']>[0]);
      }
    }

    // Coasting all inactive vehicles
    for (const v of this.vehicles) {
      if (!v.occupied) v.coast(dt);
      v.update(dt);
      // destroyed tracking
    }

    // Enemy colliders dynamic
    for (const enemy of this.enemyManager.enemies) {
      if (!this.colliderSet.has(enemy.sprite)) {
        this.physics.add.collider(enemy.sprite, this.builtMap.solids);
        this.colliderSet.add(enemy.sprite);
      }
    }

    // Update training target image positions? static
    for (const d of this.playerTraining) {
      if (d.alive) {
        const t = d.target as BulletTarget & { /* */ };
        t.x = d.sprite.x;
        t.y = d.sprite.y;
      }
    }

    // Cached targets
    this.cachedPlayerTargets = [...this.enemyManager.getTargets()];
    for (const d of this.playerTraining) {
      if (d.alive) this.cachedPlayerTargets.push(d.target);
    }
    if (this.objectives) this.cachedPlayerTargets.push(...this.objectives.destroyedTargets);
    this.cachedEnemyTargets = [];
    if (this.player.alive && !this.player.insideVehicle) this.cachedEnemyTargets.push(this.player.target);
    for (const v of this.vehicles) {
      if (v.active && v.occupied) this.cachedEnemyTargets.push(v.target);
    }

    // Update systems
    this.playerTraining; // ensure
    this.enemyManager.update(dt);
    if (this.objectives) {
      const interactHeld = this.inputManager.isDown('interact');
      this.objectives.update(dt, interactHeld);
      // rescue tracking rough: when objective complete event increments? Already in onComplete.
    }
    this.projectileSystem.update(dt);
    this.grenadeSystem.update(dt);
    this.effects.update(dt);
    this.weather.update(dt);

    // Vehicles destroyed tracking
    for (const v of this.vehicles) {
      if (!v.active && v.health <= 0 && !(v as unknown as { _counted?: boolean })._counted) {
        (v as unknown as { _counted: boolean })._counted = true;
        this.vehiclesDestroyed += 1;
      }
    }

    // End conditions
    const playerDead = !this.player.alive;
    if (playerDead && !this.ended) this.finishRun(false);
    // Campaign/survival wave? survival never auto-success.
    // Freeplay auto-success handled by objectives.
    // Training success after timer? optional: 60s
    if (this.config.mode === 'training' && this.runSeconds >= 60 && !this.ended) this.finishRun(true);

    // Camera follow
    const center = this.player.getCenter();
    this.cameras.main.centerOn(center.x, center.y);

    // show FPS maybe
  }

  private finishRun(success: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.physics.pause();
    this.inputManager.destroy();
    this.weather.cleanup();
    audio.stopAmbience();
    audio.stopEngine();
    // compute result
    const result: RunResult = {
      mode: this.config.mode,
      missionId: this.config.missionId,
      mapId: this.config.mapId,
      difficulty: this.config.difficulty,
      success,
      score: success ? (this.config.mode === 'training' ? Math.round((this.kills / Math.max(1, this.runSeconds)) * 1000) : this.kills * 50 + this.runSeconds * 2) : 0,
      stars: 0,
      kills: this.kills,
      eliteKills: this.eliteKills,
      shotsFired: this.player.shotsFired,
      shotsHit: this.player.shotsHit,
      timeSeconds: Math.round(this.runSeconds),
      creditsEarned: 0,
      xpEarned: 0,
      vehiclesDestroyed: this.vehiclesDestroyed,
      rescued: this.rescued,
      intelRecovered: this.intel,
      wave: this.enemyManager.currentWave,
      objectives: this.objectives ? this.objectives.objectives.map((o) => ({ label: o.def.label, complete: o.complete })) : [],
      newUnlocks: [],
    };
    // stars/rewards for campaign
    if (this.config.mode === 'campaign' && this.mission) {
      const completedObjectives = this.objectives ? this.objectives.completedCount : 0;
      const objectiveCount = this.objectives ? this.objectives.objectives.length : 0;
      const accuracy = this.player.shotsFired > 0 ? this.player.shotsHit / this.player.shotsFired : 0;
      result.stars = calculateMissionStars({
        success,
        objectiveCount,
        completedObjectives,
        accuracy,
        timeSeconds: result.timeSeconds,
        parSeconds: Math.max(120, this.mission.enemyCount * 12),
      });
      const rewards = calculateRewards(this.mission, this.config.difficulty, success, result.stars);
      result.creditsEarned = rewards.credits;
      result.xpEarned = rewards.xp;
      result.score = rewards.score || result.score;
      if (success) {
        const outcome = applyMissionCompletion(app.save, {
          missionId: this.mission.id,
          success,
          difficulty: this.config.difficulty,
          accuracy,
          timeSeconds: result.timeSeconds,
          score: result.score,
          stars: result.stars,
          credits: result.creditsEarned,
          xp: result.xpEarned,
          kills: result.kills,
          eliteKills: result.eliteKills,
          shotsFired: result.shotsFired,
          shotsHit: result.shotsHit,
          deaths: success ? 0 : 1,
          vehiclesDestroyed: result.vehiclesDestroyed,
          rescued: result.rescued,
          intel: result.intelRecovered,
        });
        result.newUnlocks = outcome.newUnlocks;
        app.save = outcome.save;
        app.commit();
      } else {
        // failed mission update stats
        const outcome = applyMissionCompletion(app.save, {
          missionId: this.mission.id,
          success: false,
          difficulty: this.config.difficulty,
          accuracy,
          timeSeconds: result.timeSeconds,
          score: result.score,
          stars: 0,
          credits: 0,
          xp: 0,
          kills: result.kills,
          eliteKills: result.eliteKills,
          shotsFired: result.shotsFired,
          shotsHit: result.shotsHit,
          deaths: 1,
          vehiclesDestroyed: result.vehiclesDestroyed,
          rescued: result.rescued,
          intel: result.intelRecovered,
        });
        app.save = outcome.save;
        app.commit();
      }
    } else {
      // Non-campaign rewards
      if (this.config.mode === 'survival') {
        app.save.stats.wavesSurvived = Math.max(app.save.stats.wavesSurvived, result.wave);
        app.save.stats.kills += result.kills;
        app.save.stats.playSeconds += result.timeSeconds;
        const credits = result.kills * 25 + result.wave * 100;
        const xp = result.kills * 12 + result.wave * 40;
        result.creditsEarned = credits;
        result.xpEarned = xp;
        app.save.credits += credits;
        app.save.xp += xp;
        app.commit();
      } else if (this.config.mode === 'training') {
        app.save.stats.kills += result.kills;
        app.save.stats.trainingBest = Math.max(app.save.stats.trainingBest, result.kills);
        app.save.stats.playSeconds += result.timeSeconds;
        app.save.credits += 50;
        app.save.xp += 20;
        result.creditsEarned = 50;
        result.xpEarned = 20;
        app.commit();
      } else if (this.config.mode === 'freeplay') {
        app.save.stats.kills += result.kills;
        app.save.stats.playSeconds += result.timeSeconds;
        app.save.credits += result.kills * 20;
        app.save.xp += result.kills * 8;
        result.creditsEarned = result.kills * 20;
        result.xpEarned = result.kills * 8;
        app.commit();
      }
    }
    // distanced travelled stat best effort
    app.save.stats.distanceTravelled += Math.round(this.player.distanceTravelled);
    app.save.stats.shotsFired += 0; // already updated in campaign branch; avoid duplicate below?
    // Note campaign applyMissionCompletion already adds shotsFired; non-campaign manual minimal. Fine.

    this.scene.stop('HudScene');
    this.scene.start('ResultsScene', { result });
  }

  shutdown(): void {
    try { this.builtMap?.cleanup(); } catch { /* ignore */ }
    try { this.objectives?.cleanup(); } catch { /* ignore */ }
    try { this.enemyManager?.cleanup(); } catch { /* ignore */ }
    try { this.weather?.cleanup(); } catch { /* ignore */ }
    try { this.inputManager?.destroy(); } catch { /* ignore */ }
    for (const v of this.vehicles) try { v.cleanup(); } catch { /* ignore */ }
    this.player?.destroy();
  }
}
