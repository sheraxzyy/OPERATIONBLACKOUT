import type { AttachmentDef, AttachmentType, WeaponClass } from '../core/types';

/**
 * Attachment effects are multipliers/additions applied on top of weapon base
 * stats. `spread`, `recoil` and `reloadTime` are treated as multipliers by the
 * weapon runtime; `magazine` is a fractional magazine-size bonus.
 */
export const ATTACHMENTS: AttachmentDef[] = [
  {
    id: 'red_dot',
    name: 'M2 RED DOT',
    type: 'sight',
    price: 600,
    levelReq: 1,
    compatible: ['assault', 'smg', 'shotgun', 'lmg', 'pistol'],
    effects: { spread: -0.18, adsZoom: 0.03 },
    description: 'Unobtrusive reflex sight. Faster target picture and a small dispersion benefit.',
  },
  {
    id: 'acog',
    name: 'ACOG 4×32',
    type: 'sight',
    price: 1200,
    levelReq: 3,
    compatible: ['assault', 'smg', 'lmg'],
    effects: { spread: -0.3, range: 120, adsZoom: 0.06 },
    description: 'Magnified combat optic. Extends practical range at the cost of close-range speed.',
  },
  {
    id: 'scope_4x',
    name: '4× MARKSMAN SCOPE',
    type: 'scope',
    price: 1800,
    levelReq: 5,
    compatible: ['sniper', 'assault', 'lmg'],
    effects: { spread: -0.42, range: 280, adsZoom: 0.12 },
    description: 'Glass for the long approach. Tightens grouping significantly.',
  },
  {
    id: 'scope_8x',
    name: '8× PRECISION SCOPE',
    type: 'scope',
    price: 3200,
    levelReq: 9,
    compatible: ['sniper'],
    effects: { spread: -0.55, range: 520, adsZoom: 0.2 },
    description: 'Long-range optic tuned for anti-personnel work at extreme distance.',
  },
  {
    id: 'suppressor',
    name: 'MIL-SPEC SUPPRESSOR',
    type: 'suppressor',
    price: 1500,
    levelReq: 2,
    compatible: ['assault', 'smg', 'sniper', 'pistol'],
    effects: { noise: -0.65, recoil: -0.12, damage: -2, spread: 0.04 },
    description: 'Cuts gunshot signature by 65%. Slightly reduces muzzle energy and damage.',
  },
  {
    id: 'heavy_suppressor',
    name: 'HEAVY SUPPRESSOR',
    type: 'suppressor',
    price: 2600,
    levelReq: 7,
    compatible: ['assault', 'sniper'],
    effects: { noise: -0.85, recoil: -0.2, damage: -4 },
    description: 'Zero-flash signature suppressor. Almost silent beyond 200 metres.',
  },
  {
    id: 'ext_mag',
    name: 'EXTENDED MAGAZINE',
    type: 'magazine',
    price: 700,
    levelReq: 1,
    compatible: ['assault', 'smg', 'pistol', 'lmg'],
    effects: { magazine: 0.5, reloadTime: 0.08 },
    description: '+50% magazine capacity. Extra weight slows reloads marginally.',
  },
  {
    id: 'drum_mag',
    name: 'DRUM MAGAZINE',
    type: 'magazine',
    price: 1600,
    levelReq: 6,
    compatible: ['smg', 'shotgun', 'lmg'],
    effects: { magazine: 1.0, reloadTime: 0.2, spread: 0.08 },
    description: 'Doubles capacity. Awkward handling and longer reloads.',
  },
  {
    id: 'foregrip',
    name: 'VERTICAL FOREGRIP',
    type: 'grip',
    price: 800,
    levelReq: 2,
    compatible: ['assault', 'smg', 'lmg'],
    effects: { recoil: -0.28, spread: -0.12 },
    description: 'Controls muzzle climb during automatic fire.',
  },
  {
    id: 'angled_grip',
    name: 'ANGLED GRIP',
    type: 'grip',
    price: 900,
    levelReq: 3,
    compatible: ['assault', 'smg'],
    effects: { recoil: -0.16, spread: -0.25 },
    description: 'Improves weapon transition and hip-fire grouping.',
  },
  {
    id: 'flashlight',
    name: 'WEAPON LIGHT',
    type: 'flashlight',
    price: 450,
    levelReq: 1,
    compatible: ['assault', 'smg', 'shotgun', 'lmg', 'pistol'],
    effects: { flashlight: true, spread: -0.06 },
    description: 'Illuminates dark interiors. Visible light also draws enemy attention.',
  },
  {
    id: 'laser',
    name: 'IR LASER MODULE',
    type: 'laser',
    price: 1100,
    levelReq: 3,
    compatible: ['assault', 'smg', 'sniper', 'shotgun', 'lmg', 'pistol'],
    effects: { laser: true, spread: -0.22, recoil: -0.06 },
    description: 'Tightens hip-fire dispersion. The visible dot can reveal your position.',
  },
];

export const ATTACHMENT_MAP: Record<string, AttachmentDef> = Object.fromEntries(
  ATTACHMENTS.map((a) => [a.id, a]),
);

export const ATTACHMENT_TYPE_LABEL: Record<AttachmentType, string> = {
  sight: 'OPTICS',
  scope: 'SCOPES',
  suppressor: 'MUZZLE',
  magazine: 'MAGAZINES',
  grip: 'UNDERBARREL',
  flashlight: 'LIGHT',
  laser: 'LASER',
};

export function compatibleAttachments(weaponClass: WeaponClass): AttachmentDef[] {
  return ATTACHMENTS.filter((a) => a.compatible.includes(weaponClass));
}
