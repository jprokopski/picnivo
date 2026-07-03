import { createServerFn } from "@tanstack/react-start";
import axios from "axios";
import { castVotes } from "../../../api/picnivo-api";
import { getParticipantIdCookie } from "../../../lib/participant/cookie";
import { castVoteSchema, VOTE_CHOICE_VALUES } from "./schema";

export const castVotesFn = createServerFn({ method: "POST" })
  .validator(castVoteSchema)
  .handler(async ({ data }) => {
    const participantId = getParticipantIdCookie(data.token);
    if (!participantId) {
      return { error: "Join the event before voting." };
    }
    try {
      await castVotes(data.token, participantId, {
        votes: data.votes.map((v) => ({
          dateOptionId: v.dateOptionId,
          choice: VOTE_CHOICE_VALUES[v.choice],
        })),
      });
      return { error: null };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail ?? err.message;
        return { error: detail as string };
      }
      throw err;
    }
  });
