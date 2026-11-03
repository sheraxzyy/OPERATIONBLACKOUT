import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KEYBINDS,
  findBinding,
  keyLabel,
  setKeybind,
  validateKeybinds,
} from '../src/core/keybinds';

describe('controls', () => {
  it('has a unique binding for every action by default', () => {
    const values = Object.values(DEFAULT_KEYBINDS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('formats codes for the UI', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('ShiftLeft')).toBe('L-SHIFT');
    expect(keyLabel('Mouse0')).toBe('LMB');
    expect(keyLabel('')).toBe('UNBOUND');
  });

  it('rebinds an action and swaps conflicts', () => {
    const next = setKeybind(DEFAULT_KEYBINDS, 'reload', 'KeyW');
    expect(next.reload).toBe('KeyW');
    expect(next.moveUp).toBe('KeyR');
    expect(findBinding(next, 'KeyW')).toBe('reload');
  });

  it('sanitises corrupt bindings back to defaults', () => {
    const valid = validateKeybinds({ moveUp: 'KeyZ', reload: 42, sprint: '' });
    expect(valid.moveUp).toBe('KeyZ');
    expect(valid.reload).toBe('KeyR');
    expect(valid.sprint).toBe('ShiftLeft');
  });

  it('resolves duplicate persisted bindings', () => {
    const valid = validateKeybinds({ moveUp: 'KeyX', moveDown: 'KeyX' });
    expect(valid.moveUp).toBe('KeyX');
    expect(valid.moveDown).toBe('KeyS');
    expect(new Set(Object.values(valid)).size).toBe(Object.values(valid).length);
  });
});
