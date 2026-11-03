import type { AttachmentDef, WeaponDef } from './types';
import { ATTACHMENT_MAP } from '../data/attachments';

export interface WeaponStats {
  damage: number;
  spread: number;
  recoil: number;
  magazine: number;
  reloadTime: number;
  range: number;
  noise: number;
  adsZoom: number;
  flashlight: boolean;
  laser: boolean;
}

export interface WeaponRuntimeOptions {
  /**
   * Equipment that increases carried reserve ammunition. Expressed as extra
   * magazines, matching the equipment description.
   */
  extraReserveMags?: number;
}

/** Compute weapon stats with a list of attached modules. Pure and testable. */
export function computeWeaponStats(
  weapon: WeaponDef,
  attachmentIds: string[],
  equipment: { extraReserveMags?: number } = {},
): WeaponStats {
  const attachments = attachmentIds
    .map((id) => ATTACHMENT_MAP[id])
    .filter((a): a is AttachmentDef => Boolean(a) && a.compatible.includes(weapon.class));

  let damage = weapon.damage;
  let spreadMult = 1;
  let recoilMult = 1;
  let magazineMult = 1;
  let reloadMult = 1;
  let range = weapon.range;
  let noiseMult = 1;
  let adsZoom = 0;
  let flashlight = false;
  let laser = false;

  for (const attachment of attachments) {
    const fx = attachment.effects;
    if (fx.damage) damage += fx.damage;
    if (fx.spread) spreadMult += fx.spread;
    if (fx.recoil) recoilMult += fx.recoil;
    if (fx.magazine) magazineMult += fx.magazine;
    if (fx.reloadTime) reloadMult += fx.reloadTime;
    if (fx.range) range += fx.range;
    if (fx.noise) noiseMult += fx.noise;
    if (fx.adsZoom) adsZoom += fx.adsZoom;
    if (fx.flashlight) flashlight = true;
    if (fx.laser) laser = true;
  }

  // Extra reserve magazines are intentionally not part of the visible stats but
  // are consumed by WeaponRuntime when initialising reserve ammunition.
  void equipment;

  return {
    damage: Math.max(1, Math.round(damage)),
    spread: Math.max(0.05, weapon.spread * spreadMult),
    recoil: Math.max(0.1, weapon.recoil * recoilMult),
    magazine: Math.max(1, Math.round(weapon.magazine * magazineMult)),
    reloadTime: Math.max(0.5, weapon.reloadTime * reloadMult),
    range: Math.round(range),
    noise: Math.max(80, Math.round(weapon.noise * Math.max(0.08, noiseMult))),
    adsZoom: Math.max(0, adsZoom),
    flashlight,
    laser,
  };
}

/**
 * Mutable state machine for one weapon: ammunition, firing cadence and reload
 * progress. Engine independent so combat/save tests can drive it directly.
 */
export class WeaponRuntime {
  readonly weapon: WeaponDef;
  readonly attachmentIds: string[];
  readonly stats: WeaponStats;
  magazine: number;
  reserve: number;
  cooldown = 0;
  reloading = false;
  reloadRemaining = 0;
  reloadDuration = 0;
  shotCount = 0;

  constructor(weapon: WeaponDef, attachmentIds: string[] = [], options: WeaponRuntimeOptions = {}) {
    this.weapon = weapon;
    this.attachmentIds = attachmentIds.slice(0, 4);
    this.stats = computeWeaponStats(weapon, this.attachmentIds);
    const reserveMags = Math.max(1, weapon.reserveMags + (options.extraReserveMags ?? 0));
    this.reserve = this.stats.magazine * reserveMags;
    this.magazine = this.stats.magazine;
  }

  get fireInterval(): number {
    return 60 / Math.max(1, this.weapon.fireRate);
  }

  get isReloading(): boolean {
    return this.reloading;
  }

  get empty(): boolean {
    return this.magazine <= 0 && this.reserve <= 0;
  }

  get reloadProgress(): number {
    if (!this.reloading || this.reloadDuration <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - this.reloadRemaining / this.reloadDuration));
  }

  update(dt: number): void {
    const delta = Math.max(0, dt);
    this.cooldown = Math.max(0, this.cooldown - delta);
    if (this.reloading) {
      this.reloadRemaining -= delta;
      if (this.reloadRemaining <= 0) this.finishReload();
    }
  }

  canFire(): boolean {
    return !this.reloading && this.cooldown <= 0 && this.magazine > 0;
  }

  /** Consume a round if possible. Returns false on empty magazine / cooldown. */
  fire(): boolean {
    if (!this.canFire()) return false;
    this.magazine -= 1;
    this.cooldown = Math.max(0.015, this.fireInterval);
    this.shotCount += 1;
    return true;
  }

  startReload(): boolean {
    if (this.reloading || this.magazine >= this.stats.magazine || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadDuration = this.stats.reloadTime;
    this.reloadRemaining = this.stats.reloadTime;
    return true;
  }

  private finishReload(): void {
    const needed = this.stats.magazine - this.magazine;
    const loaded = Math.min(needed, this.reserve);
    this.magazine += loaded;
    this.reserve -= loaded;
    this.reloading = false;
    this.reloadRemaining = 0;
    this.reloadDuration = 0;
  }

  cancelReload(): void {
    this.reloading = false;
    this.reloadRemaining = 0;
    this.reloadDuration = 0;
  }

  addReserve(rounds: number): void {
    this.reserve = Math.max(0, this.reserve + Math.round(rounds));
  }

  refillAll(): void {
    this.magazine = this.stats.magazine;
    this.reserve = this.stats.magazine * Math.max(1, this.weapon.reserveMags);
    this.cancelReload();
    this.cooldown = 0;
  }
}
