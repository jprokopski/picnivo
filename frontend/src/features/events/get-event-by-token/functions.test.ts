import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Unwrap the createServerFn builder so the handler is directly callable with
// `{ data }`, bypassing the RPC/validation layer we don't exercise here.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (fn: (args: { data: unknown }) => unknown) => fn,
    };
    return builder;
  },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestUrl: vi.fn(),
}));

const getParticipantIdCookie = vi.fn();
const setParticipantIdCookie = vi.fn();
vi.mock("../../../lib/participant/cookie", () => ({
  getParticipantIdCookie: (...args: unknown[]) =>
    getParticipantIdCookie(...args),
  setParticipantIdCookie: (...args: unknown[]) =>
    setParticipantIdCookie(...args),
}));

const getUser = vi.fn();
const getSession = vi.fn();
vi.mock("../../../lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ auth: { getUser, getSession } }),
}));

const getMyParticipant = vi.fn();
vi.mock("../../../api/picnivo-api", () => ({
  getEventByToken: vi.fn(),
  getMyParticipant: (...args: unknown[]) => getMyParticipant(...args),
}));

import { getMyParticipantIdFn } from "./functions";

const resolve = (token = "tok1") =>
  (
    getMyParticipantIdFn as unknown as (args: {
      data: { token: string };
    }) => Promise<string | null>
  )({ data: { token } });

describe("getMyParticipantIdFn", () => {
  beforeEach(() => {
    getParticipantIdCookie.mockReset();
    setParticipantIdCookie.mockReset();
    getUser.mockReset();
    getSession.mockReset();
    getMyParticipant.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the cookie value without touching session or the endpoint", async () => {
    getParticipantIdCookie.mockReturnValue("p-cookie");

    const result = await resolve();

    expect(result).toBe("p-cookie");
    expect(getUser).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(getMyParticipant).not.toHaveBeenCalled();
    expect(setParticipantIdCookie).not.toHaveBeenCalled();
  });

  it("resolves via the endpoint and backfills the cookie for an authenticated organizer", async () => {
    getParticipantIdCookie.mockReturnValue(undefined);
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    getSession.mockResolvedValue({
      data: { session: { access_token: "jwt-123" } },
    });
    getMyParticipant.mockResolvedValue({ participantId: "p-account" });

    const result = await resolve("tok1");

    expect(result).toBe("p-account");
    expect(getMyParticipant).toHaveBeenCalledWith("tok1", {
      headers: { Authorization: "Bearer jwt-123" },
    });
    expect(setParticipantIdCookie).toHaveBeenCalledWith("tok1", "p-account");
  });

  it("returns null for a guest with no user, without calling the endpoint", async () => {
    getParticipantIdCookie.mockReturnValue(undefined);
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await resolve();

    expect(result).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
    expect(getMyParticipant).not.toHaveBeenCalled();
    expect(setParticipantIdCookie).not.toHaveBeenCalled();
  });

  it("returns null (no throw) when the endpoint 404s for a non-organizer", async () => {
    getParticipantIdCookie.mockReturnValue(undefined);
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    getSession.mockResolvedValue({
      data: { session: { access_token: "jwt-123" } },
    });
    getMyParticipant.mockRejectedValue(
      new AxiosError("Not Found", undefined, undefined, undefined, {
        status: 404,
      } as never),
    );

    const result = await resolve();

    expect(result).toBeNull();
    expect(setParticipantIdCookie).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns null and logs when the endpoint fails unexpectedly", async () => {
    getParticipantIdCookie.mockReturnValue(undefined);
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    getSession.mockResolvedValue({
      data: { session: { access_token: "jwt-123" } },
    });
    getMyParticipant.mockRejectedValue(new Error("network down"));

    const result = await resolve();

    expect(result).toBeNull();
    expect(setParticipantIdCookie).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
