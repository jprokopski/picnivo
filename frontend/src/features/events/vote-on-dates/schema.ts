import { z } from "zod";
import type { VoteChoice } from "@/api/picnivo-api";

export type VoteChoiceKey = "yes" | "maybe" | "no";

export const VOTE_ORDER: VoteChoiceKey[] = ["yes", "maybe", "no"];

export const VOTE_CHOICE_VALUES: Record<VoteChoiceKey, VoteChoice> = {
  yes: 1,
  maybe: 2,
  no: 3,
};

export function voteChoiceKeyFromValue(
  value: VoteChoice | undefined,
): VoteChoiceKey | undefined {
  return VOTE_ORDER.find((key) => VOTE_CHOICE_VALUES[key] === value);
}

export const VOTE_META: Record<
  VoteChoiceKey,
  { color: string; tint: string; emoji: string }
> = {
  yes: { color: "var(--yes)", tint: "var(--yes-tint)", emoji: "🙌" },
  maybe: { color: "var(--maybe)", tint: "var(--maybe-tint)", emoji: "🤔" },
  no: { color: "var(--no)", tint: "var(--no-tint)", emoji: "🙅" },
};

export const castVoteSchema = z.object({
  token: z.string().min(1),
  votes: z
    .array(
      z.object({
        dateOptionId: z.string().min(1),
        choice: z.enum(VOTE_ORDER as [VoteChoiceKey, ...VoteChoiceKey[]]),
      }),
    )
    .min(1),
});

export type CastVoteInput = z.infer<typeof castVoteSchema>;
