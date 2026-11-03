import Phaser from 'phaser';
import { THEME, hexToCss } from './theme';
import { audio } from '../systems/audio';

export interface PanelOptions {
  fill?: number;
  fillAlpha?: number;
  stroke?: number;
  strokeAlpha?: number;
  accent?: number;
  accentAlpha?: number;
  cut?: number;
  inner?: boolean;
  topStrip?: boolean;
}

/** Draw the angular cut-corner panel used throughout the interface. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  options: PanelOptions = {},
): void {
  const cut = options.cut ?? 12;
  const fill = options.fill ?? THEME.colors.panel;
  const fillAlpha = options.fillAlpha ?? 0.94;
  const stroke = options.stroke ?? THEME.colors.line;
  const strokeAlpha = options.strokeAlpha ?? 1;
  g.fillStyle(fill, fillAlpha);
  g.beginPath();
  g.moveTo(x + cut, y);
  g.lineTo(x + w, y);
  g.lineTo(x + w, y + h - cut);
  g.lineTo(x + w - cut, y + h);
  g.lineTo(x, y + h);
  g.lineTo(x, y + cut);
  g.closePath();
  g.fillPath();
  g.lineStyle(1, stroke, strokeAlpha);
  g.strokePath();
  if (options.inner !== false) {
    g.lineStyle(1, THEME.colors.lineBright, 0.18);
    g.beginPath();
    g.moveTo(x + 4, y + 6);
    g.lineTo(x + cut + 4, y + 6);
    g.moveTo(x + w - 18, y + 6);
    g.lineTo(x + w - 6, y + 6);
    g.lineTo(x + w - 6, y + 18);
    g.strokePath();
  }
  if (options.accent !== undefined) {
    g.fillStyle(options.accent, options.accentAlpha ?? 0.9);
    g.fillRect(x, y + 12, 2, Math.max(12, h - 34));
  }
  if (options.topStrip) {
    g.lineStyle(1, options.accent ?? THEME.colors.sand, 0.45);
    g.beginPath();
    g.moveTo(x + cut, y + 1);
    g.lineTo(x + w - 14, y + 1);
    g.strokePath();
  }
}

export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  options: PanelOptions = {},
  depth = 1,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  drawPanel(g, x, y, w, h, options);
  return g;
}

export interface TextOptions {
  origin?: [number, number];
  letterSpacing?: number;
  align?: string;
  wordWrapWidth?: number;
  lineSpacing?: number;
  bold?: boolean;
  font?: string;
  alpha?: number;
  italic?: boolean;
}

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = THEME.fontSizes.small,
  color: number = THEME.colors.white,
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: options.font ?? THEME.fonts.display,
    fontSize: `${size}px`,
    color: hexToCss(color),
    fontStyle: options.italic ? 'italic' : options.bold ? 'bold' : 'normal',
    align: options.align ?? 'left',
    lineSpacing: options.lineSpacing ?? 4,
  };
  if (options.wordWrapWidth) {
    style.wordWrap = { width: options.wordWrapWidth, useAdvancedWrap: true };
  }
  const object = scene.add.text(x, y, text, style);
  object.setLetterSpacing(options.letterSpacing ?? 1.6);
  object.setOrigin(options.origin?.[0] ?? 0, options.origin?.[1] ?? 0);
  if (options.alpha !== undefined) object.setAlpha(options.alpha);
  return object;
}

export function mono(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = THEME.fontSizes.tiny,
  color: number = THEME.colors.muted,
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  return txt(scene, x, y, text, size, color, { ...options, font: THEME.fonts.mono, letterSpacing: options.letterSpacing ?? 1.2 });
}

export interface ButtonOptions {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'tab' | 'small';
  icon?: string;
  iconTint?: number;
  sublabel?: string;
  rightText?: string;
  align?: 'left' | 'center';
  onClick?: () => void;
  disabled?: boolean;
  depth?: number;
  selected?: boolean;
  accent?: number;
  fontSize?: number;
  tooltip?: string;
}

/**
 * Interactive command button. Draws its own state, plays UI audio, and exposes
 * a disabled state so the interface never contains fake / dead controls.
 */
export class TacticalButton extends Phaser.GameObjects.Container {
  readonly labelText: Phaser.GameObjects.Text;
  readonly subText?: Phaser.GameObjects.Text;
  readonly rightText?: Phaser.GameObjects.Text;
  private background: Phaser.GameObjects.Graphics;
  private icon?: Phaser.GameObjects.Image;
  private btnW: number;
  private btnH: number;
  private opts: ButtonOptions;
  private hovered = false;
  private pressed = false;
  private selected: boolean;
  private disabledState: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, options: ButtonOptions = {}) {
    super(scene, x, y);
    this.btnW = w;
    this.btnH = h;
    this.opts = options;
    this.selected = Boolean(options.selected);
    this.disabledState = Boolean(options.disabled);
    this.background = scene.add.graphics();
    this.add(this.background);

    const hasIcon = Boolean(options.icon);
    const left = hasIcon ? 34 : options.align === 'center' ? 0 : 16;
    if (hasIcon) {
      this.icon = scene.add.image(24, h / 2, options.icon!).setDisplaySize(20, 20);
      this.icon.setTint(options.iconTint ?? THEME.colors.sand);
      this.add(this.icon);
    }
    const center = options.align === 'center' || !hasIcon;
    this.labelText = txt(
      scene,
      center ? w / 2 : left,
      h / 2 - (options.sublabel ? 8 : 0),
      label,
      options.fontSize ?? (options.variant === 'small' ? 11 : options.variant === 'tab' ? 12 : 14),
      THEME.colors.white,
      {
        origin: [center ? 0.5 : 0, 0.5],
        letterSpacing: options.variant === 'small' ? 1.2 : 1.8,
        bold: options.variant === 'primary',
      },
    );
    this.add(this.labelText);
    if (options.sublabel) {
      this.subText = mono(scene, center ? w / 2 : left, h / 2 + 10, options.sublabel, 9, THEME.colors.muted, {
        origin: [center ? 0.5 : 0, 0.5],
      });
      this.add(this.subText);
    }
    if (options.rightText) {
      this.rightText = mono(scene, w - 14, h / 2, options.rightText, 10, THEME.colors.sand, {
        origin: [1, 0.5],
      });
      this.add(this.rightText);
    }
    this.setDepth(options.depth ?? 5);

    const hit = scene.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0).setOrigin(0.5);
    hit.setInteractive({ useHandCursor: !this.disabledState });
    this.add(hit);
    hit.on('pointerover', () => {
      if (this.disabledState) return;
      this.hovered = true;
      audio.play('ui_hover');
      this.render();
      scene.tweens.add({ targets: this, x: x + 2, duration: 90, ease: 'Sine.Out' });
    });
    hit.on('pointerout', () => {
      this.hovered = false;
      this.pressed = false;
      this.render();
      scene.tweens.add({ targets: this, x, duration: 110, ease: 'Sine.Out' });
    });
    hit.on('pointerdown', () => {
      if (this.disabledState) return;
      this.pressed = true;
      this.render();
    });
    hit.on('pointerup', () => {
      if (this.disabledState) return;
      this.pressed = false;
      this.render();
      audio.play('ui_click');
      options.onClick?.();
    });

    this.render();
    scene.add.existing(this);
  }

  setDisabled(disabled: boolean): this {
    this.disabledState = disabled;
    this.labelText.setAlpha(disabled ? 0.5 : 1);
    this.subText?.setAlpha(disabled ? 0.4 : 1);
    this.rightText?.setAlpha(disabled ? 0.4 : 1);
    this.icon?.setAlpha(disabled ? 0.4 : 1);
    this.render();
    return this;
  }

  setSelected(selected: boolean): this {
    this.selected = selected;
    this.render();
    return this;
  }

  setLabel(label: string): this {
    this.labelText.setText(label);
    return this;
  }

  setRight(value: string): this {
    if (this.rightText) this.rightText.setText(value);
    return this;
  }

  private render(): void {
    const g = this.background;
    g.clear();
    const w = this.btnW;
    const h = this.btnH;
    const variant = this.opts.variant ?? 'secondary';
    const accent = this.opts.accent ?? (variant === 'danger' ? THEME.colors.danger : variant === 'primary' ? THEME.colors.amber : THEME.colors.sand);
    const cut = variant === 'tab' ? 0 : variant === 'small' ? 5 : 8;
    let fill = THEME.colors.panelRaised;
    let fillAlpha = 0.88;
    let stroke = THEME.colors.line;
    let strokeAlpha = 0.9;
    let textColor = THEME.colors.white;

    if (variant === 'primary') {
      fill = this.hovered ? THEME.colors.sandBright : THEME.colors.sand;
      fillAlpha = 1;
      stroke = THEME.colors.sandBright;
      textColor = 0x141814;
    } else if (variant === 'danger') {
      fill = this.hovered ? 0x3a1d18 : 0x261512;
      stroke = THEME.colors.dangerDim;
      textColor = THEME.colors.danger;
    } else if (variant === 'ghost') {
      fill = this.hovered ? 0x172022 : 0x000000;
      fillAlpha = this.hovered ? 0.45 : 0.01;
      stroke = this.hovered ? THEME.colors.lineBright : THEME.colors.line;
      textColor = this.hovered ? THEME.colors.sandBright : THEME.colors.muted;
    } else if (variant === 'tab') {
      fill = this.selected ? 0x1a2425 : 0x000000;
      fillAlpha = this.selected ? 0.9 : 0.01;
      stroke = this.selected ? THEME.colors.sand : 0x000000;
      strokeAlpha = this.selected ? 0.9 : 0;
      textColor = this.selected ? THEME.colors.sandBright : THEME.colors.muted;
    } else if (variant === 'small') {
      fill = this.hovered ? 0x1b2526 : 0x101819;
      stroke = this.hovered ? THEME.colors.lineBright : THEME.colors.line;
      textColor = this.hovered ? THEME.colors.sand : THEME.colors.white;
    }

    if (this.disabledState) {
      fill = 0x0b0f10;
      fillAlpha = 0.75;
      stroke = THEME.colors.line;
      strokeAlpha = 0.4;
      textColor = THEME.colors.mutedDark;
    }

    if (cut === 0) {
      g.fillStyle(fill, fillAlpha);
      g.fillRect(0, 0, w, h);
      g.lineStyle(1, stroke, strokeAlpha);
      g.strokeRect(0, h - 1, w, 1);
    } else {
      g.fillStyle(fill, fillAlpha);
      g.beginPath();
      g.moveTo(cut, 0);
      g.lineTo(w, 0);
      g.lineTo(w, h - cut);
      g.lineTo(w - cut, h);
      g.lineTo(0, h);
      g.lineTo(0, cut);
      g.closePath();
      g.fillPath();
      g.lineStyle(1, stroke, strokeAlpha);
      g.strokePath();
      if (!this.disabledState && (this.hovered || this.selected)) {
        g.fillStyle(accent, 0.9);
        g.fillRect(0, 10, 2, h - 20);
      }
    }
    if (this.pressed) {
      g.fillStyle(0xffffff, 0.05);
      g.fillRect(2, 2, w - 4, h - 4);
    }
    this.labelText.setColor(hexToCss(textColor));
    this.icon?.setTint(this.disabledState ? THEME.colors.mutedDark : this.opts.iconTint ?? accent);
    if (this.rightText) this.rightText.setColor(hexToCss(this.disabledState ? THEME.colors.mutedDark : this.opts.rightText ? THEME.colors.sand : accent));
  }
}

export interface TabItem {
  label: string;
  value: string;
}

/** Horizontal tab row that always reflects the active content panel. */
export class TacticalTabs extends Phaser.GameObjects.Container {
  private buttons: TacticalButton[] = [];
  private selectedIndex = 0;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    items: TabItem[],
    onSelect: (value: string, index: number) => void,
    depth = 5,
  ) {
    super(scene, x, y);
    this.setDepth(depth);
    const gap = 6;
    const each = (width - gap * (items.length - 1)) / items.length;
    items.forEach((item, index) => {
      const button = new TacticalButton(scene, index * (each + gap), 0, each, 36, item.label, {
        variant: 'tab',
        selected: index === 0,
        onClick: () => {
          this.select(index);
          onSelect(item.value, index);
        },
        depth,
      });
      this.buttons.push(button);
      this.add(button);
    });
    scene.add.existing(this);
  }

  select(index: number): void {
    this.selectedIndex = index;
    this.buttons.forEach((b, i) => b.setSelected(i === index));
  }

  get activeIndex(): number {
    return this.selectedIndex;
  }
}

export interface SliderOptions {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  width?: number;
  depth?: number;
}

/** Mouse-driven slider. Click or drag anywhere on the track. */
export class TacticalSlider extends Phaser.GameObjects.Container {
  private fill: Phaser.GameObjects.Graphics;
  private handle: Phaser.GameObjects.Rectangle;
  private valueText: Phaser.GameObjects.Text;
  private value: number;
  private min: number;
  private max: number;
  private step: number;
  private trackWidth: number;
  private opts: SliderOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, options: SliderOptions) {
    super(scene, x, y);
    this.opts = options;
    this.min = options.min ?? 0;
    this.max = options.max ?? 1;
    this.step = options.step ?? 0.01;
    this.value = Phaser.Math.Clamp(options.value, this.min, this.max);
    this.trackWidth = options.width ?? 280;
    this.setDepth(options.depth ?? 5);

    const label = txt(scene, 0, 0, options.label, 11, THEME.colors.muted, { letterSpacing: 1.4 });
    this.add(label);
    this.valueText = mono(scene, this.trackWidth, 0, this.format(this.value), 11, THEME.colors.sand, { origin: [1, 0] });
    this.add(this.valueText);
    this.fill = scene.add.graphics();
    this.add(this.fill);
    this.handle = scene.add.rectangle(0, 31, 8, 16, THEME.colors.sand).setOrigin(0.5);
    this.add(this.handle);

    const hit = scene.add.rectangle(this.trackWidth / 2, 31, this.trackWidth + 16, 30, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.add(hit);
    const apply = (pointer: Phaser.Input.Pointer) => {
      const local = Phaser.Math.Clamp((pointer.x - this.getWorldTransformMatrix().tx) / this.trackWidth, 0, 1);
      const raw = this.min + local * (this.max - this.min);
      const rounded = Math.round(raw / this.step) * this.step;
      this.setValue(rounded, true);
    };
    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      apply(pointer);
      audio.play('ui_click');
    });
    hit.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) apply(pointer);
    });
    this.render();
    scene.add.existing(this);
  }

  setValue(value: number, notify = false): void {
    const clamped = Phaser.Math.Clamp(value, this.min, this.max);
    const rounded = Math.round(clamped / this.step) * this.step;
    const changed = rounded !== this.value;
    this.value = rounded;
    this.valueText.setText(this.format(this.value));
    this.render();
    if (notify && changed) this.opts.onChange(this.value);
  }

  getValue(): number {
    return this.value;
  }

  private format(value: number): string {
    if (this.opts.format) return this.opts.format(value);
    return `${Math.round(value * 100)}%`;
  }

  private render(): void {
    const ratio = (this.value - this.min) / (this.max - this.min);
    this.fill.clear();
    this.fill.fillStyle(0x1a2425, 1);
    this.fill.fillRect(0, 30, this.trackWidth, 2);
    this.fill.fillStyle(THEME.colors.sand, 0.9);
    this.fill.fillRect(0, 30, this.trackWidth * ratio, 2);
    this.fill.fillStyle(THEME.colors.mutedDark, 0.35);
    for (let i = 1; i < 10; i += 1) this.fill.fillRect((this.trackWidth / 10) * i, 27, 1, 8);
    this.handle.x = this.trackWidth * ratio;
    this.handle.y = 31;
  }
}

/** Controlled horizontal stat meter used in loadout / store screens. */
export function statBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: string,
  ratio: number,
  valueLabel: string,
  color = THEME.colors.sand,
  depth = 5,
): { container: Phaser.GameObjects.Container; update: (ratio: number, valueLabel?: string) => void } {
  const container = scene.add.container(x, y).setDepth(depth);
  const labelText = txt(scene, 0, 0, label, 9, THEME.colors.muted, { letterSpacing: 1.1 });
  const valueText = mono(scene, width, 0, valueLabel, 9, THEME.colors.sand, { origin: [1, 0] });
  const g = scene.add.graphics();
  const redraw = (r: number, v: string) => {
    g.clear();
    g.fillStyle(0x1b2526, 1);
    g.fillRect(0, 14, width, 3);
    g.fillStyle(color, 0.9);
    g.fillRect(0, 14, Math.max(0, Math.min(1, r)) * width, 3);
    g.fillStyle(0xffffff, 0.06);
    g.fillRect(0, 14, width, 1);
    valueText.setText(v);
  };
  redraw(ratio, valueLabel);
  container.add([labelText, valueText, g]);
  return { container, update: (r, v) => redraw(r, v ?? valueText.text) };
}

export interface HeaderOptions {
  title: string;
  subtitle: string;
  section?: string;
  onBack?: () => void;
  right?: string;
}

/** Standard command-screen header with navigation and a live metadata line. */
export function createHeader(scene: Phaser.Scene, options: HeaderOptions): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(20);
  const g = scene.add.graphics();
  g.fillStyle(0x060b0c, 0.88);
  g.fillRect(0, 0, 1600, 96);
  g.lineStyle(1, THEME.colors.line, 0.9);
  g.beginPath();
  g.moveTo(48, 96);
  g.lineTo(1552, 96);
  g.strokePath();
  g.fillStyle(THEME.colors.sand, 0.9);
  g.fillRect(48, 31, 3, 36);
  g.fillStyle(THEME.colors.amber, 0.55);
  g.fillRect(48, 96 - 2, 220, 2);
  c.add(g);
  if (options.onBack) {
    const back = new TacticalButton(scene, 60, 30, 54, 36, '<', {
      variant: 'small',
      onClick: () => {
        audio.play('ui_back');
        options.onBack?.();
      },
      depth: 21,
    });
    c.add(back);
  }
  const titleX = options.onBack ? 132 : 64;
  const title = txt(scene, titleX, 26, options.title, 26, THEME.colors.white, { letterSpacing: 3 });
  const sub = mono(scene, titleX + 2, 58, options.subtitle, 10, THEME.colors.muted, { letterSpacing: 1.6 });
  c.add([title, sub]);
  if (options.section) {
    const section = mono(scene, 1536, 34, options.section, 10, THEME.colors.amber, { origin: [1, 0], letterSpacing: 1.6 });
    c.add(section);
  }
  if (options.right) {
    const right = mono(scene, 1536, 58, options.right, 10, THEME.colors.muted, { origin: [1, 0] });
    c.add(right);
  }
  return c;
}

export function addScanlines(scene: Phaser.Scene, depth = 50): Phaser.GameObjects.TileSprite {
  return scene.add
    .tileSprite(0, 0, 1600, 900, 'fx_scanlines')
    .setOrigin(0)
    .setAlpha(0.55)
    .setDepth(depth);
}

export function addBackdrop(scene: Phaser.Scene): void {
  scene.add.image(0, 0, 'bg_command').setOrigin(0).setDisplaySize(1600, 900).setDepth(-10);
  addScanlines(scene, 60);
}

/** Browser modal confirmation, used for destructive actions such as resetting a save. */
export function confirmModal(
  scene: Phaser.Scene,
  title: string,
  body: string,
  confirmLabel: string,
  onConfirm: () => void,
  onCancel: () => void,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(200);
  const shade = scene.add.rectangle(800, 450, 1600, 900, 0x020404, 0.8).setInteractive();
  container.add(shade);
  const g = scene.add.graphics();
  drawPanel(g, 470, 300, 660, 300, {
    fill: THEME.colors.panel,
    fillAlpha: 0.98,
    stroke: THEME.colors.lineBright,
    accent: THEME.colors.danger,
    cut: 18,
  });
  container.add(g);
  container.add(txt(scene, 510, 336, title, 22, THEME.colors.white, { letterSpacing: 2.4 }));
  container.add(mono(scene, 510, 374, body, 11, THEME.colors.muted, { wordWrapWidth: 580, lineSpacing: 6 }));
  const cancel = new TacticalButton(scene, 510, 500, 260, 48, 'CANCEL', {
    variant: 'secondary',
    onClick: onCancel,
    depth: 201,
  });
  const confirm = new TacticalButton(scene, 790, 500, 300, 48, confirmLabel, {
    variant: 'danger',
    onClick: onConfirm,
    depth: 201,
  });
  container.add([cancel, confirm]);
  return container;
}

export function divider(scene: Phaser.Scene, x: number, y: number, width: number, depth = 5): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.lineStyle(1, THEME.colors.line, 0.9);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + width, y);
  g.strokePath();
  g.fillStyle(THEME.colors.sand, 0.55);
  g.fillRect(x, y - 1, 28, 2);
  return g;
}

/** Key/value status row used in dossier and result panels. */
export function dataRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  key: string,
  value: string,
  valueColor: number = THEME.colors.white,
  depth = 5,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(depth);
  const k = mono(scene, 0, 0, key, 10, THEME.colors.muted, { letterSpacing: 1.2 });
  const v = mono(scene, width, 0, value, 10, valueColor, { origin: [1, 0], letterSpacing: 1.2 });
  const g = scene.add.graphics();
  g.fillStyle(THEME.colors.line, 0.45);
  g.fillRect(0, 15, width, 1);
  c.add([k, v, g]);
  return c;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}
