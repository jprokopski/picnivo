import { getCookie, setCookie } from "@tanstack/react-start/server";

const COOKIE_PREFIX = "pv_p_";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 400; // 400 days — Chrome's cookie cap

function cookieName(eventToken: string): string {
  return COOKIE_PREFIX + eventToken;
}

export function getParticipantIdCookie(eventToken: string): string | undefined {
  return getCookie(cookieName(eventToken));
}

export function setParticipantIdCookie(
  eventToken: string,
  participantId: string,
): void {
  setCookie(cookieName(eventToken), participantId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: import.meta.env.PROD,
    maxAge: MAX_AGE_SECONDS,
  });
}
