const store = new Map<string, unknown>();

/**
 * In-memory memoization for the life of the server process — no TTL/expiry.
 * Fine for values that are immutable once fetched (e.g. a past APOD by date);
 * don't use this for anything that can change under a stable key.
 */
export function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (store.has(key)) {
    return Promise.resolve(store.get(key) as T);
  }
  return fetcher().then((value) => {
    store.set(key, value);
    return value;
  });
}
