const SESSION_RE = /^[a-f0-9]{48}$/;

export function isSessionId(value: string) {
  return SESSION_RE.test(value);
}

export function sessionFromHeader(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

export class SessionStoreMap<T> {
  private stores = new Map<string, Promise<T>>();

  constructor(private create: (sessionId: string) => Promise<T>) {}

  get(sessionId: string): Promise<T> {
    if (!isSessionId(sessionId)) {
      const error = Object.assign(new Error('Invalid session'), { status: 401 });
      throw error;
    }
    let store = this.stores.get(sessionId);
    if (!store) {
      store = this.create(sessionId);
      this.stores.set(sessionId, store);
      void store.catch(() => this.stores.delete(sessionId));
    }
    return store;
  }
}
