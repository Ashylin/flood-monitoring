import { useEffect, useState } from "react";

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — keeps requests well within Unsplash's free-tier rate limit
const APP_NAME = "tn_flood_monitoring"; // used only for the required utm_source on attribution links

export interface UnsplashPhoto {
  imageUrl: string;
  altDescription: string;
  photographerName: string;
  photographerProfileUrl: string;
}

interface CacheEntry {
  fetchedAt: number;
  photo: UnsplashPhoto | null;
}

function cacheKeyFor(query: string) {
  return `unsplash-cache:${query}`;
}

function readCache(query: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKeyFor(query));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null; // localStorage unavailable (private mode, quota) — just refetch
  }
}

function writeCache(query: string, photo: UnsplashPhoto | null) {
  try {
    localStorage.setItem(cacheKeyFor(query), JSON.stringify({ fetchedAt: Date.now(), photo }));
  } catch {
    // non-fatal — caching is a courtesy to the rate limit, not a requirement
  }
}

/**
 * Fetches a real, licensed photo from Unsplash's API for the given search
 * query. Requires VITE_UNSPLASH_ACCESS_KEY (free, from unsplash.com/developers).
 * With no key configured, or on any fetch failure, returns { photo: null } —
 * callers must render an honest non-photo fallback, never a placeholder that
 * looks like a real image.
 */
export function useUnsplashPhoto(query: string): { photo: UnsplashPhoto | null; loading: boolean } {
  const [photo, setPhoto] = useState<UnsplashPhoto | null>(null);
  const [loading, setLoading] = useState(Boolean(ACCESS_KEY));

  useEffect(() => {
    if (!ACCESS_KEY) {
      setLoading(false);
      return;
    }

    const cached = readCache(query);
    if (cached) {
      setPhoto(cached.photo);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`, {
      headers: { Authorization: `Client-ID ${ACCESS_KEY}`, "Accept-Version": "v1" },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Unsplash ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        const result: UnsplashPhoto = {
          imageUrl: data.urls.regular,
          altDescription: data.alt_description || query,
          photographerName: data.user.name,
          photographerProfileUrl: `${data.user.links.html}?utm_source=${APP_NAME}&utm_medium=referral`,
        };
        setPhoto(result);
        writeCache(query, result);
      })
      .catch(() => {
        if (cancelled) return;
        setPhoto(null);
        writeCache(query, null); // cache the miss too, so a bad key doesn't retry every render
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return { photo, loading };
}
