"use client";

import { useCallback, useRef } from "react";

/**
 * Runs an async action at most once at a time. A second press while the first is still working
 * (a double click, or a tap that lands before the button re-renders as disabled) is ignored.
 */
export function useSingleFlight() {
  const busy = useRef(false);
  return useCallback(async (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn();
    } finally {
      busy.current = false;
    }
  }, []);
}
