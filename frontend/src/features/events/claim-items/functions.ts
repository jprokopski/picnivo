import { createServerFn } from "@tanstack/react-start";
import axios from "axios";
import {
  addItem,
  claimItem,
  releaseClaim,
  removeItem,
} from "../../../api/picnivo-api";
import { getParticipantIdCookie } from "../../../lib/participant/cookie";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { addItemSchema, itemActionSchema } from "./schema";

function detailOf(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data?.detail as string | undefined) ?? err.message;
  }
  throw err;
}

export const claimItemFn = createServerFn({ method: "POST" })
  .inputValidator(itemActionSchema)
  .handler(async ({ data }) => {
    const participantId = getParticipantIdCookie(data.token);
    if (!participantId) {
      return { error: "Join the event first." };
    }
    try {
      await claimItem(data.token, data.itemId, { participantId });
      return { error: null };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          return { error: "Someone already claimed that." };
        }
        if (err.response?.status === 403) {
          return { error: "Confirm you're coming before claiming an item." };
        }
      }
      return { error: detailOf(err) };
    }
  });

export const releaseClaimFn = createServerFn({ method: "POST" })
  .inputValidator(itemActionSchema)
  .handler(async ({ data }) => {
    const participantId = getParticipantIdCookie(data.token);
    if (!participantId) {
      return { error: "Join the event first." };
    }
    try {
      await releaseClaim(data.token, data.itemId, { participantId });
      return { error: null };
    } catch (err) {
      return { error: detailOf(err) };
    }
  });

export const addItemFn = createServerFn({ method: "POST" })
  .inputValidator(addItemSchema)
  .handler(async ({ data }) => {
    const participantId = getParticipantIdCookie(data.token);
    if (!participantId) {
      return { error: "Join the event first." };
    }
    try {
      await addItem(data.token, { participantId, label: data.label });
      return { error: null };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          return { error: "That's already on the list." };
        }
        if (err.response?.status === 400) {
          return { error: "The list is full." };
        }
      }
      return { error: detailOf(err) };
    }
  });

export const removeItemFn = createServerFn({ method: "POST" })
  .inputValidator(itemActionSchema)
  .handler(async ({ data }) => {
    const participantId = getParticipantIdCookie(data.token);
    if (!participantId) {
      return { error: "Join the event first." };
    }
    // Removal is authorized either as the item's adder (via participantId) or
    // as the event's organizer (via the JWT) — attach the session token when
    // one exists so the backend can check the organizer branch too.
    const {
      data: { session },
    } = await createSupabaseServerClient().auth.getSession();
    try {
      await removeItem(
        data.token,
        data.itemId,
        { participantId },
        session
          ? { headers: { Authorization: `Bearer ${session.access_token}` } }
          : undefined,
      );
      return { error: null };
    } catch (err) {
      return { error: detailOf(err) };
    }
  });
