import { msg } from "@lingui/core/macro";

export const SITE_NAME = "Picnivo";

export const OG_CARD_PATH = "/og-card.png";
export const OG_CARD_WIDTH = 1200;
export const OG_CARD_HEIGHT = 630;

// These resolve through `i18n._()` at call sites rather than the `t`
// template macro — route `head()` functions run outside any component
// render, so `useLingui()` (and therefore `t`) is never in scope.
export const DEFAULT_DESCRIPTION = msg`Pick a date together, split what to bring, and share one link with the group.`;

export const OG_CARD_ALT = msg`Picnivo — plan the hang, together.`;

export const EVENT_CARD_FALLBACK = msg`Pick a date together on Picnivo.`;
