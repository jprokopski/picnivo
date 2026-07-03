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
