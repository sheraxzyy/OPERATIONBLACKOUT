import type { EquipmentDef } from '../core/types';

export const EQUIPMENT: EquipmentDef[] = [
  {
    id: 'medkit',
    name: 'FIELD MEDKIT',
    slot: 'consumable',
    price: 700,
    levelReq: 1,
    description: 'Two emergency medkits. Restores 55 health per use.',
    effects: { medkits: 2 },
  },
  {
    id: 'trauma_kit',
    name: 'TRAUMA KIT',
    slot: 'consumable',
    price: 1800,
    levelReq: 4,
    description: 'One trauma kit plus a reinforced vest insert. +25 starting health.',
    effects: { medkits: 1, bonusHealth: 25 },
  },
  {
    id: 'armor_plate',
    name: 'CERAMIC PLATE',
    slot: 'armor',
    price: 1600,
    levelReq: 2,
    description: 'Absorbs 40 points of incoming damage before health is affected.',
    effects: { armor: 40 },
  },
  {
    id: 'heavy_plate',
    name: 'HEAVY PLATE CARRIER',
    slot: 'armor',
    price: 3600,
    levelReq: 6,
    description: '75 points of protection. Slight movement penalty.',
    effects: { armor: 75, speed: -0.06 },
  },
  {
    id: 'frag_pack',
    name: 'FRAG PACK',
    slot: 'utility',
    price: 900,
    levelReq: 1,
    description: 'Three additional fragmentation grenades.',
    effects: { grenades: 3 },
  },
  {
    id: 'ammo_pouch',
    name: 'AMMUNITION POUCH',
    slot: 'utility',
    price: 1200,
    levelReq: 3,
    description: 'Two extra reserve magazines for every weapon in the loadout.',
    effects: { reserveMags: 2 },
  },
  {
    id: 'stimulant',
    name: 'COMBAT STIMULANT',
    slot: 'utility',
    price: 1100,
    levelReq: 3,
    description: 'Faster stamina recovery and a small movement bonus.',
    effects: { staminaRegen: 0.35, speed: 0.04 },
  },
];

export const EQUIPMENT_MAP: Record<string, EquipmentDef> = Object.fromEntries(
  EQUIPMENT.map((e) => [e.id, e]),
);
