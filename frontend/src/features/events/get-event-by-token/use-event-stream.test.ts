import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEventStream } from "./use-event-stream";

const invalidate = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

type Listener = (event: MessageEvent<string>) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  url: string;
  closed = false;
  private listeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data?: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data } as MessageEvent<string>);
    }
  }
}

beforeEach(() => {
  invalidate.mockClear();
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function latestSource(): FakeEventSource {
  const source = FakeEventSource.instances.at(-1);
  if (!source) throw new Error("no EventSource was opened");
  return source;
}

describe("useEventStream", () => {
  it("opens an EventSource to the token's stream endpoint", () => {
    renderHook(() => useEventStream("tok1", 5));

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(latestSource().url).toContain("/api/events/tok1/stream");
  });

  it("invalidates once on connect to catch up on anything missed", () => {
    renderHook(() => useEventStream("tok1", 5));

    latestSource().emit("open");

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("schedules a debounced invalidate for a newer revision", () => {
    renderHook(() => useEventStream("tok1", 5));

    latestSource().emit("changed", "6");
    expect(invalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("ignores an equal or older revision", () => {
    renderHook(() => useEventStream("tok1", 5));

    latestSource().emit("changed", "5");
    latestSource().emit("changed", "4");
    vi.advanceTimersByTime(300);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("coalesces a burst of changed events into a single invalidate", () => {
    renderHook(() => useEventStream("tok1", 5));
    const source = latestSource();

    source.emit("changed", "6");
    vi.advanceTimersByTime(100);
    source.emit("changed", "7");
    vi.advanceTimersByTime(100);
    source.emit("changed", "8");
    vi.advanceTimersByTime(300);

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("gates a self-echo once the revision prop advances past it", () => {
    const { rerender } = renderHook(
      ({ revision }) => useEventStream("tok1", revision),
      { initialProps: { revision: 5 } },
    );

    rerender({ revision: 6 });
    latestSource().emit("changed", "6");
    vi.advanceTimersByTime(300);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("closes the EventSource on unmount", () => {
    const { unmount } = renderHook(() => useEventStream("tok1", 5));
    const source = latestSource();

    unmount();

    expect(source.closed).toBe(true);
  });

  it("does not reopen the connection when only the revision prop changes", () => {
    const { rerender } = renderHook(
      ({ revision }) => useEventStream("tok1", revision),
      { initialProps: { revision: 5 } },
    );

    rerender({ revision: 6 });

    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
