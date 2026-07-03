import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { isAxiosError } from "axios";
import { getEventByToken, getMyParticipant } from "../../../api/picnivo-api";
import {
  getParticipantIdCookie,
  setParticipantIdCookie,
} from "../../../lib/participant/cookie";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { eventByTokenSchema, tokenSchema } from "./schema";

export const getEventByTokenFn = createServerFn({ method: "GET" })
  .validator(eventByTokenSchema)
  .handler(async ({ data }) => {
    try {
      return await getEventByToken(data.token, {
        participantId: data.participantId ?? getParticipantIdCookie(data.token),
      });
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  });

// Resolves the request origin server-side so the share link is correct on
// first render — avoids depending on `window.location`, which would either
// mismatch during SSR hydration or require a post-mount effect.
export const getShareOriginFn = createServerFn({ method: "GET" }).handler(
  async () => getRequestUrl().origin,
);

// Resolves the effective participant id for a token, backfilling identity
// across devices for organizers. Fast path: an existing `pv_p` cookie (guests
// and returning organizers) short-circuits before any session read or network
// call. Slow path: a cookie-less authenticated organizer — resolve their id
// from their account via the Phase 1 endpoint, write the `pv_p` cookie so
// subsequent requests are cookie-fast, and return the id. Because a Set-Cookie
// header isn't readable in the same request, the caller must thread the
// returned id into `getEventByTokenFn` explicitly for it to affect this render.
//
// Guests, unauthenticated visitors, non-organizers (404), and any resolution
// failure all degrade to `null` — this public route must never throw here.
export const getMyParticipantIdFn = createServerFn({ method: "GET" })
  .validator(tokenSchema)
  .handler(async ({ data }): Promise<string | null> => {
    const cookieId = getParticipantIdCookie(data.token);
    if (cookieId) return cookieId;

    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) console.error("Supabase auth error:", error.message);
    if (!user) return null;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    try {
      const { participantId } = await getMyParticipant(data.token, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setParticipantIdCookie(data.token, participantId);
      return participantId;
    } catch (err) {
      // 404 is the normal "not the organizer" outcome; anything else is
      // logged but still degrades to no-identity so the page keeps rendering.
      if (!(isAxiosError(err) && err.response?.status === 404)) {
        console.error("Participant id resolution failed:", err);
      }
      return null;
    }
  });
