import Phaser from 'phaser';
import type { BuildingDef, MapDef, PropDef, RoadDef, TimeOfDay } from '../core/types';
import { RNG } from '../core/rng';
import { NavGrid, Point, nearestOpenWorld } from '../systems/pathfinding';

export interface MapLight {
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha: number;
}

export interface PlacedProp {
  sprite: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  type: PropDef['type'];
}

export interface BuiltMap {
  map: MapDef;
  backgroundKey: string;
  worldW: number;
  worldH: number;
  tile: number;
  solids: Phaser.Physics.Arcade.StaticGroup;
  nav: NavGrid;
  spawn: Point;
  extraction: Point;
  zones: Record<string, Point>;
  vehicleSpawns: { type: string; x: number; y: number }[];
  enemySpawnZones: Point[];
  lights: MapLight[];
  props: PlacedProp[];
  findOpen(x: number, y: number, radius?: number): Point;
  cleanup(): void;
}

interface PropSpec {
  texture: string;
  displayW: number;
  displayH: number;
  solidW: number;
  solidH: number;
  blocksSight: boolean;
  shadowScale: number;
}

const PROP_SPECS: Record<PropDef['type'], PropSpec> = {
  tree: { texture: 'prop_pine', displayW: 150, displayH: 150, solidW: 24, solidH: 24, blocksSight: true, shadowScale: 1.1 },
  pine: { texture: 'prop_pine', displayW: 150, displayH: 150, solidW: 24, solidH: 24, blocksSight: true, shadowScale: 1.1 },
  snow_pine: { texture: 'prop_snow_pine', displayW: 144, displayH: 144, solidW: 24, solidH: 24, blocksSight: true, shadowScale: 1.1 },
  rock: { texture: 'prop_rock', displayW: 88, displayH: 78, solidW: 56, solidH: 44, blocksSight: true, shadowScale: 0.75 },
  crate: { texture: 'prop_crate', displayW: 58, displayH: 58, solidW: 46, solidH: 46, blocksSight: true, shadowScale: 0.55 },
  barrel: { texture: 'prop_barrel', displayW: 52, displayH: 52, solidW: 40, solidH: 40, blocksSight: true, shadowScale: 0.48 },
  sandbag: { texture: 'prop_sandbag', displayW: 104, displayH: 56, solidW: 96, solidH: 36, blocksSight: true, shadowScale: 0.7 },
  car_wreck: { texture: 'prop_car_wreck', displayW: 132, displayH: 74, solidW: 116, solidH: 54, blocksSight: true, shadowScale: 0.85 },
  container: { texture: 'prop_container', displayW: 160, displayH: 72, solidW: 150, solidH: 58, blocksSight: true, shadowScale: 0.9 },
  debris: { texture: 'prop_debris', displayW: 70, displayH: 70, solidW: 0, solidH: 0, blocksSight: false, shadowScale: 0.55 },
  cactus: { texture: 'prop_cactus', displayW: 68, displayH: 68, solidW: 22, solidH: 22, blocksSight: true, shadowScale: 0.6 },
  tower: { texture: 'prop_tower', displayW: 116, displayH: 116, solidW: 92, solidH: 92, blocksSight: true, shadowScale: 1 },
};

const ENV_SCATTER: Record<MapDef['env'], { type: PropDef['type']; weight: number; amount: number }[]> = {
  forest: [
    { type: 'pine', weight: 1, amount: 74 },
    { type: 'rock', weight: 0.15, amount: 10 },
    { type: 'debris', weight: 0.2, amount: 12 },
  ],
  urban: [
    { type: 'debris', weight: 1, amount: 34 },
    { type: 'car_wreck', weight: 0.2, amount: 6 },
    { type: 'crate', weight: 0.35, amount: 10 },
    { type: 'barrel', weight: 0.3, amount: 10 },
    { type: 'sandbag', weight: 0.18, amount: 5 },
  ],
  fortress: [
    { type: 'container', weight: 0.3, amount: 8 },
    { type: 'crate', weight: 0.8, amount: 16 },
    { type: 'barrel', weight: 0.5, amount: 14 },
    { type: 'sandbag', weight: 0.4, amount: 7 },
    { type: 'debris', weight: 0.4, amount: 10 },
  ],
  desert: [
    { type: 'cactus', weight: 0.9, amount: 26 },
    { type: 'rock', weight: 0.7, amount: 20 },
    { type: 'debris', weight: 0.25, amount: 10 },
    { type: 'sandbag', weight: 0.12, amount: 4 },
  ],
  arctic: [
    { type: 'snow_pine', weight: 1, amount: 40 },
    { type: 'rock', weight: 0.35, amount: 16 },
    { type: 'crate', weight: 0.3, amount: 8 },
    { type: 'barrel', weight: 0.2, amount: 6 },
    { type: 'container', weight: 0.1, amount: 4 },
    { type: 'debris', weight: 0.25, amount: 8 },
  ],
};

/**
 * Deterministic map builder. Terrain, roads, cutaway buildings, interiors,
 * props, collision and navigation are produced from the authored MapDef, so
 * every mission is visually distinct but physically identical for save/reload.
 */
export class MapBuilder {
  private scene: Phaser.Scene;
  private map: MapDef;
  private rng: RNG;
  private timeOfDay: TimeOfDay;
  private highQuality: boolean;
  private key: string;
  private solids: Phaser.Physics.Arcade.StaticGroup;
  private nav: NavGrid;
  private placed: PlacedProp[] = [];
  private lights: MapLight[] = [];
  private occupied: { x: number; y: number; w: number; h: number }[] = [];
  private roadRects: { x: number; y: number; w: number; h: number }[] = [];
  private zoneWorld: Record<string, Point> = {};
  private worldW: number;
  private worldH: number;
  private ctx!: CanvasRenderingContext2D;

  constructor(scene: Phaser.Scene, map: MapDef, timeOfDay: TimeOfDay, seed: number, highQuality = true) {
    this.scene = scene;
    this.map = map;
    this.rng = new RNG(seed);
    this.timeOfDay = timeOfDay;
    this.highQuality = highQuality;
    this.key = `map_${map.id}_${seed}_${timeOfDay}`;
    this.worldW = map.cols * map.tile;
    this.worldH = map.rows * map.tile;
    this.solids = scene.physics.add.staticGroup();
    this.nav = {
      cols: map.cols,
      rows: map.rows,
      tile: map.tile,
      blocked: Array.from({ length: map.rows }, () => Array<boolean>(map.cols).fill(false)),
    };
    for (const [name, zone] of Object.entries(map.zones)) {
      this.zoneWorld[name] = {
        x: zone.x * map.tile + map.tile / 2,
        y: zone.y * map.tile + map.tile / 2,
      };
    }
    for (const road of map.roads) {
      this.roadRects.push({
        x: road.x * map.tile,
        y: road.y * map.tile,
        w: road.w * map.tile,
        h: road.h * map.tile,
      });
    }
  }

  build(): BuiltMap {
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
    const texture = this.scene.textures.createCanvas(this.key, this.worldW, this.worldH);
    if (!texture) throw new Error('Unable to create map canvas');
    this.ctx = texture.getContext();
    this.paintGround();
    this.paintRoads();
    for (const building of this.map.buildings) this.paintBuilding(building);
    this.paintWorldDressing();
    this.drawRoadFurniture();
    texture.refresh();

    const bg = this.scene.add.image(0, 0, this.key).setOrigin(0).setDepth(-1000);
    bg.setName('map-background');

    this.scatterProps();
    for (const prop of this.map.props) {
      const p = { x: prop.x * this.map.tile + this.map.tile / 2, y: prop.y * this.map.tile + this.map.tile / 2 };
      this.addProp(prop.type, p.x, p.y, prop.rot ?? 0, prop.solid !== false);
    }

    const spawn = this.findOpen(
      this.zoneWorld.spawn?.x ?? 100,
      this.zoneWorld.spawn?.y ?? 100,
      12,
    );
    const extraction = this.findOpen(
      this.zoneWorld.extraction?.x ?? this.worldW - 200,
      this.zoneWorld.extraction?.y ?? this.worldH - 200,
      12,
    );

    const enemySpawnZones: Point[] = ['enemyNorth', 'enemyEast', 'enemySouth', 'enemyWest', 'overlook']
      .map((name) => this.zoneWorld[name])
      .filter((p): p is Point => Boolean(p));

    const vehicleSpawns = this.map.vehicleSpawns.map((v) => {
      const world = { x: v.x * this.map.tile + this.map.tile / 2, y: v.y * this.map.tile + this.map.tile / 2 };
      const open = nearestOpenWorld(this.nav, world.x, world.y, 6) ?? world;
      return { type: v.type, x: open.x, y: open.y };
    });

    // Guarantee a navigable cell under each authored zone.
    for (const [name, point] of Object.entries(this.zoneWorld)) {
      const open = nearestOpenWorld(this.nav, point.x, point.y, 10);
      if (open) this.zoneWorld[name] = open;
    }
    this.lights.push({ x: extraction.x, y: extraction.y, radius: 170, color: 0xff7b4a, alpha: 0.35 });

    for (const building of this.map.buildings) {
      // Doorway work lights.
      for (const door of building.doors) {
        const p = this.doorCenter(building, door);
        this.lights.push({ x: p.x, y: p.y, radius: 125, color: this.map.palette.light, alpha: this.timeOfDay === 'day' ? 0.08 : 0.32 });
      }
    }

    for (const prop of this.placed) {
      if (prop.type === 'tower') this.lights.push({ x: prop.x, y: prop.y, radius: 230, color: 0xffe0a0, alpha: 0.35 });
    }

    const map = this.map;
    return {
      map,
      backgroundKey: this.key,
      worldW: this.worldW,
      worldH: this.worldH,
      tile: map.tile,
      solids: this.solids,
      nav: this.nav,
      spawn,
      extraction,
      zones: this.zoneWorld,
      vehicleSpawns,
      enemySpawnZones,
      lights: this.lights,
      props: this.placed,
      findOpen: (x, y, radius = 8) => nearestOpenWorld(this.nav, x, y, radius) ?? { x, y },
      cleanup: () => this.cleanup(bg),
    };
  }

  private cleanup(bg: Phaser.GameObjects.Image): void {
    bg.destroy();
    for (const prop of this.placed) {
      prop.sprite.destroy();
      prop.shadow?.destroy();
    }
    this.placed = [];
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }

  // ── Ground & roads ───────────────────────────────────────────────────────

  private paintGround(): void {
    const ctx = this.ctx;
    const { palette, env, tile } = this.map;
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, 0, this.worldW, this.worldH);

    const variants: Record<MapDef['env'], string[]> = {
      forest: ['#1a2a1e', '#1c2e20', '#152319', '#203225', '#233828'],
      urban: ['#252524', '#2a2927', '#1f211f', '#2d2b28', '#232423'],
      fortress: ['#2c2d28', '#30312b', '#272823', '#34352e', '#2a2b26'],
      desert: ['#5b4b30', '#665538', '#514229', '#6b593b', '#5f4e33'],
      arctic: ['#4d5862', '#53606b', '#46515b', '#5b6873', '#515d67'],
    };
    const colors = variants[env];
    for (let row = 0; row < this.map.rows; row += 1) {
      for (let col = 0; col < this.map.cols; col += 1) {
        const r = this.rng.next();
        if (r < 0.45) {
          ctx.globalAlpha = 0.16 + r * 0.2;
          ctx.fillStyle = colors[Math.floor(this.rng.next() * colors.length)];
          ctx.fillRect(col * tile, row * tile, tile + 1, tile + 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Large organic tonal patches.
    const patchColors: Record<MapDef['env'], string[]> = {
      forest: ['#1f3524', '#122118', '#2a3d29', '#1f2f1e'],
      urban: ['#2e2c28', '#1c1d1c', '#383630', '#23211f'],
      fortress: ['#383a32', '#25261f', '#31352c'],
      desert: ['#6b593a', '#4c3d27', '#756342', '#5a4930'],
      arctic: ['#5f6d79', '#414b55', '#66757f', '#4a5660'],
    };
    for (let i = 0; i < 36; i += 1) {
      const x = this.rng.range(0, this.worldW);
      const y = this.rng.range(0, this.worldH);
      const rx = this.rng.range(90, 360);
      const ry = this.rng.range(60, 240);
      ctx.globalAlpha = this.rng.range(0.03, 0.1);
      ctx.fillStyle = patchColors[env][i % patchColors[env].length];
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, this.rng.range(0, Math.PI), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.paintEnvironmentDetails();
    const speckColors: Record<MapDef['env'], string[]> = {
      forest: ['#7e9860', '#0c190e', '#425a39', '#9a8f64'],
      urban: ['#8e8a7f', '#0d0e0d', '#5a584f', '#b2a98f'],
      fortress: ['#909384', '#131410', '#5a5d51', '#b3b09a'],
      desert: ['#c6aa76', '#3b2e1d', '#8a704a', '#dfc394'],
      arctic: ['#a9bcc7', '#2d353d', '#778894', '#dce8f0'],
    };
    for (let i = 0; i < 26000; i += 1) {
      ctx.globalAlpha = this.rng.range(0.03, 0.13);
      ctx.fillStyle = speckColors[env][Math.floor(this.rng.next() * speckColors[env].length)];
      const s = this.rng.range(0.6, 2.2);
      ctx.fillRect(this.rng.range(0, this.worldW), this.rng.range(0, this.worldH), s, s);
    }
    ctx.globalAlpha = 1;
  }

  private paintEnvironmentDetails(): void {
    const ctx = this.ctx;
    const { env, tile } = this.map;
    if (env === 'forest') {
      for (let i = 0; i < 3400; i += 1) {
        const x = this.rng.range(0, this.worldW);
        const y = this.rng.range(0, this.worldH);
        ctx.strokeStyle = this.rng.chance(0.35) ? 'rgba(112,138,78,0.20)' : 'rgba(61,83,48,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + this.rng.range(-4, 4), y - this.rng.range(3, 10));
        ctx.stroke();
      }
      for (let i = 0; i < 500; i += 1) {
        ctx.fillStyle = this.rng.chance(0.5) ? 'rgba(138,108,55,0.35)' : 'rgba(103,82,41,0.25)';
        ctx.beginPath();
        ctx.ellipse(this.rng.range(0, this.worldW), this.rng.range(0, this.worldH), this.rng.range(1, 3), this.rng.range(0.6, 1.6), this.rng.range(0, 3), 0, Math.PI * 2);
        ctx.fill();
      }
      // Fallen logs.
      for (let i = 0; i < 10; i += 1) {
        const x = this.rng.range(100, this.worldW - 100);
        const y = this.rng.range(100, this.worldH - 100);
        const angle = this.rng.range(0, Math.PI);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = 'rgba(52,39,24,0.55)';
        ctx.fillRect(-40, -5, 80, 10);
        ctx.fillStyle = 'rgba(95,75,45,0.4)';
        ctx.fillRect(-38, -4, 76, 3);
        ctx.restore();
      }
    } else if (env === 'urban') {
      // Cracks and pavement seams.
      for (let i = 0; i < 60; i += 1) {
        const x = this.rng.range(0, this.worldW);
        const y = this.rng.range(0, this.worldH);
        ctx.strokeStyle = 'rgba(8,9,9,0.42)';
        ctx.lineWidth = this.rng.range(0.8, 2);
        ctx.beginPath();
        ctx.moveTo(x, y);
        let px = x;
        let py = y;
        for (let s = 0; s < 6; s += 1) {
          px += this.rng.range(-18, 18);
          py += this.rng.range(-14, 14);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 18; i += 1) {
        ctx.strokeStyle = 'rgba(120,118,108,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.rng.range(0, this.worldW), this.rng.range(0, this.worldH), this.rng.range(22, 56), 0, Math.PI * 2);
        ctx.stroke();
      }
      // Burn stains.
      for (let i = 0; i < 20; i += 1) {
        const x = this.rng.range(0, this.worldW);
        const y = this.rng.range(0, this.worldH);
        const g = ctx.createRadialGradient(x, y, 2, x, y, this.rng.range(26, 70));
        g.addColorStop(0, 'rgba(5,5,4,0.5)');
        g.addColorStop(1, 'rgba(5,5,4,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 80, y - 80, 160, 160);
      }
    } else if (env === 'fortress') {
      ctx.strokeStyle = 'rgba(16,17,15,0.32)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < this.worldW; x += tile * 3) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.worldH);
        ctx.stroke();
      }
      for (let y = 0; y < this.worldH; y += tile * 3) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.worldW, y);
        ctx.stroke();
      }
      for (let i = 0; i < 2800; i += 1) {
        ctx.fillStyle = `rgba(${this.rng.chance(0.5) ? '145,148,135' : '70,73,64'},0.16)`;
        ctx.fillRect(this.rng.range(0, this.worldW), this.rng.range(0, this.worldH), 1.5, 1.5);
      }
    } else if (env === 'desert') {
      for (let i = 0; i < 480; i += 1) {
        const x = this.rng.range(0, this.worldW);
        const y = this.rng.range(0, this.worldH);
        ctx.strokeStyle = this.rng.chance(0.45) ? 'rgba(184,157,112,0.14)' : 'rgba(62,48,30,0.18)';
        ctx.lineWidth = this.rng.range(0.7, 1.6);
        ctx.beginPath();
        for (let p = 0; p < 4; p += 1) {
          const px = x + p * 16;
          const py = y + Math.sin(p * 0.9 + i) * 6;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 600; i += 1) {
        ctx.fillStyle = this.rng.chance(0.5) ? 'rgba(150,124,80,0.28)' : 'rgba(85,66,41,0.3)';
        ctx.beginPath();
        ctx.arc(this.rng.range(0, this.worldW), this.rng.range(0, this.worldH), this.rng.range(1, 4), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (env === 'arctic') {
      for (let i = 0; i < 80; i += 1) {
        const x = this.rng.range(0, this.worldW);
        const y = this.rng.range(0, this.worldH);
        const r = this.rng.range(24, 130);
        ctx.fillStyle = this.rng.chance(0.45) ? 'rgba(160,180,192,0.12)' : 'rgba(188,205,214,0.09)';
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.6, r * 0.55, this.rng.range(-0.4, 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 900; i += 1) {
        const x = this.rng.range(0, this.worldW);
        const y = this.rng.range(0, this.worldH);
        ctx.strokeStyle = 'rgba(222,237,246,0.13)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + this.rng.range(20, 70), y + this.rng.range(-4, 4));
        ctx.stroke();
      }
      // Wind-scoured ice patches.
      for (let i = 0; i < 9; i += 1) {
        const x = this.rng.range(0, this.worldW);
        const y = this.rng.range(0, this.worldH);
        ctx.fillStyle = 'rgba(140,170,186,0.12)';
        ctx.beginPath();
        ctx.ellipse(x, y, this.rng.range(60, 170), this.rng.range(30, 80), this.rng.range(0, 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private paintRoads(): void {
    const ctx = this.ctx;
    const tile = this.map.tile;
    for (const road of this.map.roads) {
      const x = road.x * tile;
      const y = road.y * tile;
      const w = road.w * tile;
      const h = road.h * tile;
      if (road.style === 'asphalt') {
        ctx.fillStyle = this.map.palette.road;
        ctx.fillRect(x, y, w, h);
        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, 'rgba(0,0,0,0.25)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.015)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);
        // Curbs.
        ctx.fillStyle = 'rgba(115,112,103,0.42)';
        if (w > h) {
          ctx.fillRect(x, y - 4, w, 4);
          ctx.fillRect(x, y + h, w, 4);
        } else {
          ctx.fillRect(x - 4, y, 4, h);
          ctx.fillRect(x + w, y, 4, h);
        }
        // Center dashes.
        ctx.strokeStyle = 'rgba(196,178,120,0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([26, 26]);
        ctx.beginPath();
        if (w > h) {
          ctx.moveTo(x + 20, y + h / 2);
          ctx.lineTo(x + w - 20, y + h / 2);
        } else {
          ctx.moveTo(x + w / 2, y + 20);
          ctx.lineTo(x + w / 2, y + h - 20);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // Tyre wear.
        ctx.strokeStyle = 'rgba(0,0,0,0.13)';
        ctx.lineWidth = 8;
        for (const off of [-h * 0.2, h * 0.2]) {
          ctx.beginPath();
          if (w > h) {
            ctx.moveTo(x + 20, y + h / 2 + off);
            ctx.lineTo(x + w - 20, y + h / 2 + off);
          } else {
            ctx.moveTo(x + w / 2 + off, y + 20);
            ctx.lineTo(x + w / 2 + off, y + h - 20);
          }
          ctx.stroke();
        }
      } else if (road.style === 'dirt') {
        ctx.fillStyle = this.map.env === 'desert' ? '#665235' : '#3b3425';
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 40; i += 1) {
          ctx.fillStyle = this.rng.chance(0.5) ? '#88754f' : '#2e291d';
          ctx.beginPath();
          ctx.ellipse(x + this.rng.range(0, w), y + this.rng.range(0, h), this.rng.range(4, 24), this.rng.range(2, 9), this.rng.range(0, 3), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(22,19,13,0.3)';
        ctx.lineWidth = 5;
        for (const off of [-h * 0.18, h * 0.18]) {
          ctx.beginPath();
          if (w > h) {
            ctx.moveTo(x, y + h / 2 + off);
            ctx.lineTo(x + w, y + h / 2 + off);
          } else {
            ctx.moveTo(x + w / 2 + off, y);
            ctx.lineTo(x + w / 2 + off, y + h);
          }
          ctx.stroke();
        }
      } else {
        // Concrete apron.
        ctx.fillStyle = this.map.palette.road;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(15,16,14,0.35)';
        ctx.lineWidth = 1.5;
        for (let gx = x; gx < x + w; gx += tile * 2) {
          ctx.beginPath();
          ctx.moveTo(gx, y);
          ctx.lineTo(gx, y + h);
          ctx.stroke();
        }
        for (let gy = y; gy < y + h; gy += tile * 2) {
          ctx.beginPath();
          ctx.moveTo(x, gy);
          ctx.lineTo(x + w, gy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for (let i = 0; i < 30; i += 1) {
          ctx.fillRect(x + this.rng.range(0, w - 30), y + this.rng.range(0, h - 10), this.rng.range(10, 40), this.rng.range(2, 8));
        }
      }
      // Edge grime.
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#050605';
      ctx.fillRect(x, y, w, 3);
      ctx.fillRect(x, y + h - 3, w, 3);
      ctx.globalAlpha = 1;
    }
  }

  // ── Buildings ────────────────────────────────────────────────────────────

  private paintBuilding(building: BuildingDef): void {
    const ctx = this.ctx;
    const tile = this.map.tile;
    const x = building.x * tile;
    const y = building.y * tile;
    const w = building.w * tile;
    const h = building.h * tile;
    const thick = 16;
    const zonePoints = Object.values(this.zoneWorld);

    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 10, y + 12, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 18, y + 22, w, h);

    // Footprint / floor.
    const floorColors: Record<BuildingDef['style'], string> = {
      cabin: '#453624',
      ruin: '#383632',
      barracks: '#3d3c33',
      hangar: '#353731',
      lab: '#3d484d',
      adobe: '#6b5639',
      warehouse: '#3c3a31',
      command: '#353b39',
    };
    ctx.fillStyle = floorColors[building.style] ?? this.map.palette.floor;
    ctx.fillRect(x + thick, y + thick, w - thick * 2, h - thick * 2);

    // Floor pattern.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + thick, y + thick, w - thick * 2, h - thick * 2);
    ctx.clip();
    if (building.style === 'cabin') {
      ctx.strokeStyle = 'rgba(23,17,10,0.55)';
      ctx.lineWidth = 1;
      for (let py = y + thick; py < y + h - thick; py += 8) {
        ctx.beginPath();
        ctx.moveTo(x + thick, py);
        ctx.lineTo(x + w - thick, py);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(130,92,45,0.18)';
      ctx.fillRect(x + thick, y + thick, w - thick * 2, 6);
    } else if (building.style === 'adobe') {
      ctx.strokeStyle = 'rgba(45,33,19,0.3)';
      ctx.lineWidth = 1;
      for (let py = y + thick; py < y + h - thick; py += 24) {
        ctx.beginPath();
        ctx.moveTo(x + thick, py);
        ctx.lineTo(x + w - thick, py);
        ctx.stroke();
      }
    } else if (building.style === 'lab' || building.style === 'command') {
      ctx.strokeStyle = 'rgba(12,16,17,0.4)';
      ctx.lineWidth = 1;
      for (let px = x + thick; px < x + w - thick; px += 32) {
        ctx.beginPath();
        ctx.moveTo(px, y + thick);
        ctx.lineTo(px, y + h - thick);
        ctx.stroke();
      }
      for (let py = y + thick; py < y + h - thick; py += 32) {
        ctx.beginPath();
        ctx.moveTo(x + thick, py);
        ctx.lineTo(x + w - thick, py);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(12,13,12,0.32)';
      ctx.lineWidth = 1;
      for (let px = x + thick; px < x + w - thick; px += 48) {
        ctx.beginPath();
        ctx.moveTo(px, y + thick);
        ctx.lineTo(px, y + h - thick);
        ctx.stroke();
      }
    }
    // Grime and interior debris.
    for (let i = 0; i < 46; i += 1) {
      ctx.globalAlpha = this.rng.range(0.04, 0.14);
      ctx.fillStyle = this.rng.chance(0.5) ? '#0a0a08' : '#b1a689';
      ctx.beginPath();
      ctx.ellipse(x + this.rng.range(thick, w - thick), y + this.rng.range(thick, h - thick), this.rng.range(2, 18), this.rng.range(1, 7), this.rng.range(0, 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Interior furniture outlines (baked visual detail).
    const furnitureCount = building.interiorProps ?? 0;
    for (let i = 0; i < furnitureCount; i += 1) {
      const fx = x + thick + 28 + this.rng.next() * Math.max(10, w - thick * 2 - 56);
      const fy = y + thick + 28 + this.rng.next() * Math.max(10, h - thick * 2 - 56);
      if (zonePoints.some((z) => Math.hypot(z.x - (fx + 20), z.y - (fy + 14)) < 70)) continue;
      ctx.fillStyle = building.style === 'cabin' ? 'rgba(34,25,15,0.75)' : 'rgba(20,22,20,0.6)';
      ctx.fillRect(fx, fy, this.rng.range(20, 44), this.rng.range(14, 26));
      ctx.strokeStyle = 'rgba(150,145,125,0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(fx, fy, 28, 18);
      if (this.rng.chance(0.4)) {
        this.addInteriorProp(building, x + fx + 20, y + fy + 20, building.style === 'cabin' ? 'crate' : 'barrel');
      }
    }

    // Interior partition walls.
    for (const part of building.partitions ?? []) {
      const gap = part.gap * tile;
      if (part.axis === 'v') {
        const px = x + part.at * tile;
        const start = y + thick;
        const end = y + h - thick;
        const mid = (start + end) / 2;
        this.drawWallSegment(px - 5, start, 10, mid - gap / 2 - start, true, false);
        this.drawWallSegment(px - 5, mid + gap / 2, 10, end - (mid + gap / 2), true, false);
        this.addSolid({ x: px - 5, y: start, w: 10, h: mid - gap / 2 - start }, true);
        this.addSolid({ x: px - 5, y: mid + gap / 2, w: 10, h: end - mid - gap / 2 }, true);
      } else {
        const py = y + part.at * tile;
        const start = x + thick;
        const end = x + w - thick;
        const mid = (start + end) / 2;
        this.drawWallSegment(start, py - 5, mid - gap / 2 - start, 10, false, false);
        this.drawWallSegment(mid + gap / 2, py - 5, end - mid - gap / 2, 10, false, false);
        this.addSolid({ x: start, y: py - 5, w: mid - gap / 2 - start, h: 10 }, true);
        this.addSolid({ x: mid + gap / 2, y: py - 5, w: end - mid - gap / 2, h: 10 }, true);
      }
    }

    // Exterior walls with real door gaps.
    this.drawExteriorWalls(building, x, y, w, h, thick);

    // Floor label.
    ctx.save();
    ctx.fillStyle = 'rgba(214,203,172,0.22)';
    ctx.font = 'bold 10px Consolas, monospace';
    ctx.fillText(building.label ?? '', x + thick + 14, y + h - thick - 12);
    ctx.restore();

    this.occupied.push({ x: x - 10, y: y - 10, w: w + 20, h: h + 20 });
  }

  private drawWallSegment(x: number, y: number, w: number, h: number, vertical: boolean, exterior: boolean): void {
    if (w <= 0 || h <= 0) return;
    const ctx = this.ctx;
    const base = this.map.palette.wall;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + (vertical ? 3 : 1), y + (vertical ? 1 : 3), w, h);
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = this.map.palette.wallTop;
    if (vertical) ctx.fillRect(x, y, 3, h);
    else ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    if (vertical) ctx.fillRect(x + w - 3, y, 3, h);
    else ctx.fillRect(x, y + h - 3, w, 3);
    // Weathering.
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#000000';
    for (let i = 0; i < Math.max(1, Math.floor((vertical ? h : w) / 32)); i += 1) {
      const t = this.rng.next();
      if (vertical) ctx.fillRect(x + 3, y + t * h, w - 6, 1.5);
      else ctx.fillRect(x + t * w, y + 3, 1.5, h - 6);
    }
    ctx.globalAlpha = 1;
    // Window slit (visual only; wall remains solid).
    if (exterior && (vertical ? h : w) > 130) {
      ctx.fillStyle = 'rgba(30,44,48,0.75)';
      if (vertical) ctx.fillRect(x + w / 2 - 2, y + 24, 4, Math.min(30, h - 48));
      else ctx.fillRect(x + 24, y + h / 2 - 2, Math.min(30, w - 48), 4);
      ctx.fillStyle = 'rgba(170,200,205,0.15)';
      if (vertical) ctx.fillRect(x + w / 2 - 1, y + 24, 2, Math.min(30, h - 48));
      else ctx.fillRect(x + 24, y + h / 2 - 1, Math.min(30, w - 48), 2);
    }
  }

  private drawExteriorWalls(building: BuildingDef, x: number, y: number, w: number, h: number, thick: number): void {
    const sides: ('n' | 's' | 'e' | 'w')[] = ['n', 's', 'w', 'e'];
    for (const side of sides) {
      const doors = building.doors.filter((d) => d.side === side);
      const horizontal = side === 'n' || side === 's';
      const length = horizontal ? w : h;
      const start = horizontal ? x : y;
      const gaps = doors.map((door) => {
        const center = start + door.offset * this.map.tile;
        const half = (door.width * this.map.tile) / 2;
        return { from: Math.max(start, center - half), to: Math.min(start + length, center + half) };
      }).sort((a, b) => a.from - b.from);

      let cursor = start;
      for (const gap of gaps) {
        if (gap.from > cursor) this.drawSidePart(side, cursor, gap.from - cursor, x, y, w, h, thick);
        // Threshold plate in the gap.
        if (side === 'n') this.drawThreshold(gap.from, y + thick - 3, gap.to - gap.from, 6);
        if (side === 's') this.drawThreshold(gap.from, y + h - thick - 3, gap.to - gap.from, 6);
        if (side === 'w') this.drawThreshold(x + thick - 3, gap.from, 6, gap.to - gap.from);
        if (side === 'e') this.drawThreshold(x + w - thick - 3, gap.from, 6, gap.to - gap.from);
        cursor = gap.to;
      }
      if (cursor < start + length) this.drawSidePart(side, cursor, start + length - cursor, x, y, w, h, thick);
    }

    // Corner posts.
    const ctx = this.ctx;
    for (const [cx, cy] of [
      [x, y],
      [x + w - thick, y],
      [x, y + h - thick],
      [x + w - thick, y + h - thick],
    ]) {
      ctx.fillStyle = this.map.palette.wallTop;
      ctx.fillRect(cx, cy, thick, thick);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, thick, thick);
    }
  }

  private drawSidePart(
    side: 'n' | 's' | 'e' | 'w',
    from: number,
    length: number,
    x: number,
    y: number,
    w: number,
    h: number,
    thick: number,
  ): void {
    if (length <= 0) return;
    if (side === 'n') {
      this.drawWallSegment(from, y, length, thick, false, true);
      this.addSolid({ x: from, y: y + 2, w: length, h: thick - 4 }, true);
    } else if (side === 's') {
      this.drawWallSegment(from, y + h - thick, length, thick, false, true);
      this.addSolid({ x: from, y: y + h - thick + 2, w: length, h: thick - 4 }, true);
    } else if (side === 'w') {
      this.drawWallSegment(x, from, thick, length, true, true);
      this.addSolid({ x: x + 2, y: from, w: thick - 4, h: length }, true);
    } else {
      this.drawWallSegment(x + w - thick, from, thick, length, true, true);
      this.addSolid({ x: x + w - thick + 2, y: from, w: thick - 4, h: length }, true);
    }
  }

  private drawThreshold(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(190,170,125,0.28)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(220,205,166,0.24)';
    ctx.lineWidth = 1;
    if (w > h) {
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w, y + h / 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y + h);
      ctx.stroke();
    }
  }

  private paintWorldDressing(): void {
    const ctx = this.ctx;
    // Sidewalk/apron around buildings.
    for (const building of this.map.buildings) {
      const tile = this.map.tile;
      const x = building.x * tile - 10;
      const y = building.y * tile - 12;
      const w = building.w * tile + 20;
      const h = building.h * tile + 22;
      ctx.strokeStyle = 'rgba(150,148,130,0.12)';
      ctx.lineWidth = 5;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
    }
    // Scorch marks near battle damage.
    for (let i = 0; i < 14; i += 1) {
      const x = this.rng.range(60, this.worldW - 60);
      const y = this.rng.range(60, this.worldH - 60);
      const g = ctx.createRadialGradient(x, y, 2, x, y, this.rng.range(24, 70));
      g.addColorStop(0, 'rgba(9,8,6,0.3)');
      g.addColorStop(1, 'rgba(9,8,6,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 80, y - 80, 160, 160);
      if (this.rng.chance(0.5)) {
        ctx.fillStyle = 'rgba(70,60,45,0.35)';
        for (let j = 0; j < 8; j += 1) {
          ctx.fillRect(x + this.rng.range(-20, 20), y + this.rng.range(-20, 20), this.rng.range(1, 5), this.rng.range(1, 4));
        }
      }
    }
  }

  private drawRoadFurniture(): void {
    const ctx = this.ctx;
    const tile = this.map.tile;
    // Street lamps along the long roads.
    for (const road of this.map.roads) {
      if (road.w < 3 && road.h < 3) continue;
      const horizontal = road.w > road.h;
      const length = horizontal ? road.w : road.h;
      const count = Math.floor(length / 8);
      for (let i = 1; i < count; i += 1) {
        const t = (i / count) * length;
        const lx = horizontal ? road.x * tile + t * tile : (road.x + (i % 2 ? 0.5 : road.w)) * tile;
        const ly = horizontal ? (road.y + (i % 2 ? 0.5 : road.h)) * tile : road.y * tile + t * tile;
        if (this.rng.chance(0.4)) continue;
        // Lamp post.
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(lx + 5, ly + 5, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a2c27';
        ctx.beginPath();
        ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b7a46b';
        ctx.beginPath();
        ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
        ctx.fill();
        if (this.timeOfDay !== 'day') {
          this.lights.push({ x: lx, y: ly, radius: 150, color: this.map.palette.light, alpha: 0.28 });
        }
        this.addSolid({ x: lx - 6, y: ly - 6, w: 12, h: 12 }, false);
      }
    }
    // Extraction landing markings.
    const ext = this.zoneWorld.extraction;
    if (ext) {
      ctx.strokeStyle = 'rgba(230,190,110,0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([18, 12]);
      ctx.beginPath();
      ctx.arc(ext.x, ext.y, 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(230,190,110,0.18)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(ext.x - 80, ext.y);
      ctx.lineTo(ext.x, ext.y - 50);
      ctx.lineTo(ext.x + 80, ext.y);
      ctx.lineTo(ext.x, ext.y + 50);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(230,190,110,0.18)';
      ctx.font = 'bold 13px Consolas, monospace';
      ctx.fillText('LZ', ext.x - 8, ext.y + 5);
    }
  }

  // ── Props ───────────────────────────────────────────────────────────────

  private scatterProps(): void {
    const config = ENV_SCATTER[this.map.env];
    for (const entry of config) {
      let placedCount = 0;
      let attempts = 0;
      while (placedCount < entry.amount && attempts < entry.amount * 25) {
        attempts += 1;
        const x = this.rng.range(80, this.worldW - 80);
        const y = this.rng.range(80, this.worldH - 80);
        if (!this.isScatterSpotFree(x, y, entry.type)) continue;
        this.addProp(entry.type, x, y, this.rng.range(0, Math.PI * 2), true);
        placedCount += 1;
      }
    }
  }

  private isScatterSpotFree(x: number, y: number, type: PropDef['type']): boolean {
    const spec = PROP_SPECS[type];
    if (spec.solidW > 0 && !nearestOpenWorld(this.nav, x, y, 0)) {
      // This check will almost always return a cell; verify the cell itself is open.
    }
    const cell = { col: Math.floor(x / this.map.tile), row: Math.floor(y / this.map.tile) };
    if (this.nav.blocked[cell.row]?.[cell.col]) return false;
    // Explicit keep-out around every zone / spawn.
    for (const zone of Object.values(this.map.zones)) {
      const zx = zone.x * this.map.tile;
      const zy = zone.y * this.map.tile;
      if (Math.hypot(zx - x, zy - y) < this.map.tile * 2.5) return false;
    }
    // Keep buildings clear (interiors receive their own props).
    for (const rect of this.occupied) {
      if (x > rect.x - 34 && x < rect.x + rect.w + 34 && y > rect.y - 34 && y < rect.y + rect.h + 34) return false;
    }
    // Avoid roads for large natural objects.
    if (type === 'pine' || type === 'snow_pine' || type === 'tree' || type === 'cactus' || type === 'sandbag' || type === 'container' || type === 'tower') {
      for (const road of this.roadRects) {
        if (x > road.x - 35 && x < road.x + road.w + 35 && y > road.y - 35 && y < road.y + road.h + 35) return false;
      }
    }
    for (const prop of this.placed) {
      if (Math.hypot(prop.x - x, prop.y - y) < 58) return false;
    }
    // Leave the extraction clear.
    const ext = this.map.zones.extraction;
    if (ext && Math.hypot(ext.x * this.map.tile - x, ext.y * this.map.tile - y) < 220) return false;
    return true;
  }

  private addInteriorProp(building: BuildingDef, x: number, y: number, type: PropDef['type']): void {
    // Ensure it stays inside the floor and away from objective zones.
    const tile = this.map.tile;
    const inside =
      x > building.x * tile + 30 &&
      x < (building.x + building.w) * tile - 30 &&
      y > building.y * tile + 30 &&
      y < (building.y + building.h) * tile - 30;
    if (!inside) return;
    for (const zone of Object.values(this.zoneWorld)) {
      if (Math.hypot(zone.x - x, zone.y - y) < 80) return;
    }
    this.addProp(type, x, y, this.rng.range(0, Math.PI * 2), true, true);
  }

  private addProp(type: PropDef['type'], x: number, y: number, rotation: number, solid: boolean, interior = false): void {
    const spec = PROP_SPECS[type];
    const shadow = this.scene.add
      .image(x + 7, y + 13, 'fx_shadow')
      .setDisplaySize(spec.displayW * 0.7 * spec.shadowScale, spec.displayH * 0.45 * spec.shadowScale)
      .setAlpha(0.5)
      .setDepth(y - 4);
    const sprite = this.scene.add
      .image(x, y, spec.texture)
      .setDisplaySize(spec.displayW, spec.displayH)
      .setRotation(type === 'car_wreck' || type === 'container' || type === 'sandbag' ? rotation : rotation * 0.12)
      .setDepth(y + spec.displayH * 0.18);
    if (type === 'debris') sprite.setAlpha(0.9);
    this.placed.push({ sprite, shadow, x, y, type });
    if (solid && spec.solidW > 0) {
      this.addSolid({ x: x - spec.solidW / 2, y: y - spec.solidH / 2, w: spec.solidW, h: spec.solidH }, spec.blocksSight);
      // Interior props should not block the only path in tiny rooms: keep
      // their collision footprint reduced.
      if (interior) {
        // No-op: the solid size is already conservative.
      }
    }
  }

  // ── Collision / navigation ───────────────────────────────────────────────

  private addSolid(rect: { x: number; y: number; w: number; h: number }, blocksSight: boolean): void {
    if (rect.w <= 0 || rect.h <= 0) return;
    const zone = this.scene.add.zone(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h);
    this.solids.add(zone);
    if (blocksSight) {
      const minCol = Math.max(0, Math.floor(rect.x / this.map.tile));
      const maxCol = Math.min(this.map.cols - 1, Math.floor((rect.x + rect.w - 0.1) / this.map.tile));
      const minRow = Math.max(0, Math.floor(rect.y / this.map.tile));
      const maxRow = Math.min(this.map.rows - 1, Math.floor((rect.y + rect.h - 0.1) / this.map.tile));
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          this.nav.blocked[row][col] = true;
        }
      }
    }
  }

  private findOpen(x: number, y: number, radius = 8): Point {
    const point = nearestOpenWorld(this.nav, x, y, radius);
    return point ?? { x, y };
  }

  // ── Doors / lights ──────────────────────────────────────────────────────

  private doorCenter(building: BuildingDef, door: { side: 'n' | 's' | 'e' | 'w'; offset: number }): Point {
    const tile = this.map.tile;
    const x = building.x * tile;
    const y = building.y * tile;
    const w = building.w * tile;
    const h = building.h * tile;
    if (door.side === 'n') return { x: x + door.offset * tile, y: y + 8 };
    if (door.side === 's') return { x: x + door.offset * tile, y: y + h - 8 };
    if (door.side === 'w') return { x: x + 8, y: y + door.offset * tile };
    return { x: x + w - 8, y: y + door.offset * tile };
  }
}
