/**
 * Safe Storage utility for Samsung Family Hub (Tizen WebKit) and legacy browser compatibility.
 * Provides resilient fallbacks (Memory Storage & Cookie backup) if localStorage is restricted or throws.
 */

class SafeStorageWrapper {
  private memoryMap = new Map<string, string>();
  private isLocalStorageAvailable: boolean = false;

  constructor() {
    this.checkLocalStorage();
    this.installGlobalFallback();
  }

  private checkLocalStorage(): void {
    if (typeof window === 'undefined') {
      this.isLocalStorageAvailable = false;
      return;
    }

    try {
      const testKey = '__smartlife_storage_probe__';
      window.localStorage.setItem(testKey, '1');
      const val = window.localStorage.getItem(testKey);
      window.localStorage.removeItem(testKey);
      this.isLocalStorageAvailable = val === '1';
    } catch {
      this.isLocalStorageAvailable = false;
    }
  }

  private installGlobalFallback(): void {
    if (typeof window === 'undefined') return;

    if (!this.isLocalStorageAvailable) {
      try {
        const self = this;
        const fakeStorage = {
          getItem: (key: string) => self.getItem(key),
          setItem: (key: string, value: string) => self.setItem(key, value),
          removeItem: (key: string) => self.removeItem(key),
          clear: () => self.clear(),
          key: (index: number) => Array.from(self.memoryMap.keys())[index] || null,
          get length() {
            return self.memoryMap.size;
          },
        };

        Object.defineProperty(window, 'localStorage', {
          value: fakeStorage,
          writable: true,
          configurable: true,
        });
      } catch (e) {
        // Ignore if Object.defineProperty is locked
      }
    }
  }

  public getItem(key: string): string | null {
    if (this.isLocalStorageAvailable) {
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) return item;
      } catch {
        // Fallback to memory
      }
    }

    // Try memory
    if (this.memoryMap.has(key)) {
      return this.memoryMap.get(key) || null;
    }

    // Try reading cookie as secondary fallback
    try {
      if (typeof document !== 'undefined' && document.cookie) {
        const match = document.cookie.match(new RegExp('(^|;\\s*)' + encodeURIComponent(key) + '=([^;]*)'));
        if (match) {
          return decodeURIComponent(match[2]);
        }
      }
    } catch {
      // Ignore cookie errors
    }

    return null;
  }

  public setItem(key: string, value: string): void {
    const strVal = String(value);
    this.memoryMap.set(key, strVal);

    if (this.isLocalStorageAvailable) {
      try {
        window.localStorage.setItem(key, strVal);
        return;
      } catch {
        // If quota exceeded or blocked, proceed with memory/cookie
      }
    }

    // Secondary cookie fallback
    try {
      if (typeof document !== 'undefined' && strVal.length < 2048) {
        document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(strVal)};path=/;max-age=31536000;SameSite=Lax`;
      }
    } catch {
      // Ignore cookie errors
    }
  }

  public removeItem(key: string): void {
    this.memoryMap.delete(key);

    if (this.isLocalStorageAvailable) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    }

    try {
      if (typeof document !== 'undefined') {
        document.cookie = `${encodeURIComponent(key)}=;path=/;max-age=0`;
      }
    } catch {
      // Ignore
    }
  }

  public clear(): void {
    this.memoryMap.clear();

    if (this.isLocalStorageAvailable) {
      try {
        window.localStorage.clear();
      } catch {
        // Ignore
      }
    }
  }
}

export const safeStorage = new SafeStorageWrapper();
