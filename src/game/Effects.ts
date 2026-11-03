import Phaser from 'phaser';
import { THEME, hexToCss } from '../ui/theme';

interface Particle {
  image: Phaser.GameObjects.Image;
  active: boolean;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scaleFrom: number;
  scaleTo: number;
  alphaFrom: number;
  alphaTo: number;
  drag: number;
  spin: number;
  gravity: number;
}

interface Transient {
  image: Phaser.GameObjects.Image;
  active: boolean;
  life: number;
  maxLife: number;
  scaleFrom: number;
  scaleTo: number;
  alphaFrom: number;
  alphaTo: number;
  rotationTo: number;
}

interface FloatingLabel {
  text: Phaser.GameObjects.Text;
  active: boolean;
  life: number;
  maxLife: number;
  startY: number;
}

const PARTICLE_KEYS = ['fx_spark', 'fx_blood', 'fx_smoke', 'fx_debris', 'fx_casing', 'fx_sand'] as const;

/**
 * Pooled visual effects. Every impact particle, muzzle flash and explosion
 * ring is allocated up front and recycled, so sustained fire never creates
 * garbage in the render loop.
 */
export class EffectsSystem {
  private scene: Phaser.Scene;
  private particles = new Map<string, Particle[]>();
  private transients = new Map<string, Transient[]>();
  private labels: FloatingLabel[] = [];
  private pixelScale = 1;

  constructor(scene: Phaser.Scene, highQuality: boolean) {
    this.scene = scene;
    this.pixelScale = highQuality ? 1 : 0.65;
    for (const key of PARTICLE_KEYS) {
      const pool: Particle[] = [];
      const count = key === 'fx_smoke' ? 40 : 70;
      for (let i = 0; i < count; i += 1) {
        const image = scene.add
          .image(0, 0, key)
          .setActive(false)
          .setVisible(false)
          .setDepth(640);
        pool.push({
          image,
          active: false,
          vx: 0,
          vy: 0,
          life: 0,
          maxLife: 1,
          scaleFrom: 1,
          scaleTo: 0,
          alphaFrom: 1,
          alphaTo: 0,
          drag: 0,
          spin: 0,
          gravity: 0,
        });
      }
      this.particles.set(key, pool);
    }
    for (const key of ['fx_flash', 'fx_ring', 'fx_glow', 'fx_fog'] as const) {
      const pool: Transient[] = [];
      const count = key === 'fx_ring' ? 24 : key === 'fx_glow' ? 30 : 42;
      for (let i = 0; i < count; i += 1) {
        const image = scene.add
          .image(0, 0, key)
          .setActive(false)
          .setVisible(false)
          .setDepth(660);
        pool.push({
          image,
          active: false,
          life: 0,
          maxLife: 1,
          scaleFrom: 1,
          scaleTo: 1,
          alphaFrom: 1,
          alphaTo: 0,
          rotationTo: 0,
        });
      }
      this.transients.set(key, pool);
    }
    for (let i = 0; i < 26; i += 1) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: THEME.fonts.mono,
          fontSize: '13px',
          color: '#e2ce9f',
          stroke: '#050708',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(760)
        .setActive(false)
        .setVisible(false);
      this.labels.push({ text, active: false, life: 0, maxLife: 1, startY: 0 });
    }
  }

  private acquireParticle(key: string): Particle | null {
    const pool = this.particles.get(key);
    if (!pool) return null;
    for (const p of pool) {
      if (!p.active) return p;
    }
    const oldest = pool[0];
    if (!oldest) return null;
    return oldest;
  }

  private spawnParticle(
    key: string,
    x: number,
    y: number,
    opts: {
      vx: number;
      vy: number;
      life: number;
      scaleFrom: number;
      scaleTo: number;
      alphaFrom?: number;
      alphaTo?: number;
      drag?: number;
      spin?: number;
      gravity?: number;
      depth?: number;
      tint?: number;
      rotation?: number;
      blend?: Phaser.BlendModes;
    },
  ): void {
    const p = this.acquireParticle(key);
    if (!p) return;
    p.active = true;
    p.vx = opts.vx;
    p.vy = opts.vy;
    p.life = opts.life;
    p.maxLife = opts.life;
    p.scaleFrom = opts.scaleFrom * this.pixelScale;
    p.scaleTo = opts.scaleTo * this.pixelScale;
    p.alphaFrom = opts.alphaFrom ?? 1;
    p.alphaTo = opts.alphaTo ?? 0;
    p.drag = opts.drag ?? 2;
    p.spin = opts.spin ?? 0;
    p.gravity = opts.gravity ?? 0;
    p.image
      .setActive(true)
      .setVisible(true)
      .setPosition(x, y)
      .setScale(p.scaleFrom)
      .setAlpha(p.alphaFrom)
      .setDepth(opts.depth ?? 640)
      .setRotation(opts.rotation ?? Math.random() * Math.PI * 2)
      .clearTint();
    if (opts.tint !== undefined) p.image.setTint(opts.tint);
    p.image.setBlendMode(opts.blend ?? Phaser.BlendModes.NORMAL);
  }

  private spawnTransient(
    key: string,
    x: number,
    y: number,
    opts: {
      life: number;
      scaleFrom: number;
      scaleTo: number;
      alphaFrom?: number;
      alphaTo?: number;
      rotation?: number;
      rotationTo?: number;
      depth?: number;
      tint?: number;
      blend?: Phaser.BlendModes;
    },
  ): Phaser.GameObjects.Image | null {
    const pool = this.transients.get(key);
    if (!pool) return null;
    let item = pool.find((p) => !p.active);
    if (!item) item = pool[0];
    if (!item) return null;
    item.active = true;
    item.life = opts.life;
    item.maxLife = opts.life;
    item.scaleFrom = opts.scaleFrom;
    item.scaleTo = opts.scaleTo;
    item.alphaFrom = opts.alphaFrom ?? 1;
    item.alphaTo = opts.alphaTo ?? 0;
    item.rotationTo = opts.rotationTo ?? 0;
    item.image
      .setActive(true)
      .setVisible(true)
      .setPosition(x, y)
      .setScale(opts.scaleFrom)
      .setAlpha(item.alphaFrom)
      .setRotation(opts.rotation ?? 0)
      .setDepth(opts.depth ?? 650)
      .clearTint();
    if (opts.tint !== undefined) item.image.setTint(opts.tint);
    item.image.setBlendMode(opts.blend ?? Phaser.BlendModes.ADD);
    return item.image;
  }

  muzzleFlash(x: number, y: number, angle: number, heavy = false): void {
    this.spawnTransient('fx_flash', x, y, {
      life: heavy ? 0.085 : 0.055,
      scaleFrom: (heavy ? 0.9 : 0.65) * this.pixelScale,
      scaleTo: (heavy ? 1.35 : 0.95) * this.pixelScale,
      rotation: angle,
      depth: 700,
      alphaFrom: 1,
      alphaTo: 0,
    });
    this.spawnParticle('fx_smoke', x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, {
      vx: Math.cos(angle) * 30,
      vy: Math.sin(angle) * 30,
      life: 0.35 + Math.random() * 0.2,
      scaleFrom: 0.08,
      scaleTo: 0.26,
      alphaFrom: 0.22,
      alphaTo: 0,
      drag: 5,
      depth: 650,
    });
  }

  impact(x: number, y: number, angle: number, surface: 'wall' | 'flesh' | 'metal' = 'wall'): void {
    if (surface === 'flesh') {
      for (let i = 0; i < 5; i += 1) {
        const a = angle + Math.PI + (Math.random() - 0.5) * 1.7;
        const speed = 60 + Math.random() * 150;
        this.spawnParticle('fx_blood', x, y, {
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 0.35 + Math.random() * 0.3,
          scaleFrom: 0.65,
          scaleTo: 0.1,
          alphaFrom: 0.9,
          drag: 5,
          depth: 645,
        });
      }
      return;
    }
    const tint = surface === 'metal' ? 0xffc46b : 0xffdf9a;
    for (let i = 0; i < 4; i += 1) {
      const a = angle + Math.PI + (Math.random() - 0.5) * 2.1;
      const speed = 70 + Math.random() * 190;
      this.spawnParticle('fx_spark', x, y, {
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.18 + Math.random() * 0.22,
        scaleFrom: 0.5,
        scaleTo: 0.05,
        alphaFrom: 1,
        drag: 7,
        tint,
        depth: 665,
      });
    }
    this.spawnParticle('fx_smoke', x, y, {
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20 - 6,
      life: 0.45,
      scaleFrom: 0.09,
      scaleTo: 0.3,
      alphaFrom: 0.24,
      alphaTo: 0,
      drag: 4,
      depth: 650,
    });
    this.spawnParticle('fx_debris', x, y, {
      vx: Math.cos(angle + Math.PI) * 90,
      vy: Math.sin(angle + Math.PI) * 90 - 30,
      life: 0.35,
      scaleFrom: 0.7,
      scaleTo: 0.4,
      alphaFrom: 0.9,
      gravity: 220,
      spin: 8,
      drag: 1,
      depth: 648,
    });
  }

  casing(x: number, y: number, angle: number): void {
    const side = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    this.spawnParticle('fx_casing', x, y, {
      vx: Math.cos(side) * (50 + Math.random() * 55),
      vy: Math.sin(side) * (50 + Math.random() * 55) - 35,
      life: 0.55,
      scaleFrom: 0.8,
      scaleTo: 0.7,
      alphaFrom: 0.95,
      gravity: 300,
      spin: 12,
      drag: 0.5,
      depth: 635,
    });
  }

  dust(x: number, y: number, color = 0x8a7c5f): void {
    this.spawnParticle('fx_smoke', x, y, {
      vx: (Math.random() - 0.5) * 22,
      vy: (Math.random() - 0.5) * 18,
      life: 0.55,
      scaleFrom: 0.08,
      scaleTo: 0.34,
      alphaFrom: 0.2,
      tint: color,
      drag: 2,
      depth: 620,
    });
  }

  explosion(x: number, y: number, radius: number): void {
    this.spawnTransient('fx_ring', x, y, {
      life: 0.55,
      scaleFrom: 0.15,
      scaleTo: (radius * 2) / 160,
      alphaFrom: 0.9,
      alphaTo: 0,
      depth: 680,
      tint: 0xffc27a,
    });
    this.spawnTransient('fx_glow', x, y, {
      life: 0.38,
      scaleFrom: 0.35,
      scaleTo: (radius * 2.1) / 192,
      alphaFrom: 0.9,
      alphaTo: 0,
      depth: 670,
      tint: 0xff9a4a,
      blend: Phaser.BlendModes.ADD,
    });
    for (let i = 0; i < 16; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 340;
      this.spawnParticle('fx_spark', x, y, {
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.3 + Math.random() * 0.45,
        scaleFrom: 0.8,
        scaleTo: 0.05,
        alphaFrom: 1,
        tint: i % 3 === 0 ? 0xfff0c0 : 0xff9b45,
        drag: 2.6,
        depth: 690,
      });
    }
    for (let i = 0; i < 9; i += 1) {
      const a = Math.random() * Math.PI * 2;
      this.spawnParticle('fx_smoke', x + Math.cos(a) * 18, y + Math.sin(a) * 18, {
        vx: Math.cos(a) * (28 + Math.random() * 70),
        vy: Math.sin(a) * (28 + Math.random() * 70) - 16,
        life: 0.8 + Math.random() * 0.6,
        scaleFrom: 0.25,
        scaleTo: 0.9,
        alphaFrom: 0.5,
        alphaTo: 0,
        drag: 1.2,
        tint: i % 2 ? 0x77746a : 0x9a8d77,
        depth: 665,
      });
    }
    for (let i = 0; i < 7; i += 1) {
      const a = Math.random() * Math.PI * 2;
      this.spawnParticle('fx_debris', x, y, {
        vx: Math.cos(a) * (80 + Math.random() * 220),
        vy: Math.sin(a) * (80 + Math.random() * 160) - 90,
        life: 0.6 + Math.random() * 0.5,
        scaleFrom: 1,
        scaleTo: 0.6,
        alphaFrom: 1,
        gravity: 430,
        spin: 10,
        depth: 660,
      });
    }
  }

  sparkBurst(x: number, y: number, tint = 0xffe0a0, count = 6): void {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 150;
      this.spawnParticle('fx_spark', x, y, {
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.2 + Math.random() * 0.25,
        scaleFrom: 0.5,
        scaleTo: 0.05,
        alphaFrom: 1,
        tint,
        drag: 6,
        depth: 670,
      });
    }
  }

  smokePuff(x: number, y: number, tint = 0x9a9a90): void {
    this.spawnParticle('fx_smoke', x, y, {
      vx: (Math.random() - 0.5) * 24,
      vy: -20 - Math.random() * 20,
      life: 0.6,
      scaleFrom: 0.12,
      scaleTo: 0.4,
      alphaFrom: 0.28,
      tint,
      drag: 1.4,
      depth: 650,
    });
  }

  glow(x: number, y: number, scale: number, tint: number, life = 0.4): void {
    this.spawnTransient('fx_glow', x, y, {
      life,
      scaleFrom: scale * 0.6,
      scaleTo: scale,
      alphaFrom: 0.55,
      alphaTo: 0,
      tint,
      depth: 655,
      blend: Phaser.BlendModes.ADD,
    });
  }

  ring(x: number, y: number, radius: number, tint: number, life = 0.45): void {
    this.spawnTransient('fx_ring', x, y, {
      life,
      scaleFrom: 0.08,
      scaleTo: (radius * 2) / 160,
      alphaFrom: 0.8,
      alphaTo: 0,
      tint,
      depth: 650,
      blend: Phaser.BlendModes.ADD,
    });
  }

  text(x: number, y: number, value: string, color = THEME.colors.sand, size = 13): void {
    let label = this.labels.find((l) => !l.active);
    if (!label) label = this.labels[0];
    if (!label) return;
    label.active = true;
    label.life = 1.1;
    label.maxLife = 1.1;
    label.startY = y;
    label.text
      .setActive(true)
      .setVisible(true)
      .setText(value)
      .setPosition(x, y)
      .setColor(hexToCss(color))
      .setFontSize(size)
      .setAlpha(1)
      .setScale(1);
  }

  update(dt: number): void {
    for (const pool of this.particles.values()) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          p.image.setActive(false).setVisible(false);
          continue;
        }
        const t = 1 - p.life / p.maxLife;
        p.vx -= p.vx * p.drag * dt;
        p.vy -= p.vy * p.drag * dt;
        p.vy += p.gravity * dt;
        p.image.x += p.vx * dt;
        p.image.y += p.vy * dt;
        p.image.rotation += p.spin * dt;
        p.image.setScale(p.scaleFrom + (p.scaleTo - p.scaleFrom) * t);
        p.image.setAlpha(p.alphaFrom + (p.alphaTo - p.alphaFrom) * t);
      }
    }
    for (const pool of this.transients.values()) {
      for (const item of pool) {
        if (!item.active) continue;
        item.life -= dt;
        if (item.life <= 0) {
          item.active = false;
          item.image.setActive(false).setVisible(false);
          continue;
        }
        const t = 1 - item.life / item.maxLife;
        item.image.setScale(item.scaleFrom + (item.scaleTo - item.scaleFrom) * t);
        item.image.setAlpha(item.alphaFrom + (item.alphaTo - item.alphaFrom) * t);
        item.image.rotation += item.rotationTo * dt;
      }
    }
    for (const label of this.labels) {
      if (!label.active) continue;
      label.life -= dt;
      if (label.life <= 0) {
        label.active = false;
        label.text.setActive(false).setVisible(false);
        continue;
      }
      const t = 1 - label.life / label.maxLife;
      label.text.y = label.startY - t * 42;
      label.text.setAlpha(1 - t * t);
    }
  }

  clear(): void {
    for (const pool of this.particles.values()) {
      for (const p of pool) {
        p.active = false;
        p.image.setActive(false).setVisible(false);
      }
    }
    for (const pool of this.transients.values()) {
      for (const item of pool) {
        item.active = false;
        item.image.setActive(false).setVisible(false);
      }
    }
    for (const label of this.labels) {
      label.active = false;
      label.text.setActive(false).setVisible(false);
    }
  }
}
