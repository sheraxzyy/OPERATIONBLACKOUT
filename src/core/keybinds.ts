import type { KeyAction, Keybinds } from './types';

export const DEFAULT_KEYBINDS: Keybinds = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  shoot: 'Mouse0',
  reload: 'KeyR',
  interact: 'KeyE',
  sprint: 'ShiftLeft',
  crouch: 'ControlLeft',
  weapon1: 'Digit1',
  weapon2: 'Digit2',
  weapon3: 'Digit3',
  grenade: 'KeyG',
  vehicle: 'KeyF',
  flashlight: 'KeyT',
  medkit: 'KeyH',
  pause: 'Escape',
};

export const KEY_ACTION_ORDER: KeyAction[] = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'shoot',
  'reload',
  'interact',
  'sprint',
  'crouch',
  'weapon1',
  'weapon2',
  'weapon3',
  'grenade',
  'vehicle',
  'flashlight',
  'medkit',
  'pause',
];

export const KEY_ACTION_LABEL: Record<KeyAction, string> = {
  moveUp: 'MOVE FORWARD',
  moveDown: 'MOVE BACK',
  moveLeft: 'STRAFE LEFT',
  moveRight: 'STRAFE RIGHT',
  shoot: 'FIRE',
  reload: 'RELOAD',
  interact: 'INTERACT',
  sprint: 'SPRINT',
  crouch: 'CROUCH',
  weapon1: 'PRIMARY WEAPON',
  weapon2: 'SECONDARY WEAPON',
  weapon3: 'SIDEARM',
  grenade: 'FRAG GRENADE',
  vehicle: 'ENTER / EXIT VEHICLE',
  flashlight: 'WEAPON LIGHT',
  medkit: 'USE MEDKIT',
  pause: 'PAUSE / BACK',
};

const CODE_LABELS: Record<string, string> = {
  ShiftLeft: 'L-SHIFT',
  ShiftRight: 'R-SHIFT',
  ControlLeft: 'L-CTRL',
  ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT',
  AltRight: 'R-ALT',
  Space: 'SPACE',
  Escape: 'ESC',
  Enter: 'ENTER',
  Tab: 'TAB',
  Backspace: 'BACKSPACE',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  CapsLock: 'CAPS',
  Mouse0: 'LMB',
  Mouse1: 'MMB',
  Mouse2: 'RMB',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};

export function keyLabel(code: string): string {
  if (!code) return 'UNBOUND';
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.toUpperCase();
}

/**
 * Set a binding and resolve conflicts by swapping with the action that
 * currently owns the key. This guarantees every action remains reachable.
 */
export function setKeybind(bindings: Keybinds, action: KeyAction, code: string): Keybinds {
  if (!code) return { ...bindings };
  const next: Keybinds = { ...bindings };
  const previous = next[action];
  const conflicting = (Object.keys(next) as KeyAction[]).find((key) => key !== action && next[key] === code);
  next[action] = code;
  if (conflicting) next[conflicting] = previous;
  return next;
}

export function validateKeybinds(input: unknown): Keybinds {
  const defaults = { ...DEFAULT_KEYBINDS };
  if (!input || typeof input !== 'object') return defaults;
  const source = input as Record<string, unknown>;
  for (const action of KEY_ACTION_ORDER) {
    const value = source[action];
    if (typeof value === 'string' && value.length > 0 && value.length <= 32) {
      defaults[action] = value;
    }
  }
  // Remove duplicates deterministically: later actions fall back to default.
  const seen = new Set<string>();
  for (const action of KEY_ACTION_ORDER) {
    if (seen.has(defaults[action])) {
      defaults[action] = DEFAULT_KEYBINDS[action];
    }
    seen.add(defaults[action]);
  }
  return defaults;
}

export function findBinding(bindings: Keybinds, code: string): KeyAction | undefined {
  return KEY_ACTION_ORDER.find((action) => bindings[action] === code);
}
