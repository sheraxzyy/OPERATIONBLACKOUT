import { describe, expect, it } from 'vitest';
import {
  accuracySpread,
  applyArmor,
  damageAtRange,
  grenadeDamage,
  movementSpreadPenalty,
  recoilBloom,
  bloomRecovery,
  scaledEnemyDamage,
  scaledEnemyHealth,
} from '../src/core/combat';
import { DIFFICULTY_MAP } from '../src/data/enemies';

describe('combat maths', () => {
  it('deals full damage inside the falloff threshold', () => {
    expect(damageAtRange(30, 100, 1000)).toBe(30);
    expect(damageAtRange(30, 580, 1000)).toBe(30);
  });

  it('falls off with distance and stops beyond range', () => {
    const near = damageAtRange(30, 600, 1000);
    const far = damageAtRange(30, 950, 1000);
    expect(near).toBeLessThan(30);
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(15);
    expect(damageAtRange(30, 1001, 1000)).toBe(0);
  });

  it('applies armour with a safety clamp', () => {
    expect(applyArmor(100, 0.25)).toBe(75);
    expect(applyArmor(100, 0)).toBe(100);
    expect(applyArmor(100, 0.99)).toBeCloseTo(15);
  });

  it('reduces grenade damage radially', () => {
    expect(grenadeDamage(100, 0, 200)).toBe(100);
    expect(grenadeDamage(100, 100, 200)).toBeGreaterThan(30);
    expect(grenadeDamage(100, 100, 200)).toBeLessThan(60);
    expect(grenadeDamage(100, 200, 200)).toBe(0);
  });

  it('scales enemy survivability by difficulty', () => {
    const easy = DIFFICULTY_MAP.easy;
    const hard = DIFFICULTY_MAP.hard;
    expect(scaledEnemyHealth(100, easy)).toBe(72);
    expect(scaledEnemyHealth(100, hard)).toBe(132);
    expect(scaledEnemyDamage(10, hard)).toBeGreaterThan(scaledEnemyDamage(10, easy));
  });

  it('awards tighter spreads to more accurate enemies', () => {
    const medium = DIFFICULTY_MAP.medium;
    expect(accuracySpread(4, 0.9, medium)).toBeLessThan(accuracySpread(4, 0.4, medium));
  });

  it('adds movement dispersion and recovers bloom', () => {
    expect(movementSpreadPenalty({ moving: false, sprinting: false, crouching: false, insideVehicle: false })).toBe(0);
    expect(movementSpreadPenalty({ moving: true, sprinting: true, crouching: false, insideVehicle: false })).toBeCloseTo(3.5);
    expect(recoilBloom(8.8, 1)).toBe(9);
    expect(bloomRecovery(5, 1)).toBe(0);
  });
});
