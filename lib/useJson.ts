"use client";

import { useCallback, useEffect, useState } from "react";

interface FetchState<T> {
  /** The request key this state belongs to, so stale responses are never shown. */
  key: string | null;
  data: T | null;
  error: string | null;
}

export interface UseJsonResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  /** The most recent successful result, even if it was for an earlier URL. Lets a view keep
   * showing old rows while the next page loads, instead of flashing an empty state. */
  lastData: T | null;
  retry: () => void;
}

/**
 * Fetches JSON from one of our own API routes.
 *
 * Loading is derived (the latest finished request doesn't match the current URL)
 * rather than set inside the effect, which keeps React's effect rules happy without
 * eslint-disable comments. An AbortController cancels the previous request when the
 * URL changes, so a slow old response can never overwrite a newer one.
 */
export function useJson<T>(url: string | null): UseJsonResult<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<FetchState<T>>({ key: null, data: null, error: null });

  const key = url ? `${url}#${attempt}` : null;

  useEffect(() => {
    if (!url || !key) return;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body?.error?.message ?? `Request failed (HTTP ${res.status})`);
        }
        return (await res.json()) as T;
      })
      .then((data) => setState({ key, data, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Something went wrong loading data.";
        setState({ key, data: null, error: message });
      });

    return () => controller.abort();
  }, [url, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const isCurrent = state.key === key;
  return {
    data: isCurrent ? state.data : null,
    error: isCurrent ? state.error : null,
    isLoading: key !== null && !isCurrent,
    lastData: state.data,
    retry,
  };
}
