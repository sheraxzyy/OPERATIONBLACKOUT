import Phaser from 'phaser';
import type { KeyAction, Keybinds } from '../core/types';

/**
 * Phaser-independent-feeling input layer driven by native KeyboardEvent.code
 * values. This keeps the game faithful to the editable bindings saved in the
 * profile instead of Phaser's legacy keycode table.
 */
export class InputManager {
  private readonly scene: Phaser.Scene;
  private bindings: Keybinds;
  private readonly down = new Set<string>();
  private previous = new Set<string>();
  private justPressedCodes = new Set<string>();
  private pointerX = 0;
  private pointerY = 0;
  private wheelDelta = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene, bindings: Keybinds) {
    this.scene = scene;
    this.bindings = { ...bindings };

    scene.input.keyboard?.on('keydown', this.onKeyDown, this);
    scene.input.keyboard?.on('keyup', this.onKeyUp, this);
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('wheel', this.onWheel, this);
    scene.input.mouse?.disableContextMenu();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.destroyed) return;
    if (event.code === 'F5' || event.code === 'F12') return;
    this.down.add(event.code);
    if (event.code === 'Tab' || event.code === 'Space') event.preventDefault();
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.down.delete(event.code);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.pointerX = pointer.x;
    this.pointerY = pointer.y;
    if (pointer.leftButtonDown()) this.down.add('Mouse0');
    if (pointer.rightButtonDown()) this.down.add('Mouse2');
    if (pointer.middleButtonDown()) this.down.add('Mouse1');
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown()) this.down.delete('Mouse0');
    if (!pointer.rightButtonDown()) this.down.delete('Mouse2');
    if (!pointer.middleButtonDown()) this.down.delete('Mouse1');
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.pointerX = pointer.x;
    this.pointerY = pointer.y;
  }

  private onWheel(_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    this.wheelDelta += dy;
  }

  /** Snapshot edge state. Call once per frame before reading actions. */
  update(): void {
    this.justPressedCodes.clear();
    for (const code of this.down) {
      if (!this.previous.has(code)) this.justPressedCodes.add(code);
    }
    this.previous = new Set(this.down);
  }

  isDown(action: KeyAction): boolean {
    return this.down.has(this.bindings[action]);
  }

  justPressed(action: KeyAction): boolean {
    return this.justPressedCodes.has(this.bindings[action]);
  }

  anyPressed(...actions: KeyAction[]): boolean {
    return actions.some((action) => this.justPressed(action));
  }

  get pointerScreenX(): number {
    return this.pointerX;
  }

  get pointerScreenY(): number {
    return this.pointerY;
  }

  aimPoint(camera: Phaser.Cameras.Scene2D.Camera): { x: number; y: number } {
    const point = camera.getWorldPoint(this.pointerX, this.pointerY);
    return { x: point.x, y: point.y };
  }

  consumeWheel(): number {
    const value = this.wheelDelta;
    this.wheelDelta = 0;
    return value;
  }

  setBindings(bindings: Keybinds): void {
    this.bindings = { ...bindings };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.input.keyboard?.off('keydown', this.onKeyDown, this);
    this.scene.input.keyboard?.off('keyup', this.onKeyUp, this);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('wheel', this.onWheel, this);
    this.down.clear();
    this.previous.clear();
  }
}
