import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { isAxiosError } from "axios";
import { getEventByToken } from "../../../api/picnivo-api";
import { getParticipantIdCookie } from "../../../lib/participant/cookie";
import { tokenSchema } from "./schema";

export const getEventByTokenFn = createServerFn({ method: "GET" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    try {
      return await getEventByToken(data.token, {
        participantId: getParticipantIdCookie(data.token),
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

// The `you` DTO deliberately omits the caller's own participant id (it only
// needs to answer "is this vote/claim mine?"). Removing an item you added
// needs the raw id to compare against `EventItemDto.addedByParticipantId`,
// so it's read from the same httpOnly cookie and threaded down separately.
export const getMyParticipantIdFn = createServerFn({ method: "GET" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => getParticipantIdCookie(data.token) ?? null);
