import type { WeaponClass } from '../core/types';

type SoundKey =
  | 'ui_click'
  | 'ui_hover'
  | 'ui_confirm'
  | 'ui_back'
  | 'shot'
  | 'shot_suppressed'
  | 'shot_heavy'
  | 'dry_fire'
  | 'reload'
  | 'reload_done'
  | 'impact'
  | 'hit'
  | 'kill'
  | 'explosion'
  | 'grenade_bounce'
  | 'footstep'
  | 'vehicle_hit'
  | 'pickup'
  | 'objective'
  | 'alarm'
  | 'success'
  | 'fail'
  | 'hurt'
  | 'whizz';

/**
 * Procedural WebAudio sound engine. No external audio files are required.
 * The context is created lazily and resumed on the first user gesture, which
 * satisfies desktop browser autoplay policies.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicNodes: { osc: OscillatorNode[]; gain: GainNode; noise?: AudioBufferSourceNode } | null = null;
  private ambienceNodes: { sources: AudioBufferSourceNode[]; gain: GainNode } | null = null;
  private engineNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  private volumes = { master: 0.7, music: 0.38, sfx: 0.8 };
  private unlocked = false;
  private lastHover = 0;

  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = {
      master: Math.max(0, Math.min(1, master)),
      music: Math.max(0, Math.min(1, music)),
      sfx: Math.max(0, Math.min(1, sfx)),
    };
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.master?.gain.setTargetAtTime(this.volumes.master, now, 0.05);
      this.musicBus?.gain.setTargetAtTime(this.volumes.music, now, 0.08);
      this.sfxBus?.gain.setTargetAtTime(this.volumes.sfx, now, 0.03);
    }
  }

  /** Start / resume the audio graph. Safe to call repeatedly. */
  async unlock(): Promise<boolean> {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return false;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.master.gain.value = this.volumes.master;
        this.musicBus.gain.value = this.volumes.music;
        this.sfxBus.gain.value = this.volumes.sfx;
        this.noiseBuffer = this.createNoiseBuffer();
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.unlocked = this.ctx.state === 'running';
      return this.unlocked;
    } catch {
      return false;
    }
  }

  get isReady(): boolean {
    return Boolean(this.ctx && this.unlocked);
  }

  private createNoiseBuffer(seconds = 2): AudioBuffer | null {
    if (!this.ctx) return null;
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
    slideTo?: number,
    delay = 0,
    bus: 'sfx' | 'music' = 'sfx',
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    try {
      const t = this.now() + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, frequency), t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(bus === 'music' ? (this.musicBus ?? this.sfxBus) : this.sfxBus);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    } catch {
      /* audio failures must never break gameplay */
    }
  }

  private noise(
    duration: number,
    gainValue: number,
    filterFreq: number,
    delay = 0,
    type: BiquadFilterType = 'lowpass',
    bus: 'sfx' | 'music' = 'sfx',
  ): void {
    if (!this.ctx || !this.noiseBuffer || !this.sfxBus) return;
    try {
      const t = this.now() + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = filterFreq;
      filter.Q.value = type === 'bandpass' ? 0.8 : 0.5;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(bus === 'music' ? (this.musicBus ?? this.sfxBus) : this.sfxBus);
      src.start(t, Math.random() * 1.2, duration + 0.05);
    } catch {
      /* ignore */
    }
  }

  play(key: SoundKey, weaponClass?: WeaponClass): void {
    if (!this.ctx || !this.unlocked) return;
    switch (key) {
      case 'ui_click':
        this.tone(660, 0.05, 'square', 0.025);
        this.noise(0.04, 0.02, 2800);
        break;
      case 'ui_hover': {
        const t = performance.now();
        if (t - this.lastHover < 60) return;
        this.lastHover = t;
        this.tone(880, 0.03, 'sine', 0.014);
        break;
      }
      case 'ui_confirm':
        this.tone(520, 0.08, 'triangle', 0.035);
        this.tone(780, 0.12, 'triangle', 0.03, undefined, 0.06);
        break;
      case 'ui_back':
        this.tone(420, 0.08, 'triangle', 0.025, 300);
        break;
      case 'shot': {
        const heavy = weaponClass === 'sniper' || weaponClass === 'shotgun' || weaponClass === 'lmg';
        this.noise(heavy ? 0.22 : 0.12, heavy ? 0.26 : 0.16, heavy ? 950 : 1500, 0, 'bandpass');
        this.noise(0.08, 0.12, 4200, 0.005, 'highpass');
        this.tone(heavy ? 95 : 150, heavy ? 0.16 : 0.08, 'sine', 0.09, heavy ? 42 : 70);
        if (weaponClass === 'sniper') this.tone(1600, 0.25, 'sawtooth', 0.012, 400);
        break;
      }
      case 'shot_suppressed':
        this.noise(0.07, 0.05, 1400, 0, 'bandpass');
        this.tone(220, 0.05, 'sine', 0.035, 120);
        break;
      case 'shot_heavy':
        this.noise(0.3, 0.3, 700, 0, 'bandpass');
        this.tone(70, 0.25, 'sine', 0.14, 38);
        break;
      case 'dry_fire':
        this.tone(1300, 0.02, 'square', 0.02);
        this.tone(900, 0.03, 'square', 0.012, undefined, 0.03);
        break;
      case 'reload':
        this.noise(0.05, 0.06, 2000, 0, 'bandpass');
        this.tone(500, 0.04, 'square', 0.015);
        this.tone(350, 0.06, 'square', 0.02, 220, 0.35);
        break;
      case 'reload_done':
        this.noise(0.04, 0.07, 2600);
        this.tone(720, 0.05, 'square', 0.02);
        break;
      case 'impact':
        this.noise(0.05, 0.07, 1800, 0, 'bandpass');
        break;
      case 'hit':
        this.tone(1500, 0.035, 'square', 0.02);
        break;
      case 'kill':
        this.tone(240, 0.12, 'triangle', 0.04, 120);
        this.noise(0.08, 0.05, 500);
        break;
      case 'explosion':
        this.noise(0.85, 0.42, 420, 0, 'lowpass');
        this.noise(0.35, 0.22, 2600, 0.01, 'bandpass');
        this.tone(54, 0.75, 'sine', 0.22, 24);
        break;
      case 'grenade_bounce':
        this.tone(1000, 0.06, 'triangle', 0.03, 600);
        break;
      case 'footstep':
        this.noise(0.045, 0.018, 500 + Math.random() * 200);
        break;
      case 'vehicle_hit':
        this.noise(0.2, 0.14, 700);
        this.tone(90, 0.18, 'triangle', 0.08, 50);
        break;
      case 'pickup':
        this.tone(550, 0.08, 'sine', 0.035);
        this.tone(880, 0.14, 'sine', 0.03, undefined, 0.07);
        break;
      case 'objective':
        this.tone(440, 0.1, 'triangle', 0.04);
        this.tone(660, 0.12, 'triangle', 0.04, undefined, 0.1);
        this.tone(880, 0.2, 'triangle', 0.035, undefined, 0.2);
        break;
      case 'alarm':
        this.tone(620, 0.18, 'square', 0.03, 440);
        this.tone(620, 0.18, 'square', 0.03, 440, 0.25);
        break;
      case 'success':
        this.tone(392, 0.25, 'triangle', 0.05);
        this.tone(523, 0.3, 'triangle', 0.05, undefined, 0.18);
        this.tone(659, 0.45, 'triangle', 0.05, undefined, 0.36);
        break;
      case 'fail':
        this.tone(220, 0.4, 'sine', 0.05, 110);
        this.tone(165, 0.5, 'sine', 0.04, 82, 0.15);
        break;
      case 'hurt':
        this.noise(0.12, 0.08, 380);
        this.tone(140, 0.15, 'sine', 0.05, 80);
        break;
      case 'whizz':
        this.noise(0.1, 0.025, 2800, 0, 'bandpass');
        break;
    }
  }

  startMusic(mode: 'menu' | 'mission' | 'survival' | 'results'): void {
    if (!this.ctx || !this.unlocked || !this.musicBus) return;
    this.stopMusic();
    try {
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(this.musicBus);
      const frequencies =
        mode === 'menu'
          ? [55, 82.5, 110, 164.8]
          : mode === 'survival'
            ? [49, 73.4, 98, 146.8]
            : [46.2, 69.3, 92.5, 138.6];
      const osc: OscillatorNode[] = [];
      frequencies.forEach((f, i) => {
        const o = this.ctx!.createOscillator();
        o.type = i % 2 === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        const og = this.ctx!.createGain();
        og.gain.value = 0.04 / (i + 1);
        o.connect(og);
        og.connect(gain);
        o.start();
        osc.push(o);
      });
      // Slow sub pulse.
      const pulse = this.ctx.createOscillator();
      pulse.type = 'sine';
      pulse.frequency.value = mode === 'survival' ? 36 : 30;
      const pulseGain = this.ctx.createGain();
      pulseGain.gain.value = 0.0001;
      pulse.connect(pulseGain);
      pulseGain.connect(gain);
      const t = this.ctx.currentTime;
      const pulseInterval = mode === 'survival' ? 0.65 : 2.4;
      for (let i = 0; i < 60; i += 1) {
        pulseGain.gain.setTargetAtTime(0.16, t + i * pulseInterval, 0.02);
        pulseGain.gain.setTargetAtTime(0.0001, t + i * pulseInterval + 0.18, 0.08);
      }
      pulse.start();
      osc.push(pulse);

      let noise: AudioBufferSourceNode | undefined;
      if (this.noiseBuffer) {
        noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        noise.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        const ng = this.ctx.createGain();
        ng.gain.value = 0.012;
        noise.connect(filter);
        filter.connect(ng);
        ng.connect(gain);
        noise.start();
      }
      gain.gain.setTargetAtTime(1, t, 0.8);
      this.musicNodes = { osc, gain, noise };
    } catch {
      /* ignore */
    }
  }

  stopMusic(): void {
    if (!this.ctx || !this.musicNodes) return;
    try {
      const t = this.ctx.currentTime;
      const nodes = this.musicNodes;
      this.musicNodes = null;
      nodes.gain.gain.cancelScheduledValues(t);
      nodes.gain.gain.setTargetAtTime(0.0001, t, 0.2);
      setTimeout(() => {
        for (const osc of nodes.osc) {
          try {
            osc.stop();
          } catch {
            /* ignore */
          }
        }
        try {
          nodes.noise?.stop();
        } catch {
          /* ignore */
        }
      }, 700);
    } catch {
      /* ignore */
    }
  }

  startAmbience(weather: string, night: boolean): void {
    if (!this.ctx || !this.unlocked || !this.noiseBuffer) return;
    this.stopAmbience();
    try {
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(night ? 0.075 : 0.045, this.ctx.currentTime, 1.2);
      gain.connect(this.sfxBus!);
      const sources: AudioBufferSourceNode[] = [];
      const make = (freq: number, q: number, vol: number, type: BiquadFilterType = 'lowpass') => {
        const src = this.ctx!.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const filter = this.ctx!.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        filter.Q.value = q;
        const g = this.ctx!.createGain();
        g.gain.value = vol;
        src.connect(filter);
        filter.connect(g);
        g.connect(gain);
        src.start(0, Math.random() * 1.5);
        sources.push(src);
      };
      // Wind bed.
      make(260, 0.5, 0.5);
      if (weather === 'rain' || weather === 'storm') make(1100, 0.7, 0.35, 'bandpass');
      if (weather === 'sandstorm') make(400, 0.8, 0.6, 'bandpass');
      if (weather === 'snow') make(180, 0.4, 0.35);
      this.ambienceNodes = { sources, gain };
    } catch {
      /* ignore */
    }
  }

  stopAmbience(): void {
    if (!this.ctx || !this.ambienceNodes) return;
    const nodes = this.ambienceNodes;
    this.ambienceNodes = null;
    try {
      nodes.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
      setTimeout(() => {
        nodes.sources.forEach((s) => {
          try {
            s.stop();
          } catch {
            /* ignore */
          }
        });
      }, 900);
    } catch {
      /* ignore */
    }
  }

  startEngine(): void {
    if (!this.ctx || !this.unlocked || this.engineNodes) return;
    try {
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(this.sfxBus!);
      const a = this.ctx.createOscillator();
      a.type = 'sawtooth';
      a.frequency.value = 42;
      const b = this.ctx.createOscillator();
      b.type = 'square';
      b.frequency.value = 21;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      a.connect(filter);
      b.connect(filter);
      filter.connect(gain);
      a.start();
      b.start();
      gain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.2);
      this.engineNodes = { osc: [a, b], gain };
    } catch {
      /* ignore */
    }
  }

  setEngineLoad(speedRatio: number): void {
    if (!this.ctx || !this.engineNodes) return;
    try {
      const t = this.ctx.currentTime;
      this.engineNodes.osc[0].frequency.setTargetAtTime(38 + speedRatio * 70, t, 0.1);
      this.engineNodes.osc[1].frequency.setTargetAtTime(19 + speedRatio * 32, t, 0.1);
    } catch {
      /* ignore */
    }
  }

  stopEngine(): void {
    if (!this.ctx || !this.engineNodes) return;
    const nodes = this.engineNodes;
    this.engineNodes = null;
    try {
      nodes.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
      setTimeout(() => {
        nodes.osc.forEach((o) => {
          try {
            o.stop();
          } catch {
            /* ignore */
          }
        });
      }, 400);
    } catch {
      /* ignore */
    }
  }
}

export const audio = new AudioSystem();
