import Phaser from 'phaser';

export class WeatherSystem {
  private scene: Phaser.Scene;
  private weather: string;
  private quality: boolean;
  private pool: { image: Phaser.GameObjects.Image; vx: number; vy: number; reset(): void }[] = [];
  private timer = 0;
  private lightningTimer = 0;

  constructor(scene: Phaser.Scene, weather: string, quality = true) {
    this.scene = scene;
    this.weather = weather;
    this.quality = quality;
    if (weather === 'clear' || weather === 'fog') return;
    const key =
      weather === 'rain' || weather === 'storm' ? 'fx_rain' : weather === 'snow' ? 'fx_snow' : 'fx_sand';
    const count = quality ? (weather === 'sandstorm' ? 120 : 180) : 60;
    for (let i = 0; i < count; i += 1) {
      const image = scene.add
        .image(Math.random() * 1600, Math.random() * 900, key)
        .setDepth(4500)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setAlpha(weather === 'rain' ? 0.6 : 0.75);
      const particle = {
        image,
        vx: weather === 'snow' ? (Math.random() - 0.5) * 30 : (Math.random() - 0.5) * 24,
        vy: weather === 'snow' ? 40 + Math.random() * 60 : weather === 'rain' || weather === 'storm' ? 420 + Math.random() * 180 : 30 + Math.random() * 60,
        reset: () => {
          particle.vx =
            weather === 'snow' ? (Math.random() - 0.5) * 30 : (Math.random() - 0.5) * 24;
          particle.vy =
            weather === 'snow'
              ? 40 + Math.random() * 60
              : weather === 'rain' || weather === 'storm'
                ? 420 + Math.random() * 180
                : 30 + Math.random() * 60;
        },
      };
      this.pool.push(particle);
    }
  }

  update(dt: number): void {
    if (this.pool.length === 0) return;
    const camera = this.scene.cameras.main;
    const view = camera.worldView;
    this.timer += dt;
    for (const p of this.pool) {
      p.image.x += p.vx * dt;
      p.image.y += p.vy * dt;
      if (p.image.x < view.x - 20 || p.image.y < view.y - 40 || p.image.x > view.x + view.width + 20 || p.image.y > view.y + view.height + 40) {
        p.image.x = view.x + Math.random() * view.width;
        p.image.y = view.y - Math.random() * 120;
        p.reset();
      }
    }
    if (this.weather === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 8 + Math.random() * 12;
        this.scene.cameras.main.flash(120, 230, 236, 250, false);
      }
    }
  }

  cleanup(): void {
    for (const p of this.pool) p.image.destroy();
    this.pool.length = 0;
  }
}
