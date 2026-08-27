import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { env } from "../../../../env";

const INVALIDATE_DEBOUNCE_MS = 300;

// Subscribes to the backend's SSE stream for an event token and refetches
// the loader when a newer revision arrives. A blocked/disabled stream simply
// never fires — the page keeps working on today's own-action refresh, which
// is the graceful-degrade case this hook is not responsible for detecting.
export function useEventStream(token: string, revision: number): void {
  const router = useRouter();
  // Holds the latest invalidate without making the connection effect below
  // depend on `router` — its identity isn't guaranteed stable across renders,
  // and the connection should stay keyed by `token` alone.
  const invalidateRef = useRef(router.invalidate);
  const lastAppliedRef = useRef(revision);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invalidateRef.current = router.invalidate;
  });

  useEffect(() => {
    lastAppliedRef.current = revision;
  }, [revision]);

  useEffect(() => {
    const source = new EventSource(
      `${env.VITE_API_URL}/api/events/${token}/stream`,
    );

    function scheduleInvalidate() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void invalidateRef.current();
      }, INVALIDATE_DEBOUNCE_MS);
    }

    function handleOpen() {
      void invalidateRef.current();
    }

    function handleChanged(event: MessageEvent<string>) {
      const incoming = Number(event.data);
      if (Number.isFinite(incoming) && incoming > lastAppliedRef.current) {
        scheduleInvalidate();
      }
    }

    source.addEventListener("open", handleOpen);
    source.addEventListener("changed", handleChanged);

    return () => {
      source.removeEventListener("open", handleOpen);
      source.removeEventListener("changed", handleChanged);
      source.close();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, [token]);
}
