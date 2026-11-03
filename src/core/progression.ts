import type {
  DifficultyId,
  Keybinds,
  Loadout,
  MissionDef,
  MissionRecord,
  PlayerStats,
  SaveData,
  SaveSettings,
  WeaponClass,
} from './types';
import { DEFAULT_KEYBINDS, validateKeybinds } from './keybinds';
import { ATTACHMENT_MAP } from '../data/attachments';
import { EQUIPMENT_MAP } from '../data/equipment';
import { MISSIONS, getMission } from '../data/missions';
import { VEHICLE_MAP } from '../data/vehicles';
import { WEAPONS, WEAPON_MAP } from '../data/weapons';

export const SAVE_VERSION = 1;
export const MAX_ATTACHMENTS_PER_WEAPON = 3;

export const DEFAULT_SETTINGS: SaveSettings = {
  masterVolume: 0.7,
  musicVolume: 0.38,
  sfxVolume: 0.8,
  cameraZoom: 1,
  screenShake: true,
  weatherEffects: true,
  highQuality: true,
  showFps: false,
  crosshairColor: '#e8dcc0',
};

export function createDefaultLoadout(): Loadout {
  return {
    primary: 'm4a1',
    secondary: 'mp5',
    sidearm: 'm1911',
    attachments: { m4a1: ['red_dot'] },
    equipment: ['medkit', 'frag_pack'],
    vehicle: 'jeep',
  };
}

export function createDefaultStats(): PlayerStats {
  return {
    missionsCompleted: 0,
    missionsFailed: 0,
    kills: 0,
    eliteKills: 0,
    shotsFired: 0,
    shotsHit: 0,
    deaths: 0,
    vehiclesDestroyed: 0,
    distanceTravelled: 0,
    playSeconds: 0,
    grenadeKills: 0,
    rescues: 0,
    intelRecovered: 0,
    wavesSurvived: 0,
    trainingBest: 0,
    survivalBest: 0,
    starsEarned: 0,
  };
}

export function createDefaultSave(now = Date.now()): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    credits: 3000,
    xp: 0,
    unlockedWeapons: ['m4a1', 'mp5', 'm1911'],
    unlockedAttachments: ['red_dot', 'flashlight'],
    unlockedEquipment: ['medkit', 'frag_pack'],
    unlockedVehicles: ['jeep'],
    loadout: createDefaultLoadout(),
    missions: {},
    sectorBonuses: [],
    stats: createDefaultStats(),
    settings: { ...DEFAULT_SETTINGS },
    keybinds: { ...DEFAULT_KEYBINDS },
  };
}

/** Level curve: level 1 at 0 XP, level 2 at 120 XP, level 12 at ~14.5k. */
export function levelFromXp(xp: number): number {
  const safe = Math.max(0, Number.isFinite(xp) ? xp : 0);
  return Math.max(1, Math.floor(Math.sqrt(safe / 120)) + 1);
}

export function xpForLevel(level: number): number {
  return Math.max(0, Math.round(120 * (level - 1) ** 2));
}

export function xpProgress(xp: number): { level: number; current: number; needed: number; ratio: number } {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const needed = Math.max(1, next - floor);
  return {
    level,
    current: Math.max(0, xp - floor),
    needed,
    ratio: Math.max(0, Math.min(1, (xp - floor) / needed)),
  };
}

export function missionRecord(save: SaveData, missionId: string): MissionRecord {
  return (
    save.missions[missionId] ?? {
      completed: false,
      bestScore: 0,
      stars: 0,
      attempts: 0,
      bestTime: 0,
      difficulty: null,
    }
  );
}

export function isMissionUnlocked(save: SaveData, missionId: string): boolean {
  const mission = getMission(missionId);
  if (mission.order <= 1) return true;
  const previous = MISSIONS.find((m) => m.order === mission.order - 1);
  if (!previous) return true;
  return missionRecord(save, previous.id).completed;
}

export function nextMissionId(missionId: string): string | undefined {
  const current = getMission(missionId);
  return MISSIONS.find((m) => m.order === current.order + 1)?.id;
}

export function isWeaponOwned(save: SaveData, weaponId: string): boolean {
  return save.unlockedWeapons.includes(weaponId);
}

export function weaponUnlockLevel(weaponId: string): number {
  return WEAPON_MAP[weaponId]?.levelReq ?? 1;
}

export function canBuyWeapon(save: SaveData, weaponId: string): { ok: boolean; reason: string } {
  const weapon = WEAPON_MAP[weaponId];
  if (!weapon) return { ok: false, reason: 'Unknown weapon' };
  if (save.unlockedWeapons.includes(weaponId)) return { ok: false, reason: 'Already owned' };
  if (levelFromXp(save.xp) < weapon.levelReq) return { ok: false, reason: `Requires level ${weapon.levelReq}` };
  if (save.credits < weapon.price) return { ok: false, reason: 'Insufficient credits' };
  return { ok: true, reason: '' };
}

export function canBuyAttachment(save: SaveData, id: string): { ok: boolean; reason: string } {
  const item = ATTACHMENT_MAP[id];
  if (!item) return { ok: false, reason: 'Unknown attachment' };
  if (save.unlockedAttachments.includes(id)) return { ok: false, reason: 'Already owned' };
  if (levelFromXp(save.xp) < item.levelReq) return { ok: false, reason: `Requires level ${item.levelReq}` };
  if (save.credits < item.price) return { ok: false, reason: 'Insufficient credits' };
  return { ok: true, reason: '' };
}

export function canBuyEquipment(save: SaveData, id: string): { ok: boolean; reason: string } {
  const item = EQUIPMENT_MAP[id];
  if (!item) return { ok: false, reason: 'Unknown equipment' };
  if (save.unlockedEquipment.includes(id)) return { ok: false, reason: 'Already owned' };
  if (levelFromXp(save.xp) < item.levelReq) return { ok: false, reason: `Requires level ${item.levelReq}` };
  if (save.credits < item.price) return { ok: false, reason: 'Insufficient credits' };
  return { ok: true, reason: '' };
}

export function canBuyVehicle(save: SaveData, id: string): { ok: boolean; reason: string } {
  const item = VEHICLE_MAP[id];
  if (!item) return { ok: false, reason: 'Unknown vehicle' };
  if (save.unlockedVehicles.includes(id)) return { ok: false, reason: 'Already owned' };
  if (levelFromXp(save.xp) < item.levelReq) return { ok: false, reason: `Requires level ${item.levelReq}` };
  if (save.credits < item.price) return { ok: false, reason: 'Insufficient credits' };
  return { ok: true, reason: '' };
}

/** Ensure the three weapon slots are filled with owned weapons of the right role. */
export function sanitizeLoadout(loadout: unknown, save: SaveData): Loadout {
  const fallback = createDefaultLoadout();
  if (!loadout || typeof loadout !== 'object') return fallback;
  const raw = loadout as Partial<Loadout>;
  const owned = (id: unknown, cls: WeaponClass): string => {
    if (typeof id !== 'string') return WEAPONS.find((w) => w.class === cls && save.unlockedWeapons.includes(w.id))?.id ?? fallback.primary;
    return save.unlockedWeapons.includes(id) ? id : WEAPONS.find((w) => w.class === cls && save.unlockedWeapons.includes(w.id))?.id ?? fallback.primary;
  };
  const attachments: Record<string, string[]> = {};
  if (raw.attachments && typeof raw.attachments === 'object') {
    for (const [weaponId, list] of Object.entries(raw.attachments)) {
      if (!save.unlockedWeapons.includes(weaponId) || !Array.isArray(list)) continue;
      const weapon = WEAPON_MAP[weaponId];
      const valid = list
        .filter((id): id is string => typeof id === 'string' && Boolean(ATTACHMENT_MAP[id]))
        .filter((id) => save.unlockedAttachments.includes(id))
        .filter((id) => ATTACHMENT_MAP[id].compatible.includes(weapon.class));
      attachments[weaponId] = [...new Set(valid)].slice(0, MAX_ATTACHMENTS_PER_WEAPON);
    }
  }
  const equipment = Array.isArray(raw.equipment)
    ? [...new Set(raw.equipment.filter((id): id is string => typeof id === 'string' && save.unlockedEquipment.includes(id)))].slice(0, 2)
    : [...fallback.equipment];
  const vehicle = typeof raw.vehicle === 'string' && save.unlockedVehicles.includes(raw.vehicle) ? raw.vehicle : 'jeep';
  return {
    primary: owned(raw.primary, 'assault'),
    secondary: owned(raw.secondary, 'smg'),
    sidearm: owned(raw.sidearm, 'pistol'),
    attachments,
    equipment,
    vehicle,
  };
}

function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringArray(value: unknown, valid: Set<string>, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && valid.has(v)))];
}

/**
 * Validate and repair arbitrary save data. Unknown / invalid fields fall back
 * to safe defaults instead of throwing. This is the only path by which raw
 * persisted data enters the application.
 */
export function normalizeSave(input: unknown, now = Date.now()): SaveData {
  const fallback = createDefaultSave(now);
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Record<string, unknown>;
  // Future versions are recovered into the current schema rather than trusted.
  const version = numberIn(raw.version, 1, SAVE_VERSION, SAVE_VERSION);

  const weaponIds = new Set(WEAPONS.map((w) => w.id));
  const attachmentIds = new Set(Object.keys(ATTACHMENT_MAP));
  const equipmentIds = new Set(Object.keys(EQUIPMENT_MAP));
  const vehicleIds = new Set(Object.keys(VEHICLE_MAP));

  const unlockedWeapons = stringArray(raw.unlockedWeapons, weaponIds, fallback.unlockedWeapons);
  // Always guarantee the core loadout is available.
  for (const id of fallback.unlockedWeapons) if (!unlockedWeapons.includes(id)) unlockedWeapons.push(id);

  const unlockedAttachments = stringArray(raw.unlockedAttachments, attachmentIds, fallback.unlockedAttachments);
  const unlockedEquipment = stringArray(raw.unlockedEquipment, equipmentIds, fallback.unlockedEquipment);
  const unlockedVehicles = stringArray(raw.unlockedVehicles, vehicleIds, fallback.unlockedVehicles);
  if (!unlockedVehicles.includes('jeep')) unlockedVehicles.push('jeep');

  const save: SaveData = {
    ...fallback,
    version,
    createdAt: numberIn(raw.createdAt, 0, Number.MAX_SAFE_INTEGER, fallback.createdAt),
    updatedAt: numberIn(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER, fallback.updatedAt),
    credits: Math.round(numberIn(raw.credits, 0, 99_999_999, fallback.credits)),
    xp: Math.round(numberIn(raw.xp, 0, 99_999_999, fallback.xp)),
    unlockedWeapons,
    unlockedAttachments,
    unlockedEquipment,
    unlockedVehicles,
    missions: normalizeMissions(raw.missions),
    sectorBonuses: Array.isArray(raw.sectorBonuses)
      ? [...new Set(raw.sectorBonuses.filter((id): id is import('./types').MapId => ['blackwood', 'dead_district', 'iron_fortress', 'dust_valley', 'zero_point'].includes(String(id))))]
      : [],
    stats: normalizeStats(raw.stats),
    settings: normalizeSettings(raw.settings),
    keybinds: validateKeybinds(raw.keybinds),
  };
  save.loadout = sanitizeLoadout(raw.loadout, save);
  return save;
}

function normalizeStats(input: unknown): PlayerStats {
  const fallback = createDefaultStats();
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Record<string, unknown>;
  const out = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof PlayerStats)[]) {
    out[key] = Math.round(numberIn(raw[key], 0, 99_999_999, fallback[key]));
  }
  return out;
}

function normalizeSettings(input: unknown): SaveSettings {
  const fallback = { ...DEFAULT_SETTINGS };
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Record<string, unknown>;
  const color = typeof raw.crosshairColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.crosshairColor)
    ? raw.crosshairColor
    : fallback.crosshairColor;
  return {
    masterVolume: numberIn(raw.masterVolume, 0, 1, fallback.masterVolume),
    musicVolume: numberIn(raw.musicVolume, 0, 1, fallback.musicVolume),
    sfxVolume: numberIn(raw.sfxVolume, 0, 1, fallback.sfxVolume),
    cameraZoom: numberIn(raw.cameraZoom, 0.75, 1.5, fallback.cameraZoom),
    screenShake: bool(raw.screenShake, fallback.screenShake),
    weatherEffects: bool(raw.weatherEffects, fallback.weatherEffects),
    highQuality: bool(raw.highQuality, fallback.highQuality),
    showFps: bool(raw.showFps, fallback.showFps),
    crosshairColor: color,
  };
}

function normalizeMissions(input: unknown): Record<string, MissionRecord> {
  const out: Record<string, MissionRecord> = {};
  if (!input || typeof input !== 'object') return out;
  const raw = input as Record<string, unknown>;
  for (const mission of MISSIONS) {
    const entry = raw[mission.id];
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    out[mission.id] = {
      completed: bool(rec.completed, false),
      bestScore: Math.round(numberIn(rec.bestScore, 0, 99_999_999, 0)),
      stars: Math.round(numberIn(rec.stars, 0, 3, 0)),
      attempts: Math.round(numberIn(rec.attempts, 0, 9999, 0)),
      bestTime: numberIn(rec.bestTime, 0, 9_999_999, 0),
      difficulty:
        rec.difficulty === 'easy' || rec.difficulty === 'medium' || rec.difficulty === 'hard'
          ? (rec.difficulty as DifficultyId)
          : null,
    };
  }
  return out;
}

export interface RewardBreakdown {
  credits: number;
  xp: number;
  stars: number;
  score: number;
}

export function calculateMissionStars(opts: {
  success: boolean;
  objectiveCount: number;
  completedObjectives: number;
  accuracy: number;
  timeSeconds: number;
  parSeconds: number;
}): number {
  if (!opts.success) return 0;
  if (opts.objectiveCount > 0 && opts.completedObjectives < opts.objectiveCount) return 0;
  let stars = 1;
  if (opts.accuracy >= 0.35) stars += 1;
  if (opts.timeSeconds <= opts.parSeconds) stars += 1;
  return Math.max(1, Math.min(3, stars));
}

export function calculateRewards(
  mission: MissionDef,
  difficulty: DifficultyId,
  success: boolean,
  stars: number,
): RewardBreakdown {
  if (!success) return { credits: 0, xp: 0, stars: 0, score: 0 };
  const diff = difficulty === 'hard' ? 1.45 : difficulty === 'easy' ? 0.8 : 1;
  const starBonus = 0.75 + Math.max(1, Math.min(3, stars)) * 0.15;
  return {
    credits: Math.round(mission.rewards.credits * diff * starBonus),
    xp: Math.round(mission.rewards.xp * diff * starBonus),
    stars: Math.max(1, Math.min(3, stars)),
    score: Math.round((mission.rewards.credits + mission.rewards.xp * 2) * starBonus * diff),
  };
}

export function applyMissionCompletion(
  save: SaveData,
  opts: {
    missionId: string;
    success: boolean;
    difficulty: DifficultyId;
    accuracy: number;
    timeSeconds: number;
    score: number;
    stars: number;
    credits: number;
    xp: number;
    kills: number;
    eliteKills: number;
    shotsFired: number;
    shotsHit: number;
    deaths: number;
    vehiclesDestroyed: number;
    rescued: number;
    intel: number;
  },
): { save: SaveData; newUnlocks: string[] } {
  const mission = getMission(opts.missionId);
  const next = structuredCloneSave(save);
  const record = missionRecord(next, opts.missionId);
  record.attempts += 1;
  if (opts.success) {
    record.completed = true;
    record.stars = Math.max(record.stars, opts.stars);
    record.bestScore = Math.max(record.bestScore, opts.score);
    if (!record.bestTime || record.bestTime > opts.timeSeconds) record.bestTime = opts.timeSeconds;
    record.difficulty = opts.difficulty;
    next.credits += opts.credits;
    next.xp += opts.xp;
    next.stats.missionsCompleted += 1;
    next.stats.starsEarned = Object.values(next.missions).reduce((sum, m) => sum + Math.max(0, m.stars), 0);
    next.stats.kills += opts.kills;
    next.stats.eliteKills += opts.eliteKills;
    next.stats.shotsFired += opts.shotsFired;
    next.stats.shotsHit += opts.shotsHit;
    next.stats.vehiclesDestroyed += opts.vehiclesDestroyed;
    next.stats.rescues += opts.rescued;
    next.stats.intelRecovered += opts.intel;
    next.stats.playSeconds += Math.round(opts.timeSeconds);
  } else {
    next.stats.missionsFailed += 1;
    next.stats.playSeconds += Math.round(opts.timeSeconds);
  }
  next.missions[mission.id] = record;

  const newUnlocks: string[] = [];
  // Region completion awards a one-time clearance bonus.
  const regionIds = MISSIONS.filter((m) => m.mapId === mission.mapId).map((m) => m.id);
  const regionComplete = regionIds.every((id) => missionRecord(next, id).completed);
  if (regionComplete && !next.sectorBonuses.includes(mission.mapId)) {
    next.sectorBonuses.push(mission.mapId);
    const bonus = 1500;
    next.credits += bonus;
    newUnlocks.push(`SECTOR CLEARANCE BONUS +${bonus.toLocaleString()} CR`);
  }
  next.updatedAt = Date.now();
  return { save: next, newUnlocks };
}

export function structuredCloneSave(save: SaveData): SaveData {
  return JSON.parse(JSON.stringify(save)) as SaveData;
}

export function purchaseWeapon(save: SaveData, id: string): boolean {
  const check = canBuyWeapon(save, id);
  if (!check.ok) return false;
  const weapon = WEAPON_MAP[id];
  save.credits -= weapon.price;
  save.unlockedWeapons.push(id);
  save.updatedAt = Date.now();
  return true;
}

export function purchaseAttachment(save: SaveData, id: string): boolean {
  const check = canBuyAttachment(save, id);
  if (!check.ok) return false;
  const item = ATTACHMENT_MAP[id];
  save.credits -= item.price;
  save.unlockedAttachments.push(id);
  save.updatedAt = Date.now();
  return true;
}

export function purchaseEquipment(save: SaveData, id: string): boolean {
  const check = canBuyEquipment(save, id);
  if (!check.ok) return false;
  const item = EQUIPMENT_MAP[id];
  save.credits -= item.price;
  save.unlockedEquipment.push(id);
  save.updatedAt = Date.now();
  return true;
}

export function purchaseVehicle(save: SaveData, id: string): boolean {
  const check = canBuyVehicle(save, id);
  if (!check.ok) return false;
  const item = VEHICLE_MAP[id];
  save.credits -= item.price;
  save.unlockedVehicles.push(id);
  save.updatedAt = Date.now();
  return true;
}

/** Equipment effects applied to a run. */
export function resolveEquipment(ids: string[]): {
  bonusHealth: number;
  armor: number;
  grenades: number;
  medkits: number;
  reserveMags: number;
  staminaRegen: number;
  speed: number;
} {
  const out = { bonusHealth: 0, armor: 0, grenades: 2, medkits: 1, reserveMags: 0, staminaRegen: 1, speed: 1 };
  for (const id of ids) {
    const item = EQUIPMENT_MAP[id];
    if (!item) continue;
    out.bonusHealth += item.effects.bonusHealth ?? 0;
    out.armor += item.effects.armor ?? 0;
    out.grenades += item.effects.grenades ?? 0;
    out.medkits += item.effects.medkits ?? 0;
    out.reserveMags += item.effects.reserveMags ?? 0;
    out.staminaRegen += item.effects.staminaRegen ?? 0;
    out.speed += item.effects.speed ?? 0;
  }
  return out;
}

export function setLoadoutAttachment(loadout: Loadout, weaponId: string, attachmentId: string): Loadout {
  const list = loadout.attachments[weaponId] ?? [];
  const next = list.includes(attachmentId) ? list.filter((id) => id !== attachmentId) : [...list, attachmentId].slice(-MAX_ATTACHMENTS_PER_WEAPON);
  return { ...loadout, attachments: { ...loadout.attachments, [weaponId]: next } };
}

export function difficultyLabel(id: DifficultyId): string {
  return id === 'easy' ? 'RECRUIT' : id === 'hard' ? 'BLACK OPS' : 'OPERATOR';
}

export function resetSaveProgress(save: SaveData): SaveData {
  const fresh = createDefaultSave(Date.now());
  // Keep player preferences and controls across a progress reset.
  fresh.settings = { ...save.settings };
  fresh.keybinds = { ...save.keybinds };
  fresh.createdAt = save.createdAt;
  return fresh;
}
