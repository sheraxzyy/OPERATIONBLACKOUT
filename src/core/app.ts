import type { SaveData, SaveSettings } from './types';
import { SaveService } from './save';
import { createDefaultSave } from './progression';

/**
 * Application-level persistence context. Scenes read `app.save` and call
 * `app.commit()` after changes. Keeping this outside Phaser makes it easy to
 * test and means no scene owns hidden state.
 */
class AppContext {
  save: SaveData = createDefaultSave();
  readonly saveService = new SaveService();
  ready = false;
  loadWarning = '';
  recoveredFrom: 'local' | 'indexeddb' | 'default' = 'default';

  async init(): Promise<void> {
    if (this.ready) return;
    try {
      const result = await this.saveService.load();
      this.save = result.save;
      this.recoveredFrom = result.source;
      if (result.repaired || result.error) {
        this.loadWarning = result.error ?? 'Save data was repaired to a valid state.';
      }
      this.ready = true;
    } catch (err) {
      this.save = createDefaultSave();
      this.loadWarning = `Persistence unavailable. Progress will last for this session. ${(err as Error).message}`;
      this.ready = true;
    }
  }

  commit(): void {
    this.save.updatedAt = Date.now();
    try {
      this.saveService.save(this.save);
    } catch {
      /* in-memory fallback is handled by the storage adapter */
    }
  }

  get settings(): SaveSettings {
    return this.save.settings;
  }

  addCredits(amount: number): void {
    this.save.credits = Math.max(0, this.save.credits + Math.round(amount));
    this.commit();
  }

  updateSettings(patch: Partial<SaveSettings>): void {
    this.save.settings = { ...this.save.settings, ...patch };
    this.commit();
  }

  async resetProgress(): Promise<void> {
    const settings = { ...this.save.settings };
    const keybinds = { ...this.save.keybinds };
    const createdAt = this.save.createdAt;
    this.save = createDefaultSave();
    this.save.settings = settings;
    this.save.keybinds = keybinds;
    this.save.createdAt = createdAt;
    await this.saveService.clear();
    this.commit();
  }
}

export const app = new AppContext();
