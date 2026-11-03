/**
 * Shared, engine-agnostic type definitions.
 * Everything in this file is pure data so it can be unit tested without Phaser.
 */

export type WeaponClass = 'assault' | 'smg' | 'sniper' | 'shotgun' | 'lmg' | 'pistol';

export interface AttachmentEffects {
  damage?: number;
  spread?: number;
  recoil?: number;
  range?: number;
  magazine?: number;
  reloadTime?: number;
  noise?: number;
  adsZoom?: number;
  flashlight?: boolean;
  laser?: boolean;
}

export type AttachmentType =
  | 'sight'
  | 'scope'
  | 'suppressor'
  | 'magazine'
  | 'grip'
  | 'flashlight'
  | 'laser';

export interface WeaponDef {
  id: string;
  name: string;
  class: WeaponClass;
  origin: string;
  damage: number;
  /** Rounds per minute. */
  fireRate: number;
  automatic: boolean;
  /** Base dispersion in degrees at the muzzle. */
  spread: number;
  /** Vertical recoil kick in degrees per shot. */
  recoil: number;
  magazine: number;
  reloadTime: number;
  /** Extra reserve magazines carried for this weapon. */
  reserveMags: number;
  range: number;
  projectileSpeed: number;
  pellets: number;
  noise: number;
  price: number;
  levelReq: number;
  description: string;
  tags: string[];
}

export interface AttachmentDef {
  id: string;
  name: string;
  type: AttachmentType;
  price: number;
  levelReq: number;
  compatible: WeaponClass[];
  effects: AttachmentEffects;
  description: string;
}

export type EquipmentSlot = 'consumable' | 'armor' | 'utility';

export interface EquipmentDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  price: number;
  levelReq: number;
  description: string;
  effects: {
    bonusHealth?: number;
    armor?: number;
    grenades?: number;
    medkits?: number;
    reserveMags?: number;
    staminaRegen?: number;
    speed?: number;
  };
}

export interface VehicleDef {
  id: string;
  name: string;
  role: string;
  topSpeed: number;
  reverseSpeed: number;
  acceleration: number;
  turnRate: number;
  health: number;
  armor: number;
  seats: number;
  weapon: 'none' | 'mg' | 'heavy_mg' | 'cannon';
  weaponDamage: number;
  price: number;
  levelReq: number;
  description: string;
  length: number;
  width: number;
}

export type EnemyClass = 'patrol' | 'guard' | 'assault' | 'sniper' | 'heavy';

export interface EnemyClassDef {
  id: EnemyClass;
  name: string;
  health: number;
  speed: number;
  damage: number;
  accuracy: number;
  visionRange: number;
  fov: number;
  reaction: number;
  fireRate: number;
  burst: number;
  preferredRange: number;
  coverBias: number;
  canFlank: boolean;
  canRetreat: boolean;
  scoreValue: number;
  description: string;
}

export type DifficultyId = 'easy' | 'medium' | 'hard';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  tagline: string;
  enemyHealth: number;
  enemyDamage: number;
  enemyAccuracy: number;
  detection: number;
  reaction: number;
  reinforcementRate: number;
  rewardMultiplier: number;
  scoreMultiplier: number;
  description: string;
}

export type ObjectiveType = 'eliminate' | 'intel' | 'rescue' | 'destroy' | 'reach' | 'survive' | 'extract';

export interface ObjectiveDef {
  id: string;
  type: ObjectiveType;
  label: string;
  /** Named map zone for spatial objectives. */
  zone?: string;
  count?: number;
  seconds?: number;
  optional?: boolean;
  hint?: string;
}

export type MapId = 'blackwood' | 'dead_district' | 'iron_fortress' | 'dust_valley' | 'zero_point';
export type TimeOfDay = 'day' | 'dusk' | 'night';
export type Weather = 'clear' | 'rain' | 'fog' | 'sandstorm' | 'snow' | 'storm';
export type GameMode = 'campaign' | 'survival' | 'training' | 'freeplay';

export interface MissionDef {
  id: string;
  mapId: MapId;
  order: number;
  regionOrder: number;
  codename: string;
  name: string;
  briefing: string;
  intel: string;
  objectives: ObjectiveDef[];
  enemyCount: number;
  enemyMix: EnemyClass[];
  eliteChance: number;
  rewards: { credits: number; xp: number };
  recommendedLevel: number;
  timeOfDay: TimeOfDay;
  weather: Weather;
}

export interface RoadDef {
  x: number;
  y: number;
  w: number;
  h: number;
  style: 'asphalt' | 'dirt' | 'concrete';
}

export interface DoorDef {
  side: 'n' | 's' | 'e' | 'w';
  /** Door centre in tile units along the wall. */
  offset: number;
  width: number;
}

export interface BuildingDef {
  x: number;
  y: number;
  w: number;
  h: number;
  style: 'cabin' | 'ruin' | 'barracks' | 'hangar' | 'lab' | 'adobe' | 'warehouse' | 'command';
  doors: DoorDef[];
  label?: string;
  interiorProps?: number;
  /** Optional interior partition lines (tile coordinates, relative to building). */
  partitions?: { axis: 'v' | 'h'; at: number; gap: number }[];
}

export interface PropDef {
  type:
    | 'tree'
    | 'pine'
    | 'rock'
    | 'crate'
    | 'barrel'
    | 'sandbag'
    | 'car_wreck'
    | 'container'
    | 'cactus'
    | 'snow_pine'
    | 'debris'
    | 'tower';
  x: number;
  y: number;
  /** Additional visual rotation. */
  rot?: number;
  solid?: boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  region: string;
  env: 'forest' | 'urban' | 'fortress' | 'desert' | 'arctic';
  cols: number;
  rows: number;
  tile: number;
  accent: number;
  palette: {
    ground: string;
    groundAlt: string;
    road: string;
    wall: string;
    wallTop: string;
    floor: string;
    fog: number;
    light: number;
  };
  buildings: BuildingDef[];
  roads: RoadDef[];
  props: PropDef[];
  zones: Record<string, { x: number; y: number }>;
  vehicleSpawns: { type: string; x: number; y: number }[];
  description: string;
  recommendedTime: TimeOfDay;
}

export interface SaveSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  cameraZoom: number;
  screenShake: boolean;
  weatherEffects: boolean;
  highQuality: boolean;
  showFps: boolean;
  crosshairColor: string;
}

export type KeyAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'shoot'
  | 'reload'
  | 'interact'
  | 'sprint'
  | 'crouch'
  | 'weapon1'
  | 'weapon2'
  | 'weapon3'
  | 'grenade'
  | 'vehicle'
  | 'flashlight'
  | 'medkit'
  | 'pause';

export type Keybinds = Record<KeyAction, string>;

export interface Loadout {
  primary: string;
  secondary: string;
  sidearm: string;
  /** weaponId -> equipped attachment ids (max 4). */
  attachments: Record<string, string[]>;
  equipment: string[];
  /** Preferred free-play insertion vehicle. */
  vehicle: string;
}

export interface PlayerStats {
  missionsCompleted: number;
  missionsFailed: number;
  kills: number;
  eliteKills: number;
  shotsFired: number;
  shotsHit: number;
  deaths: number;
  vehiclesDestroyed: number;
  distanceTravelled: number;
  playSeconds: number;
  grenadeKills: number;
  rescues: number;
  intelRecovered: number;
  wavesSurvived: number;
  trainingBest: number;
  survivalBest: number;
  starsEarned: number;
}

export interface MissionRecord {
  completed: boolean;
  bestScore: number;
  stars: number;
  attempts: number;
  bestTime: number;
  difficulty: DifficultyId | null;
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  credits: number;
  xp: number;
  unlockedWeapons: string[];
  unlockedAttachments: string[];
  unlockedEquipment: string[];
  unlockedVehicles: string[];
  loadout: Loadout;
  missions: Record<string, MissionRecord>;
  /** Sectors whose all-missions clearance bonus has been awarded. */
  sectorBonuses: MapId[];
  stats: PlayerStats;
  settings: SaveSettings;
  keybinds: Keybinds;
}

export interface RunConfig {
  mode: GameMode;
  mapId: MapId;
  missionId?: string;
  difficulty: DifficultyId;
  seed: number;
  timeOfDay?: TimeOfDay;
  weather?: Weather;
  enemyDensity?: number;
  trainingType?: 'shooting' | 'cqb' | 'driving';
}

export interface RunResult {
  mode: GameMode;
  missionId?: string;
  mapId: MapId;
  difficulty: DifficultyId;
  success: boolean;
  score: number;
  stars: number;
  kills: number;
  eliteKills: number;
  shotsFired: number;
  shotsHit: number;
  timeSeconds: number;
  creditsEarned: number;
  xpEarned: number;
  vehiclesDestroyed: number;
  rescued: number;
  intelRecovered: number;
  wave: number;
  objectives: { label: string; complete: boolean }[];
  newUnlocks: string[];
}

export interface InGameObjective {
  def: ObjectiveDef;
  complete: boolean;
  progress: number;
  target: number;
  /** Resolved world position when the objective is spatial. */
  position?: { x: number; y: number };
  secondsLeft?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Vec2 {
  x: number;
  y: number;
}
