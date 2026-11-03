import type { DifficultyDef } from './types';

/**
 * Pure combat maths shared by gameplay, AI and tests.
 * Distances are world pixels; ranges are weapon-specific.
 */

export const RANGE_FALLOFF_START = 0.58;
export const RANGE_FALLOFF_MIN = 0.55;

/** Damage after weapon range falloff. Returns 0 beyond maximum range. */
export function damageAtRange(baseDamage: number, distance: number, range: number): number {
  if (baseDamage <= 0 || range <= 0) return 0;
  if (distance > range) return 0;
  const falloffStart = range * RANGE_FALLOFF_START;
  if (distance <= falloffStart) return baseDamage;
  const t = Math.min(1, (distance - falloffStart) / (range - falloffStart));
  return baseDamage * (1 - t * (1 - RANGE_FALLOFF_MIN));
}

/** Armour is a 0..1 damage reduction. */
export function applyArmor(damage: number, armor: number): number {
  const clamped = Math.max(0, Math.min(0.85, armor));
  return Math.max(0, damage * (1 - clamped));
}

/** Shotguns deal reduced damage per pellet beyond close range. */
export function pelletDamage(base: number, distance: number, range: number): number {
  return damageAtRange(base, distance, range);
}

export function grenadeDamage(base: number, distance: number, radius: number): number {
  if (distance >= radius) return 0;
  const t = 1 - distance / radius;
  return base * (0.28 + 0.72 * t * t);
}

export function explosionRadius(damage: number): number {
  return Math.round(90 + Math.sqrt(Math.max(0, damage)) * 4.2);
}

export function scaledEnemyHealth(base: number, difficulty: DifficultyDef): number {
  return Math.max(1, Math.round(base * difficulty.enemyHealth));
}

export function scaledEnemyDamage(base: number, difficulty: DifficultyDef): number {
  return Math.max(1, base * difficulty.enemyDamage);
}

/** Enemy accuracy is a 0..1 chance-to-hit modifier converted into angular spread. */
export function accuracySpread(baseSpreadDeg: number, accuracy: number, difficulty: DifficultyDef): number {
  const effective = Math.max(0.1, Math.min(1.5, accuracy * difficulty.enemyAccuracy));
  return baseSpreadDeg * (1.45 - effective) + 0.5;
}

/** Player movement dispersion, in degrees. */
export function movementSpreadPenalty(opts: {
  moving: boolean;
  sprinting: boolean;
  crouching: boolean;
  insideVehicle: boolean;
}): number {
  let penalty = 0;
  if (opts.insideVehicle) penalty += 3.5;
  if (opts.moving) penalty += 1.1;
  if (opts.sprinting) penalty += 2.4;
  if (opts.crouching) penalty -= 0.55;
  return Math.max(0, penalty);
}

/** Compound recoil bloom, clamped to a sane maximum in degrees. */
export function recoilBloom(current: number, kick: number): number {
  return Math.min(9, Math.max(0, current + kick));
}

export function bloomRecovery(bloom: number, dt: number, recoveryPerSecond = 6.5): number {
  return Math.max(0, bloom - recoveryPerSecond * dt);
}

export function accuracyPercent(shotsFired: number, shotsHit: number): number {
  if (shotsFired <= 0) return 0;
  return Math.round((Math.max(0, Math.min(shotsFired, shotsHit)) / shotsFired) * 100);
}

/** Linear interpolation helper used by visuals and AI. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function angleDelta(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
