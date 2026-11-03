import type Phaser from 'phaser';

/**
 * Runtime texture factory. Every visual in OPERATION: BLACKOUT is generated
 * here with Canvas2D — no external art dependency, no missing-asset paths.
 * Textures are drawn at bake time in BootScene and reused by all scenes.
 */

type Ctx = CanvasRenderingContext2D;

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number): Ctx {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, w, h);
  if (!texture) throw new Error(`Unable to create texture ${key}`);
  return texture.getContext();
}

function refresh(scene: Phaser.Scene, key: string): void {
  (scene.textures.get(key).source[0] as unknown as { update?: () => void })?.update?.();
  const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  if (tex && typeof tex.refresh === 'function') tex.refresh();
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function poly(ctx: Ctx, points: [number, number][]): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx: Ctx, w: number, h: number, count: number, alpha: number, colors: string[], rand = mulberry(1)): void {
  for (let i = 0; i < count; i += 1) {
    ctx.globalAlpha = alpha * (0.3 + rand() * 0.7);
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const s = 1 + rand() * 2.2;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function softCircle(ctx: Ctx, x: number, y: number, radius: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// ── Characters ──────────────────────────────────────────────────────────────

interface CharacterPalette {
  uniform: string;
  uniformDark: string;
  vest: string;
  helmet: string;
  skin: string;
  accent: string;
  weapon: string;
  gizmo?: 'ghillie' | 'armor' | 'prisoner' | 'dummy' | 'officer';
}

const CHARACTERS: Record<string, CharacterPalette> = {
  player: {
    uniform: '#4b5941',
    uniformDark: '#303a2c',
    vest: '#242d27',
    helmet: '#39452f',
    skin: '#c2a285',
    accent: '#d7c07a',
    weapon: '#232725',
    gizmo: 'officer',
  },
  patrol: {
    uniform: '#5d5848',
    uniformDark: '#3b382f',
    vest: '#3a352c',
    helmet: '#4d493b',
    skin: '#b08d70',
    accent: '#8e2e29',
    weapon: '#26262a',
  },
  guard: {
    uniform: '#50544c',
    uniformDark: '#33362f',
    vest: '#2b2f2c',
    helmet: '#5c6055',
    skin: '#b99978',
    accent: '#8e2e29',
    weapon: '#25272b',
  },
  assault: {
    uniform: '#3d3d3b',
    uniformDark: '#272725',
    vest: '#33201f',
    helmet: '#30302e',
    skin: '#b69072',
    accent: '#b53a2d',
    weapon: '#1f2022',
    gizmo: 'armor',
  },
  sniper: {
    uniform: '#5a5f48',
    uniformDark: '#3c402f',
    vest: '#3f422f',
    helmet: '#484d37',
    skin: '#b59473',
    accent: '#7a2a24',
    weapon: '#26282a',
    gizmo: 'ghillie',
  },
  heavy: {
    uniform: '#45453f',
    uniformDark: '#292927',
    vest: '#222326',
    helmet: '#3c3e3a',
    skin: '#b09072',
    accent: '#a3392b',
    weapon: '#181a1b',
    gizmo: 'armor',
  },
  prisoner: {
    uniform: '#b4a58b',
    uniformDark: '#8a7d68',
    vest: '#948671',
    helmet: '#c7b8a0',
    skin: '#c6a082',
    accent: '#6f6759',
    weapon: 'transparent',
    gizmo: 'prisoner',
  },
  dummy: {
    uniform: '#77543c',
    uniformDark: '#4f3828',
    vest: '#5b3f2c',
    helmet: '#8a694a',
    skin: '#d7c2a2',
    accent: '#c3382e',
    weapon: '#402e21',
    gizmo: 'dummy',
  },
};

function drawSoldier(key: string, palette: CharacterPalette, seed: number): void {
  const ctx = makeTexture(BOOT_SCENE!, key, 96, 96);
  const rand = mulberry(seed);
  ctx.translate(48, 48);

  // Legs / boots (drawn behind the torso, oriented towards the facing axis).
  ctx.fillStyle = palette.uniformDark;
  rr(ctx, -24, -12, 22, 9, 4);
  ctx.fill();
  rr(ctx, -24, 3, 22, 9, 4);
  ctx.fill();
  ctx.fillStyle = '#181a16';
  rr(ctx, -28, -12.5, 9, 10, 4);
  ctx.fill();
  rr(ctx, -28, 2.5, 9, 10, 4);
  ctx.fill();

  // Backpack.
  ctx.fillStyle = palette.vest;
  rr(ctx, -27, -11, 16, 22, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Torso.
  const torso = ctx.createLinearGradient(0, -18, 0, 18);
  torso.addColorStop(0, palette.uniform);
  torso.addColorStop(1, palette.uniformDark);
  ctx.fillStyle = torso;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 17.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Camouflage blobs clipped to torso.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 17.5, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 12; i += 1) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = i % 3 === 0 ? palette.accent : palette.vest;
    ctx.beginPath();
    ctx.ellipse(-18 + rand() * 36, -16 + rand() * 32, 2 + rand() * 5, 1.5 + rand() * 3, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Armour carrier.
  ctx.fillStyle = palette.vest;
  rr(ctx, -10, -12, 17, 24, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-8, -9, 5, 5);
  ctx.fillRect(-8, 3, 5, 5);

  // Shoulders / arms.
  ctx.strokeStyle = palette.uniform;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -13);
  ctx.lineTo(13, -10);
  ctx.lineTo(25, -2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, 13);
  ctx.lineTo(14, 10);
  ctx.lineTo(28, 3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(14, -10);
  ctx.lineTo(25, -2);
  ctx.stroke();

  // Gloves.
  ctx.fillStyle = '#191b16';
  ctx.beginPath();
  ctx.arc(26, -1, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(29, 4, 4, 0, Math.PI * 2);
  ctx.fill();

  // Weapon.
  if (palette.gizmo !== 'prisoner' && palette.gizmo !== 'dummy') {
    ctx.fillStyle = palette.weapon;
    rr(ctx, 14, -3.5, 34, 7, 1.5);
    ctx.fill();
    rr(ctx, 43, -2, 19, 4, 1.5);
    ctx.fill();
    ctx.fillStyle = '#0d0e0f';
    ctx.fillRect(46, -2.5, 14, 1.5);
    // Magazine.
    if (key.includes('sniper')) {
      rr(ctx, 26, 2, 9, 6, 1);
      ctx.fill();
    } else {
      rr(ctx, 27, 2.5, 7, 10, 1.5);
      ctx.fill();
    }
    // Stock.
    ctx.fillStyle = '#3a352c';
    rr(ctx, 7, -3, 10, 6, 1.5);
    ctx.fill();
    // Optic glint.
    ctx.fillStyle = 'rgba(120,190,190,0.65)';
    ctx.fillRect(32, -5.5, 5, 2);
    if (palette.gizmo === 'ghillie') {
      ctx.fillStyle = '#0c0d0b';
      rr(ctx, 38, -3, 34, 6, 2);
      ctx.fill();
      ctx.strokeStyle = '#4b5138';
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-20 + rand() * 22, -17 + rand() * 34);
        ctx.lineTo(-32 + rand() * 22, -22 + rand() * 44);
        ctx.stroke();
      }
    }
  } else if (palette.gizmo === 'prisoner') {
    // Bound wrists.
    ctx.strokeStyle = '#5b5245';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(19, 2);
    ctx.stroke();
  }

  // Helmet / head.
  const helmetGradient = ctx.createRadialGradient(8, -4, 2, 8, 0, 13);
  helmetGradient.addColorStop(0, palette.helmet);
  helmetGradient.addColorStop(1, palette.uniformDark);
  ctx.fillStyle = helmetGradient;
  ctx.beginPath();
  ctx.arc(8, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Helmet front lip.
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(14, 0, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // NVG mount / brim.
  ctx.fillStyle = palette.accent;
  ctx.fillRect(5, -13, 4, 3);

  if (palette.gizmo === 'armor') {
    ctx.fillStyle = 'rgba(20,22,21,0.9)';
    rr(ctx, -15, -7, 8, 14, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,180,170,0.2)';
    ctx.stroke();
  }
  if (palette.gizmo === 'officer') {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(-4, -17, 8, 3);
    ctx.fillStyle = 'rgba(160,200,255,0.5)';
    ctx.fillRect(2, -12, 2, 2);
  }
  if (palette.gizmo === 'dummy') {
    // Target rings are drawn over the torso.
    ctx.strokeStyle = '#d9cbb1';
    ctx.lineWidth = 2;
    for (const r of [10, 6, 2.5]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#d9cbb1';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outline pass.
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 17.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  refresh(BOOT_SCENE!, key);
}

// Module-level scene pointer set by the generator so helpers stay terse.
let BOOT_SCENE: Phaser.Scene | null = null;

// ── Vehicles ────────────────────────────────────────────────────────────────

function drawVehicle(
  key: string,
  length: number,
  width: number,
  style: 'jeep' | 'humvee' | 'apc' | 'truck' | 'recon',
  seed: number,
): void {
  const W = 176;
  const H = 100;
  const ctx = makeTexture(BOOT_SCENE!, key, W, H);
  const rand = mulberry(seed);
  const cx = W / 2;
  const cy = H / 2;
  const l = Math.min(150, length);
  const w = Math.min(70, width);
  ctx.translate(cx, cy);

  // Wheels.
  const axles = style === 'apc' ? 4 : 2;
  ctx.fillStyle = '#121412';
  for (let i = 0; i < axles; i += 1) {
    const x = axles === 4 ? -52 + i * 34 : -38 + i * 76;
    rr(ctx, x - (style === 'truck' ? 8 : 10), -w / 2 - 5, style === 'apc' ? 16 : 20, 9, 2);
    ctx.fill();
    rr(ctx, x - (style === 'truck' ? 8 : 10), w / 2 - 4, style === 'apc' ? 16 : 20, 9, 2);
    ctx.fill();
    ctx.fillStyle = '#2a2c28';
    ctx.fillRect(x - 3, -w / 2 - 3.5, 6, 6);
    ctx.fillRect(x - 3, w / 2 - 2.5, 6, 6);
    ctx.fillStyle = '#121412';
  }

  // Hull shadow / outline.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, -l / 2 - 3, -w / 2 - 2, l + 6, w + 4, 9);
  ctx.fill();

  const hull = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
  const colors: Record<string, [string, string, string]> = {
    jeep: ['#4a5240', '#343c2f', '#252a21'],
    humvee: ['#575b4c', '#3a3f34', '#272a23'],
    apc: ['#4a4f4a', '#333731', '#222520'],
    truck: ['#5a5b4b', '#3c3e33', '#282a22'],
    recon: ['#4f5442', '#353a2d', '#232720'],
  };
  const palette = colors[style];
  hull.addColorStop(0, palette[0]);
  hull.addColorStop(0.6, palette[1]);
  hull.addColorStop(1, palette[2]);
  ctx.fillStyle = hull;
  rr(ctx, -l / 2, -w / 2, l, w, style === 'recon' ? 7 : 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Camo mottling.
  ctx.save();
  rr(ctx, -l / 2, -w / 2, l, w, 5);
  ctx.clip();
  for (let i = 0; i < 26; i += 1) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = i % 3 ? '#20251c' : '#77745b';
    ctx.beginPath();
    ctx.ellipse(-l / 2 + rand() * l, -w / 2 + rand() * w, 4 + rand() * 13, 2 + rand() * 5, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Panels and seams.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const x = -l / 2 + (l / 5) * i;
    ctx.beginPath();
    ctx.moveTo(x, -w / 2 + 3);
    ctx.lineTo(x, w / 2 - 3);
    ctx.stroke();
  }

  // Windshield / cabin.
  ctx.fillStyle = 'rgba(75,105,112,0.8)';
  if (style === 'truck') {
    rr(ctx, 18, -w / 2 + 7, 35, w - 14, 3);
    ctx.fill();
    ctx.fillStyle = '#26291f';
    rr(ctx, -l / 2 + 5, -w / 2 + 6, 66, w - 12, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let x = -l / 2 + 10; x < -l / 2 + 68; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, -w / 2 + 8);
      ctx.lineTo(x, w / 2 - 8);
      ctx.stroke();
    }
  } else {
    rr(ctx, 12, -w / 2 + 8, 30, w - 16, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,185,190,0.22)';
    ctx.fillRect(15, -w / 2 + 10, 4, w - 20);
  }

  // Engine hood / grille.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, l / 2 - 34, -w / 2 + 8, 24, w - 16, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 5; i += 1) {
    const y = -w / 2 + 13 + i * ((w - 26) / 4);
    ctx.beginPath();
    ctx.moveTo(l / 2 - 30, y);
    ctx.lineTo(l / 2 - 12, y);
    ctx.stroke();
  }

  // Headlights.
  ctx.fillStyle = '#e8ddb3';
  ctx.fillRect(l / 2 - 7, -w / 2 + 10, 4, 7);
  ctx.fillRect(l / 2 - 7, w / 2 - 17, 4, 7);
  ctx.fillStyle = '#8d2e21';
  ctx.fillRect(-l / 2 + 2, -w / 2 + 10, 3, 6);
  ctx.fillRect(-l / 2 + 2, w / 2 - 16, 3, 6);

  // Roof details.
  if (style === 'humvee' || style === 'apc' || style === 'recon') {
    ctx.fillStyle = 'rgba(20,22,18,0.75)';
    ctx.beginPath();
    ctx.arc(style === 'apc' ? 6 : 0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#23261f';
    ctx.beginPath();
    ctx.arc(style === 'apc' ? 6 : 0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#565b48';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(style === 'apc' ? 6 : 0, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
    ctx.fillStyle = '#1b1d18';
    ctx.fillRect(26, -2, 22, 4);
  }
  if (style === 'jeep') {
    ctx.fillStyle = '#282b23';
    rr(ctx, -20, -w / 2 + 7, 24, 8, 2);
    ctx.fill();
    rr(ctx, -20, w / 2 - 15, 24, 8, 2);
    ctx.fill();
  }
  if (style === 'apc') {
    ctx.strokeStyle = 'rgba(180,180,160,0.18)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-l / 2 + 10, -w / 2 + 8, l - 20, w - 16);
  }

  // Markings.
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#d4c9a2';
  ctx.font = 'bold 9px Consolas, monospace';
  ctx.fillText(style === 'apc' ? 'BV-04' : style === 'humvee' ? 'BV-12' : 'BV-07', -l / 2 + 14, w / 2 - 9);
  ctx.restore();
  // Antennae.
  ctx.strokeStyle = '#11130f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-l / 2 + 20, -w / 2 + 4);
  ctx.lineTo(-l / 2 + 14, -w / 2 - 14);
  ctx.stroke();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  refresh(BOOT_SCENE!, key);
}

// ── Environment props ───────────────────────────────────────────────────────

function drawPine(key: string, snowy: boolean, seed: number): void {
  const S = 150;
  const ctx = makeTexture(BOOT_SCENE!, key, S, S);
  const rand = mulberry(seed);
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(7, 9, 48, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  // Branch layers, bottom to top.
  for (let layer = 0; layer < 5; layer += 1) {
    const r = 52 - layer * 8;
    ctx.fillStyle = snowy ? (layer % 2 ? '#4d5b55' : '#5c6c63') : layer % 2 ? '#2d4129' : '#354c2f';
    ctx.beginPath();
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2 + layer * 0.22;
      const rad = r * (0.72 + rand() * 0.4);
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.quadraticCurveTo(Math.cos(a - 0.11) * rad * 0.86, Math.sin(a - 0.11) * rad * 0.86, x, y);
    }
    ctx.closePath();
    ctx.fill();
    if (snowy) {
      ctx.strokeStyle = 'rgba(220,235,240,0.5)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Central trunk highlight.
  ctx.fillStyle = snowy ? '#7f8b84' : '#5a6b48';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  speckle(ctx, S, S, 160, 0.08, snowy ? ['#dfe9ea', '#ffffff'] : ['#9fbd7a', '#0d1a0d'], rand);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  refresh(BOOT_SCENE!, key);
}

function drawRock(key: string, seed: number, sandy = false): void {
  const S = 104;
  const ctx = makeTexture(BOOT_SCENE!, key, S, S);
  const rand = mulberry(seed);
  const cx = S / 2;
  const cy = S / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx + 5, cy + 7, 36, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  const points: [number, number][] = [];
  const n = 9;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const r = 28 + rand() * 16;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.76]);
  }
  const g = ctx.createLinearGradient(cx - 30, cy - 24, cx + 26, cy + 24);
  g.addColorStop(0, sandy ? '#a48a64' : '#7c807a');
  g.addColorStop(0.6, sandy ? '#7e6747' : '#5b605b');
  g.addColorStop(1, sandy ? '#55452f' : '#3d423e');
  ctx.fillStyle = g;
  poly(ctx, points);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy - 10);
  ctx.lineTo(cx - 4, cy - 20);
  ctx.lineTo(cx + 12, cy - 14);
  ctx.stroke();
  speckle(ctx, S, S, 90, 0.08, sandy ? ['#c7ad80', '#4f3f2c'] : ['#a6aba2', '#333733'], rand);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  refresh(BOOT_SCENE!, key);
}

function drawCrate(key: string, variant: 'crate' | 'barrel' | 'sandbag' | 'container' | 'debris' | 'cactus' | 'tower' | 'car_wreck'): void {
  const ctx =
    variant === 'container'
      ? makeTexture(BOOT_SCENE!, key, 170, 76)
      : variant === 'car_wreck'
        ? makeTexture(BOOT_SCENE!, key, 140, 78)
        : variant === 'tower'
          ? makeTexture(BOOT_SCENE!, key, 120, 120)
          : variant === 'sandbag'
            ? makeTexture(BOOT_SCENE!, key, 110, 60)
            : makeTexture(BOOT_SCENE!, key, 80, 80);
  const W = variant === 'container' ? 170 : variant === 'car_wreck' ? 140 : variant === 'sandbag' ? 110 : variant === 'tower' ? 120 : 80;
  const H = variant === 'container' ? 76 : variant === 'car_wreck' ? 78 : variant === 'sandbag' ? 60 : variant === 'tower' ? 120 : 80;
  const rand = mulberry(variant.length * 1337 + 9);

  if (variant === 'crate') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(8, 10, W - 10, H - 8);
    const g = ctx.createLinearGradient(8, 8, W - 8, H - 8);
    g.addColorStop(0, '#9a7b4c');
    g.addColorStop(0.5, '#705733');
    g.addColorStop(1, '#4e3c25');
    ctx.fillStyle = g;
    ctx.fillRect(8, 8, W - 16, H - 16);
    ctx.strokeStyle = '#2b2117';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.strokeStyle = 'rgba(255,220,160,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 12);
    ctx.lineTo(W - 12, H - 12);
    ctx.moveTo(W - 12, 12);
    ctx.lineTo(12, H - 12);
    ctx.stroke();
    ctx.fillStyle = '#3a2d1d';
    ctx.fillRect(8, 20, W - 16, 4);
    ctx.fillRect(8, H - 28, W - 16, 4);
    ctx.fillStyle = 'rgba(220,205,165,0.55)';
    ctx.font = 'bold 8px Consolas, monospace';
    ctx.fillText('AMMO', 24, 48);
    speckle(ctx, W, H, 70, 0.08, ['#c2a06a', '#2f2414'], rand);
  }

  if (variant === 'barrel') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(44, 44, 27, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(30, 28, 4, 40, 40, 30);
    g.addColorStop(0, '#6c6d55');
    g.addColorStop(0.7, '#3f4334');
    g.addColorStop(1, '#24271e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(40, 40, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b1d16';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,190,120,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(40, 40, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#b04b32';
    ctx.fillRect(32, 34, 16, 6);
    ctx.strokeStyle = '#c9b887';
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 34, 16, 6);
    ctx.fillStyle = '#1b1d18';
    ctx.beginPath();
    ctx.arc(40, 40, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (variant === 'sandbag') {
    for (let row = 0; row < 2; row += 1) {
      for (let i = 0; i < 3; i += 1) {
        const x = 10 + i * 31 + (row ? 15 : 0);
        const y = 8 + row * 22;
        ctx.fillStyle = row ? '#8a7d5f' : '#9a8b6a';
        rr(ctx, x, y, 34, 22, 9);
        ctx.fill();
        ctx.strokeStyle = '#5a513d';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,200,0.18)';
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 7);
        ctx.lineTo(x + 26, y + 6);
        ctx.stroke();
      }
    }
  }

  if (variant === 'container') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(8, 10, W - 8, H - 6);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6f5544');
    g.addColorStop(0.55, '#584333');
    g.addColorStop(1, '#3b2c21');
    ctx.fillStyle = g;
    rr(ctx, 6, 6, W - 16, H - 16, 3);
    ctx.fill();
    ctx.strokeStyle = '#251b13';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    for (let x = 14; x < W - 14; x += 7) {
      ctx.beginPath();
      ctx.moveTo(x, 9);
      ctx.lineTo(x, H - 9);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(210,195,160,0.35)';
    ctx.font = 'bold 9px Consolas, monospace';
    ctx.fillText('BLACK VEIL', 22, 24);
    ctx.fillText('7-11-31', W - 62, H - 16);
  }

  if (variant === 'debris') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(40, 44, 32, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 20; i += 1) {
      const x = 10 + rand() * 60;
      const y = 15 + rand() * 50;
      const s = 3 + rand() * 9;
      ctx.fillStyle = i % 3 ? '#5a5850' : '#77746a';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * 3);
      ctx.fillRect(-s / 2, -s / 3, s, s * 0.7);
      ctx.restore();
    }
    ctx.fillStyle = '#3d3b35';
    ctx.fillRect(24, 36, 12, 4);
    ctx.fillRect(44, 24, 8, 4);
  }

  if (variant === 'cactus') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(44, 50, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(26, 0, 56, 0);
    g.addColorStop(0, '#39502e');
    g.addColorStop(0.5, '#5a703f');
    g.addColorStop(1, '#2e4127');
    ctx.fillStyle = g;
    rr(ctx, 33, 16, 14, 52, 7);
    ctx.fill();
    rr(ctx, 21, 32, 14, 8, 4);
    ctx.fill();
    rr(ctx, 21, 22, 7, 16, 3.5);
    ctx.fill();
    rr(ctx, 45, 28, 14, 8, 4);
    ctx.fill();
    rr(ctx, 53, 18, 7, 18, 3.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,230,180,0.25)';
    ctx.lineWidth = 1;
    for (let y = 20; y < 66; y += 6) {
      ctx.beginPath();
      ctx.moveTo(36, y);
      ctx.lineTo(39, y - 3);
      ctx.stroke();
    }
  }

  if (variant === 'tower') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(12, 18, W - 8, H - 10);
    ctx.fillStyle = '#4b4637';
    ctx.fillRect(20, 20, 80, 80);
    ctx.strokeStyle = '#2a271f';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, 80, 80);
    ctx.strokeStyle = '#6e654b';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(20, 20 + i * 20);
      ctx.lineTo(100, 20 + i * 20);
      ctx.stroke();
    }
    ctx.fillStyle = '#1f211b';
    ctx.fillRect(28, 28, 64, 64);
    ctx.strokeStyle = 'rgba(220,200,150,0.25)';
    ctx.strokeRect(34, 34, 52, 52);
    ctx.fillStyle = '#8d2f28';
    ctx.beginPath();
    ctx.arc(60, 60, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  if (variant === 'car_wreck') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, 12, 18, W - 20, H - 24, 12);
    ctx.fill();
    const g = ctx.createLinearGradient(0, 12, 0, H - 12);
    g.addColorStop(0, '#65574a');
    g.addColorStop(1, '#332d27');
    ctx.fillStyle = g;
    rr(ctx, 9, 12, W - 18, H - 24, 12);
    ctx.fill();
    ctx.strokeStyle = '#241e19';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#232322';
    rr(ctx, 38, 18, 36, H - 36, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,200,205,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, 20);
    ctx.lineTo(68, H - 22);
    ctx.moveTo(66, 20);
    ctx.lineTo(44, H - 22);
    ctx.stroke();
    ctx.fillStyle = '#101110';
    for (const x of [30, W - 44]) {
      ctx.fillRect(x, 8, 18, 8);
      ctx.fillRect(x, H - 16, 18, 8);
    }
    ctx.fillStyle = '#8a4c31';
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(22, 38, 10, 8, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  refresh(BOOT_SCENE!, key);
}

// ── Objective & pickup assets ───────────────────────────────────────────────

function drawObjectiveProps(): void {
  // Intel laptop.
  {
    const ctx = makeTexture(BOOT_SCENE!, 'obj_intel', 70, 60);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(8, 34, 54, 16);
    ctx.fillStyle = '#3b3f3a';
    rr(ctx, 8, 36, 54, 18, 3);
    ctx.fill();
    ctx.strokeStyle = '#20221f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1d2b2c';
    rr(ctx, 12, 8, 44, 30, 2);
    ctx.fill();
    const g = ctx.createLinearGradient(14, 10, 54, 36);
    g.addColorStop(0, '#2b6e70');
    g.addColorStop(1, '#142e34');
    ctx.fillStyle = g;
    ctx.fillRect(15, 11, 38, 24);
    ctx.fillStyle = 'rgba(150,235,210,0.8)';
    for (let i = 0; i < 7; i += 1) ctx.fillRect(19, 15 + i * 3, 8 + (i * 5) % 18, 1.2);
    ctx.strokeStyle = '#556059';
    ctx.strokeRect(12, 8, 44, 30);
    refresh(BOOT_SCENE!, 'obj_intel');
  }
  // Generator.
  {
    const ctx = makeTexture(BOOT_SCENE!, 'obj_generator', 96, 76);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(10, 16, 82, 54);
    const g = ctx.createLinearGradient(0, 8, 0, 70);
    g.addColorStop(0, '#6a6b50');
    g.addColorStop(1, '#34352a');
    ctx.fillStyle = g;
    rr(ctx, 8, 10, 80, 56, 5);
    ctx.fill();
    ctx.strokeStyle = '#22231c';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#24251f';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(15, 17 + i * 9, 42, 4);
    ctx.fillStyle = '#a56c2f';
    ctx.fillRect(60, 20, 20, 34);
    ctx.fillStyle = '#1a1c17';
    ctx.fillRect(64, 26, 12, 10);
    ctx.strokeStyle = '#d4a93f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(70, 43, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#2b2c22';
    ctx.lineWidth = 2;
    ctx.strokeRect(62, 16, 16, 42);
    refresh(BOOT_SCENE!, 'obj_generator');
  }
  // Antenna mast.
  {
    const ctx = makeTexture(BOOT_SCENE!, 'obj_antenna', 84, 108);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(46, 94, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a4d42';
    ctx.fillRect(36, 20, 12, 78);
    ctx.strokeStyle = '#24261f';
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 20, 12, 78);
    ctx.strokeStyle = '#6b7060';
    ctx.lineWidth = 1;
    for (let y = 26; y < 94; y += 6) {
      ctx.beginPath();
      ctx.moveTo(38, y);
      ctx.lineTo(46, y + 3);
      ctx.stroke();
    }
    ctx.fillStyle = '#333630';
    ctx.beginPath();
    ctx.ellipse(42, 20, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8c0ad';
    ctx.beginPath();
    ctx.ellipse(42, 18, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b342b';
    ctx.beginPath();
    ctx.arc(42, 18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8b26b';
    ctx.fillRect(30, 52, 36, 6);
    ctx.fillStyle = '#1b1c17';
    ctx.font = 'bold 6px Consolas, monospace';
    ctx.fillText('BV RELAY', 33, 57);
    refresh(BOOT_SCENE!, 'obj_antenna');
  }
  // Control array terminal.
  {
    const ctx = makeTexture(BOOT_SCENE!, 'obj_array', 96, 92);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(50, 78, 36, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, 10, 0, 80);
    g.addColorStop(0, '#4d5351');
    g.addColorStop(1, '#262b2a');
    ctx.fillStyle = g;
    rr(ctx, 16, 20, 64, 54, 4);
    ctx.fill();
    ctx.strokeStyle = '#161918';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#101919';
    ctx.fillRect(23, 28, 50, 25);
    ctx.fillStyle = '#d15f42';
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 4; i += 1) ctx.fillRect(27, 33 + i * 5, 12 + i * 7, 1.5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#89806b';
    ctx.fillRect(23, 58, 50, 6);
    ctx.fillStyle = '#b34b31';
    ctx.beginPath();
    ctx.arc(70, 45, 4, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = '#343a37';
      ctx.fillRect(24 + i * 18, 11, 8, 10);
    }
    refresh(BOOT_SCENE!, 'obj_array');
  }
  // Pickups.
  {
    const ctx = makeTexture(BOOT_SCENE!, 'pickup_medkit', 44, 36);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, 5, 7, 36, 26, 5);
    ctx.fill();
    ctx.fillStyle = '#d7d2c2';
    rr(ctx, 3, 4, 38, 26, 4);
    ctx.fill();
    ctx.strokeStyle = '#555b51';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#a8342c';
    ctx.fillRect(19, 8, 6, 18);
    ctx.fillRect(13, 14, 18, 6);
    refresh(BOOT_SCENE!, 'pickup_medkit');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'pickup_ammo', 48, 36);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, 5, 7, 40, 26, 4);
    ctx.fill();
    ctx.fillStyle = '#5c5f47';
    rr(ctx, 3, 4, 42, 26, 3);
    ctx.fill();
    ctx.strokeStyle = '#2a2c21';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#c8b375';
    ctx.fillRect(8, 10, 32, 4);
    ctx.fillRect(8, 22, 32, 3);
    ctx.fillStyle = '#2e3025';
    ctx.font = 'bold 7px Consolas, monospace';
    ctx.fillText('5.56', 15, 20);
    refresh(BOOT_SCENE!, 'pickup_ammo');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'pickup_grenade', 32, 36);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(17, 29, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#43503a';
    rr(ctx, 9, 9, 14, 21, 7);
    ctx.fill();
    ctx.strokeStyle = '#21261d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#777a64';
    ctx.fillRect(12, 5, 8, 5);
    ctx.strokeStyle = '#9a9a82';
    ctx.beginPath();
    ctx.arc(20, 7, 4, 0, Math.PI * 2);
    ctx.stroke();
    refresh(BOOT_SCENE!, 'pickup_grenade');
  }
}

// ── Effects ─────────────────────────────────────────────────────────────────

function drawEffects(): void {
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_flash', 72, 44);
    softCircle(ctx, 24, 22, 20, 'rgba(255,230,150,0.9)');
    const g = ctx.createLinearGradient(16, 0, 62, 0);
    g.addColorStop(0, 'rgba(255,245,200,1)');
    g.addColorStop(0.5, 'rgba(255,190,80,0.8)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    poly(ctx, [[14, 12], [60, 22], [14, 32], [22, 22]]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,235,0.95)';
    poly(ctx, [[20, 18], [48, 22], [20, 26]]);
    ctx.fill();
    refresh(BOOT_SCENE!, 'fx_flash');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_spark', 10, 10);
    softCircle(ctx, 5, 5, 5, 'rgba(255,220,140,1)');
    refresh(BOOT_SCENE!, 'fx_spark');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_blood', 12, 12);
    softCircle(ctx, 6, 6, 6, 'rgba(120,20,18,0.95)');
    refresh(BOOT_SCENE!, 'fx_blood');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_smoke', 72, 72);
    softCircle(ctx, 36, 36, 35, 'rgba(150,150,140,0.5)');
    softCircle(ctx, 28, 30, 20, 'rgba(190,185,170,0.3)');
    refresh(BOOT_SCENE!, 'fx_smoke');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_casing', 10, 5);
    ctx.fillStyle = '#c9a85e';
    rr(ctx, 0, 0, 10, 5, 2);
    ctx.fill();
    ctx.fillStyle = '#f2d998';
    ctx.fillRect(1, 1, 5, 1);
    refresh(BOOT_SCENE!, 'fx_casing');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_glow', 192, 192);
    softCircle(ctx, 96, 96, 96, 'rgba(255,241,200,0.85)');
    refresh(BOOT_SCENE!, 'fx_glow');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_rain', 4, 26);
    const g = ctx.createLinearGradient(0, 0, 0, 26);
    g.addColorStop(0, 'rgba(180,205,220,0)');
    g.addColorStop(0.5, 'rgba(190,215,230,0.85)');
    g.addColorStop(1, 'rgba(150,180,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(1, 0, 1.5, 26);
    refresh(BOOT_SCENE!, 'fx_rain');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_snow', 10, 10);
    softCircle(ctx, 5, 5, 5, 'rgba(235,245,255,0.9)');
    refresh(BOOT_SCENE!, 'fx_snow');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_sand', 12, 12);
    softCircle(ctx, 6, 6, 6, 'rgba(200,170,115,0.7)');
    refresh(BOOT_SCENE!, 'fx_sand');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_fog', 320, 200);
    const rand = mulberry(88);
    for (let i = 0; i < 22; i += 1) {
      softCircle(ctx, 40 + rand() * 240, 50 + rand() * 100, 30 + rand() * 60, `rgba(200,210,205,${0.035 + rand() * 0.03})`);
    }
    refresh(BOOT_SCENE!, 'fx_fog');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_shadow', 80, 48);
    const g = ctx.createRadialGradient(40, 24, 2, 40, 24, 40);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 0.6);
    ctx.beginPath();
    ctx.arc(40, 40, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    refresh(BOOT_SCENE!, 'fx_shadow');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_ring', 160, 160);
    ctx.strokeStyle = 'rgba(255,210,130,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(80, 80, 68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,220,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(80, 80, 58, 0, Math.PI * 2);
    ctx.stroke();
    refresh(BOOT_SCENE!, 'fx_ring');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_lightcone', 380, 240);
    const g = ctx.createLinearGradient(0, 120, 380, 120);
    g.addColorStop(0, 'rgba(255,240,200,0.24)');
    g.addColorStop(0.5, 'rgba(255,240,200,0.1)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 105);
    ctx.lineTo(370, 0);
    ctx.lineTo(370, 240);
    ctx.lineTo(0, 135);
    ctx.closePath();
    ctx.fill();
    refresh(BOOT_SCENE!, 'fx_lightcone');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_flare', 80, 80);
    softCircle(ctx, 40, 40, 38, 'rgba(255,120,60,0.8)');
    ctx.strokeStyle = 'rgba(255,200,120,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(40, 40, 22, 0, Math.PI * 2);
    ctx.stroke();
    refresh(BOOT_SCENE!, 'fx_flare');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_debris', 12, 9);
    ctx.fillStyle = '#6b6658';
    ctx.fillRect(1, 2, 10, 5);
    ctx.fillStyle = '#3c3a32';
    ctx.fillRect(3, 0, 5, 3);
    refresh(BOOT_SCENE!, 'fx_debris');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_grenade', 22, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(12, 27, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#39452f';
    rr(ctx, 5, 7, 13, 19, 6);
    ctx.fill();
    ctx.strokeStyle = '#12160f';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#5f6554';
    ctx.fillRect(8, 3, 7, 5);
    refresh(BOOT_SCENE!, 'fx_grenade');
  }
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_laser', 256, 6);
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,60,40,0.9)');
    g.addColorStop(0.6, 'rgba(255,60,40,0.2)');
    g.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 2, 256, 2);
    refresh(BOOT_SCENE!, 'fx_laser');
  }
  {
    // Pooled projectile tracer. Tinted per side at runtime.
    const ctx = makeTexture(BOOT_SCENE!, 'fx_tracer', 26, 4);
    const g = ctx.createLinearGradient(0, 0, 26, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(255,244,205,0.9)');
    g.addColorStop(1, 'rgba(255,210,120,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 1, 26, 2);
    ctx.fillStyle = 'rgba(255,255,240,0.95)';
    ctx.fillRect(21, 0.5, 5, 3);
    refresh(BOOT_SCENE!, 'fx_tracer');
  }
}

// ── UI assets & icons ───────────────────────────────────────────────────────

function drawIcons(): void {
  const W = 64;
  const icon = (key: string, draw: (ctx: Ctx) => void) => {
    const ctx = makeTexture(BOOT_SCENE!, key, W, W);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    refresh(BOOT_SCENE!, key);
  };

  const weaponIcon = (ctx: Ctx, style: string) => {
    ctx.lineWidth = 3;
    if (style === 'assault') {
      ctx.fillRect(10, 27, 36, 6);
      ctx.fillRect(40, 29, 18, 3);
      ctx.fillRect(16, 33, 8, 10);
      ctx.fillRect(6, 25, 8, 9);
      ctx.fillRect(28, 21, 8, 4);
    } else if (style === 'smg') {
      ctx.fillRect(14, 27, 28, 6);
      ctx.fillRect(38, 29, 10, 3);
      ctx.fillRect(20, 33, 7, 12);
      ctx.fillRect(10, 24, 5, 7);
    } else if (style === 'sniper') {
      ctx.fillRect(6, 29, 46, 3);
      ctx.fillRect(14, 32, 10, 9);
      ctx.fillRect(24, 22, 16, 4);
      ctx.fillRect(50, 29, 8, 2);
    } else if (style === 'shotgun') {
      ctx.fillRect(8, 28, 44, 4);
      ctx.fillRect(12, 32, 26, 4);
      ctx.fillRect(44, 28, 12, 2);
      ctx.fillRect(6, 25, 12, 9);
    } else if (style === 'lmg') {
      ctx.fillRect(10, 26, 40, 7);
      ctx.fillRect(46, 28, 12, 3);
      ctx.fillRect(18, 33, 16, 10);
      ctx.fillRect(8, 23, 8, 5);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(38, 33);
      ctx.lineTo(33, 44);
      ctx.moveTo(42, 33);
      ctx.lineTo(47, 44);
      ctx.stroke();
    } else {
      ctx.fillRect(18, 25, 26, 7);
      ctx.fillRect(40, 24, 6, 13);
      ctx.fillRect(20, 32, 8, 12);
    }
  };

  (['assault', 'smg', 'sniper', 'shotgun', 'lmg', 'pistol'] as const).forEach((style) => {
    icon(`icon_${style}`, (ctx) => weaponIcon(ctx, style));
  });

  icon('icon_sight', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, 32, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(32, 10);
    ctx.lineTo(32, 20);
    ctx.moveTo(32, 44);
    ctx.lineTo(32, 54);
    ctx.moveTo(10, 32);
    ctx.lineTo(20, 32);
    ctx.moveTo(44, 32);
    ctx.lineTo(54, 32);
    ctx.stroke();
  });
  icon('icon_scope', (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 24, 44, 16);
    ctx.beginPath();
    ctx.arc(32, 32, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(18, 40, 6, 10);
    ctx.fillRect(40, 40, 6, 10);
  });
  icon('icon_suppressor', (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, 30, 24);
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      ctx.moveTo(26 + i * 7, 20);
      ctx.lineTo(26 + i * 7, 44);
    }
    ctx.stroke();
    ctx.fillRect(8, 28, 12, 8);
  });
  icon('icon_magazine', (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(23, 12, 18, 34);
    ctx.beginPath();
    ctx.moveTo(23, 22);
    ctx.lineTo(41, 22);
    ctx.moveTo(23, 34);
    ctx.lineTo(41, 34);
    ctx.stroke();
    ctx.fillRect(25, 46, 14, 6);
  });
  icon('icon_grip', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 12);
    ctx.lineTo(44, 12);
    ctx.lineTo(44, 20);
    ctx.lineTo(32, 28);
    ctx.lineTo(32, 50);
    ctx.lineTo(18, 50);
    ctx.lineTo(18, 26);
    ctx.lineTo(20, 20);
    ctx.closePath();
    ctx.stroke();
  });
  icon('icon_flashlight', (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 22, 14, 20);
    ctx.beginPath();
    ctx.moveTo(28, 18);
    ctx.lineTo(46, 10);
    ctx.lineTo(46, 54);
    ctx.lineTo(28, 46);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(36, 24);
    ctx.lineTo(42, 22);
    ctx.moveTo(36, 32);
    ctx.lineTo(50, 32);
    ctx.moveTo(36, 40);
    ctx.lineTo(42, 42);
    ctx.stroke();
  });
  icon('icon_laser', (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 24, 30, 16);
    ctx.beginPath();
    ctx.moveTo(40, 32);
    ctx.lineTo(54, 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(54, 32, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  icon('icon_eliminate', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(32, 8);
    ctx.lineTo(32, 22);
    ctx.moveTo(32, 42);
    ctx.lineTo(32, 56);
    ctx.moveTo(8, 32);
    ctx.lineTo(22, 32);
    ctx.moveTo(42, 32);
    ctx.lineTo(56, 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, 32, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  icon('icon_intel', (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 12, 32, 40);
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      ctx.moveTo(23, 22 + i * 7);
      ctx.lineTo(41, 22 + i * 7);
    }
    ctx.stroke();
    ctx.fillRect(27, 8, 10, 6);
  });
  icon('icon_rescue', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 21, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, 50);
    ctx.quadraticCurveTo(18, 31, 32, 31);
    ctx.quadraticCurveTo(46, 31, 46, 50);
    ctx.stroke();
    ctx.fillRect(12, 38, 6, 4);
    ctx.fillRect(46, 38, 6, 4);
  });
  icon('icon_destroy', (ctx) => {
    ctx.lineWidth = 3;
    poly(ctx, [
      [32, 10],
      [40, 26],
      [52, 22],
      [44, 36],
      [52, 48],
      [36, 46],
      [32, 56],
      [27, 44],
      [14, 48],
      [20, 34],
      [12, 24],
      [26, 26],
    ]);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, 34, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  icon('icon_extract', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12, 50);
    ctx.lineTo(12, 14);
    ctx.lineTo(48, 14);
    ctx.lineTo(40, 26);
    ctx.lineTo(48, 38);
    ctx.lineTo(12, 38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(26, 44);
    ctx.lineTo(26, 54);
    ctx.stroke();
  });
  icon('icon_survive', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 8);
    ctx.lineTo(52, 16);
    ctx.lineTo(48, 40);
    ctx.quadraticCurveTo(40, 50, 32, 55);
    ctx.quadraticCurveTo(24, 50, 16, 40);
    ctx.lineTo(12, 16);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(24, 32);
    ctx.lineTo(30, 38);
    ctx.lineTo(42, 24);
    ctx.stroke();
  });
  icon('icon_reach', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, 54);
    ctx.lineTo(16, 10);
    ctx.lineTo(48, 18);
    ctx.lineTo(40, 30);
    ctx.lineTo(16, 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(16, 54, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  icon('icon_medkit', (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 16, 40, 34);
    ctx.fillRect(27, 22, 10, 22);
    ctx.fillRect(21, 28, 22, 10);
  });
  icon('icon_armor', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 8);
    ctx.lineTo(52, 16);
    ctx.lineTo(48, 40);
    ctx.quadraticCurveTo(40, 50, 32, 55);
    ctx.quadraticCurveTo(24, 50, 16, 40);
    ctx.lineTo(12, 16);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(32, 16);
    ctx.lineTo(32, 45);
    ctx.stroke();
  });
  icon('icon_grenade', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(32, 36, 14, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(26, 12, 12, 8);
    ctx.beginPath();
    ctx.arc(44, 16, 6, 0, Math.PI * 2);
    ctx.stroke();
  });
  icon('icon_ammo', (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 20, 40, 28);
    ctx.fillRect(16, 24, 6, 20);
    ctx.fillRect(26, 24, 6, 20);
    ctx.fillRect(36, 24, 6, 20);
    ctx.fillRect(46, 24, 3, 20);
  });
  icon('icon_vehicle', (ctx) => {
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 20, 48, 24);
    ctx.fillRect(16, 28, 14, 10);
    ctx.fillRect(38, 28, 10, 10);
    ctx.beginPath();
    ctx.arc(18, 48, 5, 0, Math.PI * 2);
    ctx.arc(46, 48, 5, 0, Math.PI * 2);
    ctx.stroke();
  });
  icon('icon_upgrade', (ctx) => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 8);
    ctx.lineTo(54, 32);
    ctx.lineTo(42, 32);
    ctx.lineTo(42, 54);
    ctx.lineTo(22, 54);
    ctx.lineTo(22, 32);
    ctx.lineTo(10, 32);
    ctx.closePath();
    ctx.stroke();
  });
}

function drawUiBackdrop(): void {
  const W = 1600;
  const H = 900;
  const ctx = makeTexture(BOOT_SCENE!, 'bg_command', W, H);
  const rand = mulberry(20311);

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0a1112');
  g.addColorStop(0.45, '#0c1213');
  g.addColorStop(0.7, '#111610');
  g.addColorStop(1, '#06090a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Topographic contour lines.
  ctx.strokeStyle = 'rgba(109,132,117,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i += 1) {
    ctx.beginPath();
    const base = 60 + i * 34;
    for (let x = -40; x <= W + 40; x += 22) {
      const y = base + Math.sin(x * 0.005 + i * 0.6) * 34 + Math.cos(x * 0.011 + i) * 16;
      if (x === -40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Large diagonal tactical bands.
  ctx.save();
  ctx.translate(1050, 280);
  ctx.rotate(-0.5);
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#b3a173';
  for (let i = 0; i < 5; i += 1) ctx.fillRect(-300 + i * 90, -400, 26, 1000);
  ctx.restore();

  // Grid.
  ctx.strokeStyle = 'rgba(120,145,130,0.055)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Noise.
  speckle(ctx, W, H, 16000, 0.045, ['#b6b09c', '#aab6a4', '#000000'], rand);

  // Vignette.
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.24, W / 2, H / 2, H * 0.9);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Amber corner ticks.
  ctx.strokeStyle = 'rgba(220,183,108,0.45)';
  ctx.lineWidth = 1.5;
  const corner = (x: number, y: number, sx: number, sy: number) => {
    ctx.beginPath();
    ctx.moveTo(x + sx * 26, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * 26);
    ctx.stroke();
  };
  corner(28, 28, 1, 1);
  corner(W - 28, 28, -1, 1);
  corner(28, H - 28, 1, -1);
  corner(W - 28, H - 28, -1, -1);
  refresh(BOOT_SCENE!, 'bg_command');
}

function drawMisc(): void {
  // Scanline overlay tile.
  {
    const ctx = makeTexture(BOOT_SCENE!, 'fx_scanlines', 4, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    ctx.fillRect(0, 0, 4, 1);
    refresh(BOOT_SCENE!, 'fx_scanlines');
  }
  // Menu tactical map panel.
  {
    const ctx = makeTexture(BOOT_SCENE!, 'bg_tacmap', 760, 620);
    const rand = mulberry(77);
    ctx.fillStyle = '#0b1313';
    ctx.fillRect(0, 0, 760, 620);
    const g = ctx.createRadialGradient(380, 310, 40, 380, 310, 420);
    g.addColorStop(0, 'rgba(42,66,57,0.6)');
    g.addColorStop(0.6, 'rgba(16,28,25,0.5)');
    g.addColorStop(1, 'rgba(4,8,8,0.1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 760, 620);
    // Contours.
    ctx.strokeStyle = 'rgba(112,150,125,0.16)';
    for (let i = 0; i < 18; i += 1) {
      ctx.beginPath();
      for (let x = -20; x <= 780; x += 18) {
        const y = 80 + i * 30 + Math.sin(x * 0.008 + i) * 24;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Roads.
    ctx.strokeStyle = 'rgba(202,183,135,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, 480);
    ctx.lineTo(300, 330);
    ctx.lineTo(440, 320);
    ctx.lineTo(700, 160);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(202,183,135,0.12)';
    ctx.beginPath();
    ctx.moveTo(360, 580);
    ctx.lineTo(430, 320);
    ctx.lineTo(520, 100);
    ctx.stroke();
    // Settlement blocks.
    for (let i = 0; i < 16; i += 1) {
      ctx.fillStyle = `rgba(140,150,120,${0.05 + rand() * 0.07})`;
      ctx.fillRect(80 + rand() * 560, 90 + rand() * 430, 14 + rand() * 34, 10 + rand() * 24);
    }
    // Grid.
    ctx.strokeStyle = 'rgba(135,165,145,0.08)';
    for (let x = 0; x < 760; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 620);
      ctx.stroke();
    }
    for (let y = 0; y < 620; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(760, y);
      ctx.stroke();
    }
    // Map labels.
    ctx.fillStyle = 'rgba(203,190,150,0.5)';
    ctx.font = '10px Consolas, monospace';
    ctx.fillText('SECTOR 04', 52, 52);
    ctx.fillText('SAHRAK PASS', 52, 68);
    ctx.fillStyle = 'rgba(203,190,150,0.25)';
    ctx.fillText('34°41\'N  69°12\'E', 600, 590);
    refresh(BOOT_SCENE!, 'bg_tacmap');
  }
  // Crosshair reticle texture for HUD.
  {
    const ctx = makeTexture(BOOT_SCENE!, 'hud_crosshair', 72, 72);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    for (const [x1, y1, x2, y2] of [
      [36, 4, 36, 20],
      [36, 52, 36, 68],
      [4, 36, 20, 36],
      [52, 36, 68, 36],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(36, 36, 14, 0, Math.PI * 2);
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(35, 35, 2, 2);
    refresh(BOOT_SCENE!, 'hud_crosshair');
  }
}

/** Generate every texture used by the game. Called once from BootScene. */
export function generateAllTextures(scene: Phaser.Scene): void {
  BOOT_SCENE = scene;
  try {
    Object.entries(CHARACTERS).forEach(([key, palette], index) => {
      drawSoldier(`soldier_${key}`, palette, 1000 + index * 71);
    });
    drawVehicle('vehicle_jeep', 104, 54, 'jeep', 11);
    drawVehicle('vehicle_humvee', 118, 62, 'humvee', 22);
    drawVehicle('vehicle_apc', 140, 72, 'apc', 33);
    drawVehicle('vehicle_truck', 142, 66, 'truck', 44);
    drawVehicle('vehicle_recon', 108, 58, 'recon', 55);

    drawPine('prop_pine', false, 5);
    drawPine('prop_snow_pine', true, 7);
    drawRock('prop_rock', 8);
    drawRock('prop_rock_sand', 9, true);
    (['crate', 'barrel', 'sandbag', 'container', 'debris', 'cactus', 'tower', 'car_wreck'] as const).forEach((type) =>
      drawCrate(`prop_${type}`, type),
    );

    drawObjectiveProps();
    drawEffects();
    drawIcons();
    drawUiBackdrop();
    drawMisc();

    // Needle / compass.
    const ctx = makeTexture(scene, 'hud_needle', 64, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    poly(ctx, [[32, 4], [40, 32], [32, 26], [24, 32]]);
    ctx.fill();
    ctx.globalAlpha = 0.4;
    poly(ctx, [[32, 60], [40, 32], [32, 38], [24, 32]]);
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    refresh(scene, 'hud_needle');
  } finally {
    BOOT_SCENE = null;
  }
}
