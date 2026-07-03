import { beforeEach, describe, expect, it, vi } from "vitest";

const getCookie = vi.fn();
const setCookie = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (...args: unknown[]) => getCookie(...args),
  setCookie: (...args: unknown[]) => setCookie(...args),
}));

import { getParticipantIdCookie, setParticipantIdCookie } from "./cookie";

describe("participant cookie", () => {
  beforeEach(() => {
    getCookie.mockReset();
    setCookie.mockReset();
  });

  it("reads the participant id namespaced by event token", () => {
    getCookie.mockReturnValue("p-1");

    const result = getParticipantIdCookie("tok1");

    expect(getCookie).toHaveBeenCalledWith("pv_p_tok1");
    expect(result).toBe("p-1");
  });

  it("returns undefined when no cookie is set", () => {
    getCookie.mockReturnValue(undefined);

    expect(getParticipantIdCookie("tok1")).toBeUndefined();
  });

  it("writes the participant id namespaced by event token with safe options", () => {
    setParticipantIdCookie("tok1", "p-1");

    expect(setCookie).toHaveBeenCalledWith(
      "pv_p_tok1",
      "p-1",
      expect.objectContaining({
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure: false,
      }),
    );
  });

  it("namespaces cookies independently per event token", () => {
    setParticipantIdCookie("tokA", "p-a");
    setParticipantIdCookie("tokB", "p-b");

    expect(setCookie).toHaveBeenNthCalledWith(
      1,
      "pv_p_tokA",
      "p-a",
      expect.anything(),
    );
    expect(setCookie).toHaveBeenNthCalledWith(
      2,
      "pv_p_tokB",
      "p-b",
      expect.anything(),
    );
  });
});
