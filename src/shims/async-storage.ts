const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  async multiGet(keys: readonly string[]): Promise<[string, string | null][]> {
    return keys.map((k) => [k, window.localStorage.getItem(k)]);
  },
  async multiSet(keyValuePairs: readonly [string, string][]): Promise<void> {
    for (const [k, v] of keyValuePairs) {
      window.localStorage.setItem(k, v);
    }
  },
  async multiRemove(keys: readonly string[]): Promise<void> {
    for (const k of keys) {
      window.localStorage.removeItem(k);
    }
  },
  async clear(): Promise<void> {
    window.localStorage.clear();
  },
  async getAllKeys(): Promise<string[]> {
    return Object.keys(window.localStorage);
  },
};

export default AsyncStorage;
