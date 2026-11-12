import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Module-level memory cache.
 * Survives component unmount/remount within the same tab.
 * Key: cacheKey → { data, fetchedAt }
 */
const memoryCache = new Map();

/**
 * Read cache synchronously.
 * Prefers memory cache; falls back to localStorage.
 */
function getCached(cacheKey) {
  if (!cacheKey) return null;

  // 1. In-memory (fastest — survives unmount)
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey).data;
  }

  // 2. localStorage (survives reloads)
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data !== undefined) {
      memoryCache.set(cacheKey, {
        data: parsed.data,
        fetchedAt: parsed.fetchedAt || 0,
      });
      return parsed.data;
    }
  } catch {
    // ignore parse errors
  }

  return null;
}

function setCached(cacheKey, data) {
  if (!cacheKey) return;
  const entry = { data, fetchedAt: Date.now() };
  memoryCache.set(cacheKey, entry);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

function clearCached(cacheKey) {
  if (!cacheKey) return;
  memoryCache.delete(cacheKey);
  try {
    localStorage.removeItem(cacheKey);
  } catch {}
}

/**
 * useCachedFetch
 *
 * - Reads cache SYNCHRONOUSLY on mount → no loading flash
 * - Fetches ONLY when: (a) no cache for this key, or (b) refresh() called
 * - Memory cache means: switching tabs never re-fetches
 */
export function useCachedFetch(cacheKey, fetcher, options = {}) {
  const { enabled = true, timeout = 30000 } = options;

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // Initial state — synchronous cache read, no flash
  const [data, setData] = useState(() => getCached(cacheKey));
  const [loading, setLoading] = useState(
    () => enabled && !!cacheKey && getCached(cacheKey) === null
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const keyRef = useRef(cacheKey);

  // ---- Handle cacheKey change (e.g. user loads after mount) ----
  useEffect(() => {
    if (keyRef.current === cacheKey) return;
    keyRef.current = cacheKey;

    const cached = getCached(cacheKey);
    setData(cached);
    setLoading(enabled && !!cacheKey && cached === null);
  }, [cacheKey, enabled]);

  // ---- Main fetch effect — only if NO cache for this key ----
  useEffect(() => {
    if (!enabled || !cacheKey) {
      setLoading(false);
      return;
    }

    const cached = getCached(cacheKey);
    if (cached !== null && cached !== undefined) {
      // ✅ Cache hit → show it, DO NOT fetch
      setData(cached);
      setLoading(false);
      return;
    }

    // ❌ No cache → fetch once
    let cancelled = false;
    setLoading(true);

    Promise.race([
      fetcherRef.current(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Request timed out. Try refreshing.")),
          timeout
        )
      ),
    ])
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setCached(cacheKey, result);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.data?.detail || err.message || "Failed to load"
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, timeout]);

  // ---- Manual refresh ----
  const refresh = useCallback(async () => {
    if (!cacheKey || !enabled) return;
    setRefreshing(true);
    try {
      const result = await Promise.race([
        fetcherRef.current(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timed out. Try refreshing.")),
            timeout
          )
        ),
      ]);
      setData(result);
      setCached(cacheKey, result);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, [cacheKey, enabled, timeout]);

  const clearCache = useCallback(() => {
    clearCached(cacheKey);
  }, [cacheKey]);

  return { data, loading, refreshing, error, refresh, clearCache };
}

export default useCachedFetch;