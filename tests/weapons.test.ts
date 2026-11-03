import { describe, expect, it } from 'vitest';
import { WEAPON_MAP } from '../src/data/weapons';
import { ATTACHMENT_MAP } from '../src/data/attachments';
import { WeaponRuntime, computeWeaponStats } from '../src/core/weaponRuntime';

describe('weapon runtime', () => {
  it('consumes rounds at the configured fire cadence', () => {
    const weapon = new WeaponRuntime(WEAPON_MAP.m4a1);
    expect(weapon.magazine).toBe(30);
    expect(weapon.fire()).toBe(true);
    expect(weapon.magazine).toBe(29);
    expect(weapon.fire()).toBe(false); // still on cooldown
    weapon.update(0.1);
    expect(weapon.fire()).toBe(true);
    expect(weapon.magazine).toBe(28);
  });

  it('reloads after the correct time and drains reserve', () => {
    const weapon = new WeaponRuntime(WEAPON_MAP.m4a1);
    for (let i = 0; i < 30; i += 1) {
      expect(weapon.fire()).toBe(true);
      weapon.update(0.09);
    }
    expect(weapon.magazine).toBe(0);
    expect(weapon.fire()).toBe(false);
    expect(weapon.startReload()).toBe(true);
    expect(weapon.reloading).toBe(true);
    weapon.update(2.0);
    expect(weapon.reloading).toBe(true);
    weapon.update(0.2);
    expect(weapon.reloading).toBe(false);
    expect(weapon.magazine).toBe(30);
    expect(weapon.reserve).toBe(120);
  });

  it('does not reload when full or out of reserve', () => {
    const weapon = new WeaponRuntime(WEAPON_MAP.m1911);
    expect(weapon.startReload()).toBe(false);
    weapon.reserve = 0;
    weapon.magazine = 2;
    expect(weapon.startReload()).toBe(false);
  });

  it('applies extended magazine and suppressor effects', () => {
    const base = computeWeaponStats(WEAPON_MAP.m4a1, []);
    const modded = computeWeaponStats(WEAPON_MAP.m4a1, ['ext_mag', 'suppressor', 'foregrip']);
    expect(base.magazine).toBe(30);
    expect(modded.magazine).toBe(45);
    expect(modded.noise).toBeLessThan(base.noise);
    expect(modded.recoil).toBeLessThan(base.recoil);
    expect(modded.reloadTime).toBeGreaterThan(base.reloadTime);
  });

  it('ignores attachments that are incompatible with the weapon class', () => {
    expect(ATTACHMENT_MAP.drum_mag.compatible.includes('sniper')).toBe(false);
    const withDrum = computeWeaponStats(WEAPON_MAP.m24, ['drum_mag']);
    expect(withDrum.magazine).toBe(WEAPON_MAP.m24.magazine);
  });

  it('refills to a full magazine and reserve', () => {
    const weapon = new WeaponRuntime(WEAPON_MAP.mp5, ['ext_mag']);
    weapon.magazine = 1;
    weapon.reserve = 10;
    weapon.refillAll();
    expect(weapon.magazine).toBe(weapon.stats.magazine);
    expect(weapon.reserve).toBe(weapon.stats.magazine * WEAPON_MAP.mp5.reserveMags);
  });

  it('supports burst/automatic config and pellets for all catalogue weapons', () => {
    for (const weapon of Object.values(WEAPON_MAP)) {
      const runtime = new WeaponRuntime(weapon);
      expect(runtime.stats.magazine).toBeGreaterThan(0);
      expect(runtime.stats.damage).toBeGreaterThan(0);
      expect(runtime.stats.range).toBeGreaterThan(0);
      expect(runtime.fireInterval).toBeGreaterThan(0);
    }
    expect(WEAPON_MAP.m870.pellets).toBeGreaterThan(1);
  });
});
