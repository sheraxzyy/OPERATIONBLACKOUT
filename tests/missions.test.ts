import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../src/data/missions';
import { MAPS } from '../src/data/maps';
import {
  applyMissionCompletion,
  calculateMissionStars,
  calculateRewards,
  createDefaultSave,
  isMissionUnlocked,
  levelFromXp,
  missionRecord,
  normalizeSave,
  resolveEquipment,
  sanitizeLoadout,
  xpProgress,
} from '../src/core/progression';

describe('missions', () => {
  it('defines 20 unique campaign missions across five valid maps', () => {
    expect(MISSIONS).toHaveLength(20);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(20);
    expect(new Set(MISSIONS.map((m) => m.mapId)).size).toBe(5);
    const mapIds = new Set(MAPS.map((m) => m.id));
    expect(MISSIONS.every((m) => mapIds.has(m.mapId))).toBe(true);
    expect(MISSIONS.map((m) => m.order)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('has physical extraction objectives on valid zones', () => {
    for (const mission of MISSIONS) {
      const map = MAPS.find((m) => m.id === mission.mapId)!;
      const extract = mission.objectives.find((o) => o.type === 'extract');
      expect(extract, mission.id).toBeTruthy();
      expect(extract?.zone && map.zones[extract.zone], `${mission.id} extraction zone`).toBeTruthy();
      for (const objective of mission.objectives) {
        if (objective.zone) expect(map.zones[objective.zone], `${mission.id}/${objective.id} zone`).toBeTruthy();
        if (objective.type === 'eliminate') expect(objective.count).toBeGreaterThan(0);
        if (objective.type === 'survive') expect(objective.seconds).toBeGreaterThan(0);
      }
      expect(mission.enemyCount).toBeGreaterThan(0);
    }
  });

  it('unlocks missions linearly', () => {
    const save = createDefaultSave();
    expect(isMissionUnlocked(save, 'bw1')).toBe(true);
    expect(isMissionUnlocked(save, 'bw2')).toBe(false);
    save.missions.bw1 = { ...missionRecord(save, 'bw1'), completed: true };
    expect(isMissionUnlocked(save, 'bw2')).toBe(true);
  });

  it('calculates stars and difficulty-scaled rewards', () => {
    expect(
      calculateMissionStars({ success: false, objectiveCount: 4, completedObjectives: 4, accuracy: 0.9, timeSeconds: 10, parSeconds: 100 }),
    ).toBe(0);
    const stars = calculateMissionStars({
      success: true,
      objectiveCount: 4,
      completedObjectives: 4,
      accuracy: 0.5,
      timeSeconds: 200,
      parSeconds: 300,
    });
    expect(stars).toBe(3);
    const normal = calculateRewards(MISSIONS[0], 'medium', true, stars);
    const hard = calculateRewards(MISSIONS[0], 'hard', true, stars);
    const failed = calculateRewards(MISSIONS[0], 'hard', false, 0);
    expect(hard.credits).toBeGreaterThan(normal.credits);
    expect(hard.xp).toBeGreaterThan(normal.xp);
    expect(failed.credits).toBe(0);
  });

  it('awards progression, records and a one-time sector bonus', () => {
    let save = createDefaultSave();
    const first = applyMissionCompletion(save, {
      missionId: 'bw1',
      success: true,
      difficulty: 'medium',
      accuracy: 0.4,
      timeSeconds: 180,
      score: 2000,
      stars: 3,
      credits: 1200,
      xp: 300,
      kills: 8,
      eliteKills: 1,
      shotsFired: 100,
      shotsHit: 42,
      deaths: 0,
      vehiclesDestroyed: 0,
      rescued: 0,
      intel: 1,
    });
    save = first.save;
    expect(save.missions.bw1.completed).toBe(true);
    expect(save.credits).toBeGreaterThan(3000);
    expect(save.stats.kills).toBe(8);

    for (const id of ['bw2', 'bw3', 'bw4']) {
      const result = applyMissionCompletion(save, {
        missionId: id,
        success: true,
        difficulty: 'medium',
        accuracy: 0.5,
        timeSeconds: 200,
        score: 3000,
        stars: 2,
        credits: 1000,
        xp: 300,
        kills: 10,
        eliteKills: 0,
        shotsFired: 100,
        shotsHit: 50,
        deaths: 0,
        vehiclesDestroyed: 0,
        rescued: 0,
        intel: 0,
      });
      save = result.save;
    }
    expect(save.sectorBonuses).toContain('blackwood');
    expect(save.missions.bw4.completed).toBe(true);
    const creditsAfter = save.credits;
    const replay = applyMissionCompletion(save, {
      missionId: 'bw4',
      success: true,
      difficulty: 'hard',
      accuracy: 0.8,
      timeSeconds: 100,
      score: 5000,
      stars: 3,
      credits: 2000,
      xp: 400,
      kills: 15,
      eliteKills: 2,
      shotsFired: 100,
      shotsHit: 80,
      deaths: 0,
      vehiclesDestroyed: 0,
      rescued: 0,
      intel: 0,
    });
    expect(replay.save.credits).toBe(creditsAfter + 2000);
    expect(replay.save.sectorBonuses.filter((id) => id === 'blackwood')).toHaveLength(1);
  });

  it('repairs invalid loadouts and equipment', () => {
    const save = createDefaultSave();
    const loadout = sanitizeLoadout(
      {
        primary: 'barrett',
        secondary: 'invalid',
        sidearm: 'm1911',
        attachments: { m4a1: ['scope_8x', 'red_dot', 'red_dot'], barrett: ['scope_8x'] },
        equipment: ['medkit', 'bogus'],
        vehicle: 'apc',
      },
      save,
    );
    expect(loadout.primary).toBe('m4a1');
    expect(loadout.secondary).toBe('mp5');
    expect(loadout.attachments.m4a1).toEqual(['red_dot']);
    expect(loadout.equipment).toEqual(['medkit']);
    expect(loadout.vehicle).toBe('jeep');
  });
});

describe('progression maths', () => {
  it('increases level with XP', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(120)).toBe(2);
    expect(levelFromXp(1080)).toBe(4);
    const progress = xpProgress(500);
    expect(progress.ratio).toBeGreaterThan(0);
    expect(progress.ratio).toBeLessThanOrEqual(1);
  });

  it('resolves equipment bonuses', () => {
    const equipment = resolveEquipment(['medkit', 'frag_pack', 'armor_plate']);
    expect(equipment.medkits).toBe(3);
    expect(equipment.grenades).toBe(5);
    expect(equipment.armor).toBe(40);
  });

  it('normalises corrupted save values', () => {
    const save = normalizeSave({
      version: 999,
      credits: -40,
      xp: 'nonsense',
      unlockedWeapons: ['barrett', 'nope'],
      settings: { masterVolume: 12, cameraZoom: 9 },
    });
    expect(save.version).toBe(1);
    expect(save.credits).toBe(0);
    expect(save.xp).toBe(0);
    expect(save.unlockedWeapons).toContain('barrett');
    expect(save.unlockedWeapons).not.toContain('nope');
    expect(save.settings.masterVolume).toBe(1);
    expect(save.settings.cameraZoom).toBe(1.5);
  });
});
