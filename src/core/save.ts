import type { SaveData } from './types';
import { SAVE_VERSION, createDefaultSave, normalizeSave } from './progression';

export const SAVE_KEY = 'operation-blackout.save.v1';
const IDB_NAME = 'operation-blackout';
const IDB_STORE = 'saves';
const IDB_KEY = 'primary';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

class BrowserStorage implements KeyValueStorage {
  private memory = new MemoryStorage();
  private usable = true;

  constructor() {
    try {
      const probe = '__ob_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
    } catch {
      this.usable = false;
    }
  }

  getItem(key: string): string | null {
    if (!this.usable) return this.memory.getItem(key);
    try {
      return window.localStorage.getItem(key);
    } catch {
      return this.memory.getItem(key);
    }
  }

  setItem(key: string, value: string): void {
    this.memory.setItem(key, value);
    if (!this.usable) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      this.usable = false;
    }
  }

  removeItem(key: string): void {
    this.memory.removeItem(key);
    if (!this.usable) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export interface SaveLoadResult {
  save: SaveData;
  repaired: boolean;
  source: 'local' | 'indexeddb' | 'default';
  error?: string;
}

/** IndexedDB mirror used for recovery when localStorage is unavailable/corrupt. */
class IdbMirror {
  private available = typeof indexedDB !== 'undefined';

  private open(): Promise<IDBDatabase | null> {
    if (!this.available) return Promise.resolve(null);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (db: IDBDatabase | null) => {
        if (settled) return;
        settled = true;
        resolve(db);
      };
      try {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        request.onsuccess = () => finish(request.result);
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
        setTimeout(() => finish(null), 2500);
      } catch {
        finish(null);
      }
    });
  }

  async read(): Promise<string | null> {
    const db = await this.open();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
        req.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
      } catch {
        resolve(null);
      }
    });
  }

  async write(value: string): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, IDB_KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        resolve();
      }
    });
  }

  async clear(): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        resolve();
      }
    });
  }
}

/**
 * Persistence service. LocalStorage is the synchronous source of truth;
 * IndexedDB is a recovery mirror. Both are versioned via the save schema and
 * every load path passes through normalizeSave().
 */
export class SaveService {
  private storage: KeyValueStorage;
  private mirror: IdbMirror;
  private lastSerialized = '';

  constructor(storage?: KeyValueStorage, mirror?: IdbMirror) {
    this.storage =
      storage ?? (typeof window !== 'undefined' ? new BrowserStorage() : new MemoryStorage());
    this.mirror = mirror ?? new IdbMirror();
  }

  async load(): Promise<SaveLoadResult> {
    let repaired = false;
    let error: string | undefined;
    const localRaw = this.storage.getItem(SAVE_KEY);
    let candidate: unknown = null;
    let source: SaveLoadResult['source'] = 'default';

    if (localRaw) {
      try {
        candidate = JSON.parse(localRaw);
        source = 'local';
      } catch (err) {
        repaired = true;
        error = `Local save could not be parsed: ${(err as Error).message}`;
      }
    }

    if (!candidate) {
      const idbRaw = await this.mirror.read();
      if (idbRaw) {
        try {
          candidate = JSON.parse(idbRaw);
          source = 'indexeddb';
        } catch (err) {
          repaired = true;
          error = `Recovery save could not be parsed: ${(err as Error).message}`;
        }
      }
    }

    if (candidate && typeof candidate === 'object') {
      const version = (candidate as { version?: unknown }).version;
      if (version !== SAVE_VERSION) repaired = true;
    }

    const save = normalizeSave(candidate ?? createDefaultSave());
    if (!candidate) {
      repaired = Boolean(localRaw);
      source = 'default';
    }
    this.lastSerialized = JSON.stringify(save);
    // Heal the primary store immediately, and mirror asynchronously.
    this.storage.setItem(SAVE_KEY, this.lastSerialized);
    void this.mirror.write(this.lastSerialized);
    return { save, repaired, source, error };
  }

  save(data: SaveData): void {
    const serialized = JSON.stringify(data);
    if (serialized === this.lastSerialized) return;
    this.lastSerialized = serialized;
    this.storage.setItem(SAVE_KEY, serialized);
    void this.mirror.write(serialized);
  }

  async flush(): Promise<void> {
    if (this.lastSerialized) await this.mirror.write(this.lastSerialized);
  }

  async clear(): Promise<void> {
    this.storage.removeItem(SAVE_KEY);
    this.lastSerialized = '';
    await this.mirror.clear();
  }

  /** Exposed for tests / diagnostics. */
  readRaw(): string | null {
    return this.storage.getItem(SAVE_KEY);
  }
}

export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    return normalizeSave(JSON.parse(raw));
  } catch {
    return null;
  }
}
