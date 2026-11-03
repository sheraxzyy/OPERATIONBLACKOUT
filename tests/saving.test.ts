import { describe, expect, it } from 'vitest';
import { MemoryStorage, SAVE_KEY, SaveService, parseSave } from '../src/core/save';
import { createDefaultSave, normalizeSave } from '../src/core/progression';

describe('persistence', () => {
  it('uses safe defaults when no save exists', async () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage, { read: async () => null, write: async () => {}, clear: async () => {} } as never);
    const result = await service.load();
    expect(result.source).toBe('default');
    expect(result.save.version).toBe(1);
    expect(result.save.credits).toBe(3000);
    expect(storage.getItem(SAVE_KEY)).toBeTruthy();
  });

  it('saves and reloads data through local storage', async () => {
    const storage = new MemoryStorage();
    const mirror = { read: async () => null, write: async () => {}, clear: async () => {} };
    const service = new SaveService(storage, mirror as never);
    const save = createDefaultSave();
    save.credits = 4321;
    save.stats.kills = 12;
    service.save(save);

    const reloaded = await service.load();
    expect(reloaded.save.credits).toBe(4321);
    expect(reloaded.save.stats.kills).toBe(12);
    expect(reloaded.repaired).toBe(false);
  });

  it('recovers from corrupt local data using the IndexedDB mirror', async () => {
    const storage = new MemoryStorage();
    const valid = createDefaultSave();
    valid.credits = 7777;
    const mirror = {
      read: async () => JSON.stringify(valid),
      write: async () => {},
      clear: async () => {},
    };
    storage.setItem(SAVE_KEY, '{this is not json');
    const service = new SaveService(storage, mirror as never);
    const result = await service.load();
    expect(result.source).toBe('indexeddb');
    expect(result.save.credits).toBe(7777);
    expect(result.repaired).toBe(true);
    expect(parseSave(storage.getItem(SAVE_KEY))?.credits).toBe(7777);
  });

  it('repairs arbitrary malformed structures without throwing', () => {
    expect(() => normalizeSave(null)).not.toThrow();
    expect(() => normalizeSave('nope')).not.toThrow();
    expect(() => normalizeSave({ loadout: { primary: 5 }, missions: [] })).not.toThrow();
    const repaired = normalizeSave({ keybinds: { moveUp: 'KeyW', moveDown: 'KeyW' } });
    expect(new Set(Object.values(repaired.keybinds)).size).toBe(Object.values(repaired.keybinds).length);
  });

  it('migrates old versioned data into the current schema', () => {
    const save = normalizeSave({ version: 0, credits: 1500, unlockedWeapons: ['m4a1'] });
    expect(save.version).toBe(1);
    expect(save.unlockedWeapons).toEqual(expect.arrayContaining(['m4a1', 'mp5', 'm1911']));
    expect(save.settings.sfxVolume).toBeGreaterThan(0);
  });
});
