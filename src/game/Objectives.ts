import Phaser from 'phaser';
import type { InGameObjective, ObjectiveDef } from '../core/types';
import type { BuiltMap } from '../world/mapBuilder';
import { audio } from '../systems/audio';
import type { BulletTarget } from './Projectiles';
import type { EffectsSystem } from './Effects';

export interface ObjectiveInteraction {
  objectiveId: string;
  text: string;
  progress: number;
  keyLabel: string;
}

export interface ObjectiveDeps {
  scene: Phaser.Scene;
  effects: EffectsSystem;
  playerPosition(): { x: number; y: number };
  interactKey: string;
  onComplete(objective: InGameObjective): void;
  onProgress?(objective: InGameObjective): void;
}

interface ObjectiveVisual {
  marker?: Phaser.GameObjects.Image;
  ring?: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  prop?: Phaser.GameObjects.Image;
  target?: BulletTarget;
  health?: number;
  maxHealth?: number;
  pulse?: Phaser.Tweens.Tween;
}

const INTERACT_RADIUS = 96;
const REACH_RADIUS = 132;
const EXTRACT_RADIUS = 128;

const INTEL_HOLD = 2.2;
const RESCUE_HOLD = 3.0;

/**
 * Owns mission objectives, their world markers and their completion rules.
 * Extraction is deliberately locked until every other mandatory objective is
 * finished, and survival timers only begin once their preceding objectives
 * have been satisfied.
 */
export class ObjectiveManager {
  readonly objectives: InGameObjective[] = [];
  readonly deps: ObjectiveDeps;
  private readonly visuals: ObjectiveVisual[] = [];
  private readonly map: BuiltMap;
  private extractionUnlocked = false;
  private interaction: ObjectiveInteraction | null = null;
  private lockedNotice = 0;

  constructor(deps: ObjectiveDeps, defs: ObjectiveDef[], map: BuiltMap) {
    this.deps = deps;
    this.map = map;
    for (const def of defs) {
      const target = def.type === 'survive' ? Math.max(1, def.seconds ?? 60) : Math.max(1, def.count ?? 1);
      const objective: InGameObjective = {
        def,
        complete: false,
        progress: 0,
        target,
      };
      if (def.zone) {
        const zone = def.zone === 'extraction' ? map.extraction : map.zones[def.zone];
        if (zone) objective.position = { x: zone.x, y: zone.y };
      }
      if (def.type === 'survive') objective.secondsLeft = def.seconds ?? 60;
      this.objectives.push(objective);
      this.visuals.push(this.createVisual(objective));
    }
    this.refreshExtractionLock();
  }

  get allNonExtractComplete(): boolean {
    return this.objectives
      .filter((o) => o.def.type !== 'extract' && !o.def.optional)
      .every((o) => o.complete);
  }

  get extractUnlocked(): boolean {
    return this.extractionUnlocked;
  }

  get prompt(): ObjectiveInteraction | null {
    return this.interaction;
  }

  get completedCount(): number {
    return this.objectives.filter((o) => o.complete).length;
  }

  get destroyedTargets(): BulletTarget[] {
    return this.visuals
      .map((v) => v.target)
      .filter((t): t is BulletTarget => Boolean(t && t.active));
  }

  /** Resolve the nearest spatial/marker position for an objective id. */
  positionOf(id: string): { x: number; y: number } | null {
    return this.objectives.find((o) => o.def.id === id)?.position ?? null;
  }

  update(dt: number, interactHeld: boolean): void {
    const player = this.deps.playerPosition();
    let nearest: { objective: InGameObjective; dist: number } | null = null;

    for (const objective of this.objectives) {
      if (objective.complete) continue;
      const def = objective.def;

      if (def.type === 'survive') {
        if (this.surviveActive(objective)) {
          objective.secondsLeft = Math.max(0, (objective.secondsLeft ?? 0) - dt);
          objective.progress = objective.target - (objective.secondsLeft ?? 0);
          if (objective.secondsLeft <= 0) this.complete(objective);
        }
        continue;
      }

      if (def.type === 'eliminate' || def.type === 'destroy') continue;
      if (!objective.position) continue;

      const dist = Math.hypot(player.x - objective.position.x, player.y - objective.position.y);
      if (def.type === 'reach') {
        if (dist <= REACH_RADIUS) this.complete(objective);
        continue;
      }
      if (def.type === 'extract') {
        this.lockedNotice = Math.max(0, this.lockedNotice - dt);
        if (dist <= EXTRACT_RADIUS) {
          if (this.extractionUnlocked) this.complete(objective);
          else if (this.lockedNotice <= 0) {
            this.lockedNotice = 2.2;
            this.deps.scene.events.emit('notification', 'EXTRACTION LOCKED — COMPLETE ALL OBJECTIVES');
          }
        }
        continue;
      }

      const radius = INTERACT_RADIUS;
      if (dist > radius) continue;
      if (!nearest || dist < nearest.dist) nearest = { objective, dist };
    }

    this.interaction = null;
    if (nearest) {
      const objective = nearest.objective;
      const hold = objective.def.type === 'intel' ? INTEL_HOLD : RESCUE_HOLD;
      if (interactHeld) {
        objective.progress = Math.min(objective.target, objective.progress + dt);
        this.deps.onProgress?.(objective);
        if (objective.progress >= objective.target - 0.0001) this.complete(objective);
      } else if (objective.progress > 0) {
        objective.progress = Math.max(0, objective.progress - dt * 1.15);
      }
      this.interaction = {
        objectiveId: objective.def.id,
        text: objective.def.type === 'intel' ? 'RECOVERING INTEL' : 'SECURING SURVIVOR',
        progress: Phaser.Math.Clamp(objective.progress / hold, 0, 1),
        keyLabel: this.deps.interactKey,
      };
      const visual = this.visuals[this.objectives.indexOf(objective)];
      if (visual?.ring) visual.ring.setAlpha(0.24 + this.interaction.progress * 0.5);
    } else {
      for (let i = 0; i < this.objectives.length; i += 1) {
        const objective = this.objectives[i];
        const visual = this.visuals[i];
        if (visual?.ring && !objective.complete) visual.ring.setAlpha(0.2);
      }
    }
  }

  registerKill(): void {
    for (const objective of this.objectives) {
      if (objective.complete || objective.def.type !== 'eliminate') continue;
      objective.progress = Math.min(objective.target, objective.progress + 1);
      this.deps.onProgress?.(objective);
      if (objective.progress >= objective.target) this.complete(objective);
    }
  }

  damageDestroyable(target: BulletTarget, damage: number): void {
    const index = this.visuals.findIndex((v) => v.target === target);
    if (index < 0) return;
    const visual = this.visuals[index];
    const objective = this.objectives[index];
    if (!visual || !objective || objective.complete) return;
    visual.health = Math.max(0, (visual.health ?? 0) - damage);
    objective.progress = objective.target * (1 - visual.health / Math.max(1, visual.maxHealth ?? 1));
    this.deps.effects.sparkBurst(target.x, target.y, 0xffc46b, 3);
    this.deps.onProgress?.(objective);
    if (visual.health <= 0) {
      this.complete(objective);
      this.deps.effects.explosion(target.x, target.y, 170);
      audio.play('explosion');
    }
  }

  private complete(objective: InGameObjective): void {
    if (objective.complete) return;
    objective.complete = true;
    objective.progress = objective.target;
    objective.secondsLeft = 0;
    const index = this.objectives.indexOf(objective);
    const visual = this.visuals[index];
    if (visual) {
      if (visual.target) visual.target.active = false;
      if (visual.prop) {
        visual.prop.setAlpha(0.35);
        if (objective.def.type === 'rescue') visual.prop.setTint(0x9fd0a4);
      }
      if (visual.marker) visual.marker.setTint(0x7fd8b2).setAlpha(0.7);
      if (visual.ring) visual.ring.setTint(0x7fd8b2).setAlpha(0.12);
      if (visual.label) visual.label.setColor('#7fd8b2').setText('COMPLETE');
      visual.pulse?.stop();
    }
    this.refreshExtractionLock();
    audio.play('objective');
    this.deps.scene.events.emit('notification', `OBJECTIVE COMPLETE — ${objective.def.label.toUpperCase()}`);
    this.deps.onComplete(objective);
  }

  private refreshExtractionLock(): void {
    const unlocked = this.allNonExtractComplete;
    if (unlocked && !this.extractionUnlocked) {
      this.extractionUnlocked = true;
      this.deps.scene.events.emit('notification', 'EXTRACTION UNLOCKED — PROCEED TO THE LZ');
      const index = this.objectives.findIndex((o) => o.def.type === 'extract');
      const visual = this.visuals[index];
      if (visual?.marker) visual.marker.setTint(0xffd27f);
      if (visual?.ring) visual.ring.setTint(0xffd27f).setAlpha(0.4);
      if (visual?.label) visual.label.setText('EXTRACTION — OPEN').setColor('#ffd27f');
    }
    this.extractionUnlocked = unlocked;
  }

  private surviveActive(objective: InGameObjective): boolean {
    const index = this.objectives.indexOf(objective);
    for (let i = 0; i < index; i += 1) {
      const previous = this.objectives[i];
      if (!previous || previous.def.type === 'extract' || previous.def.type === 'survive') continue;
      if (!previous.def.optional && !previous.complete) return false;
    }
    return true;
  }

  private createVisual(objective: InGameObjective): ObjectiveVisual {
    const visual: ObjectiveVisual = {};
    const scene = this.deps.scene;
    const def = objective.def;
    if (!objective.position) return visual;
    const { x, y } = objective.position;

    if (def.type === 'extract') {
      visual.ring = scene.add
        .image(x, y, 'fx_ring')
        .setTint(0x6f5f45)
        .setDisplaySize(260, 260)
        .setAlpha(0.3)
        .setDepth(y - 12)
        .setBlendMode(Phaser.BlendModes.ADD);
      visual.marker = scene.add
        .image(x, y - 54, 'icon_extract')
        .setDisplaySize(26, 26)
        .setTint(0x8a7b5d)
        .setDepth(760);
      visual.label = scene.add
        .text(x, y + 46, 'EXTRACTION — LOCKED', {
          fontFamily: 'Consolas, monospace',
          fontSize: '11px',
          color: '#8a7b5d',
          stroke: '#050708',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(760);
      return visual;
    }

    if (def.type === 'reach') {
      visual.ring = scene.add
        .image(x, y, 'fx_ring')
        .setTint(0x9fbfae)
        .setDisplaySize(220, 220)
        .setAlpha(0.26)
        .setDepth(y - 12)
        .setBlendMode(Phaser.BlendModes.ADD);
      visual.marker = scene.add
        .image(x, y - 46, 'icon_reach')
        .setDisplaySize(24, 24)
        .setTint(0x9fbfae)
        .setDepth(760);
      visual.label = scene.add
        .text(x, y + 42, def.label.toUpperCase(), {
          fontFamily: 'Consolas, monospace',
          fontSize: '10px',
          color: '#9fbfae',
          stroke: '#050708',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(760);
      this.pulse(visual.marker);
      return visual;
    }

    if (def.type === 'destroy') {
      const texture = /antenna|mast|uplink/i.test(def.label)
        ? 'obj_antenna'
        : /generator|relay|power/i.test(def.label)
          ? 'obj_generator'
          : 'obj_array';
      visual.prop = scene.add.image(x, y, texture).setDepth(y + 8);
      const size = texture === 'obj_antenna' ? 78 : 88;
      visual.prop.setDisplaySize(size, texture === 'obj_antenna' ? 100 : 74);
      visual.ring = scene.add
        .image(x, y + 12, 'fx_ring')
        .setTint(0xd06a52)
        .setDisplaySize(190, 190)
        .setAlpha(0.22)
        .setDepth(y - 12)
        .setBlendMode(Phaser.BlendModes.ADD);
      visual.label = scene.add
        .text(x, y - 68, 'DESTROY', {
          fontFamily: 'Consolas, monospace',
          fontSize: '10px',
          color: '#e0795f',
          stroke: '#050708',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(760);
      visual.health = 240;
      visual.maxHealth = 240;
      visual.target = {
        active: true,
        x,
        y,
        radius: 42,
        faction: 'enemy',
        kind: 'objective',
        onBulletHit: (damage) => this.damageDestroyable(visual.target!, damage),
      };
      return visual;
    }

    const isRescue = def.type === 'rescue';
    const texture = isRescue ? 'soldier_prisoner' : 'obj_intel';
    visual.prop = scene.add.image(x, y, texture).setDepth(y + 4);
    if (isRescue) {
      visual.prop.setDisplaySize(58, 58);
      visual.prop.setRotation(0.4);
    }
    visual.ring = scene.add
      .image(x, y, 'fx_ring')
      .setTint(isRescue ? 0x8fbf9a : 0xd7bb7a)
      .setDisplaySize(isRescue ? 130 : 108, isRescue ? 130 : 108)
      .setAlpha(0.25)
      .setDepth(y - 10)
      .setBlendMode(Phaser.BlendModes.ADD);
    visual.marker = scene.add
      .image(x, y - (isRescue ? 50 : 42), isRescue ? 'icon_rescue' : 'icon_intel')
      .setDisplaySize(22, 22)
      .setTint(isRescue ? 0x8fbf9a : 0xd7bb7a)
      .setDepth(760);
    visual.label = scene.add
      .text(x, y + (isRescue ? 46 : 38), isRescue ? 'SURVIVOR' : 'INTEL', {
        fontFamily: 'Consolas, monospace',
        fontSize: '10px',
        color: isRescue ? '#9fcfaa' : '#d7bb7a',
        stroke: '#050708',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(760);
    this.pulse(visual.ring);
    return visual;
  }

  private pulse(image?: Phaser.GameObjects.Image): void {
    if (!image) return;
    this.deps.scene.tweens.add({
      targets: image,
      alpha: 0.5,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  cleanup(): void {
    for (const visual of this.visuals) {
      visual.pulse?.stop();
      visual.marker?.destroy();
      visual.ring?.destroy();
      visual.label?.destroy();
      visual.prop?.destroy();
    }
    this.visuals.length = 0;
  }
}
