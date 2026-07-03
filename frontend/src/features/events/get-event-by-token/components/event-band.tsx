import { Trans } from "@lingui/react/macro";
import { PicnicScene } from "@/components/picnic-scene";

interface EventBandProps {
  title: string;
  description?: string | null;
  organizerName: string;
  location?: string | null;
  goingCount: number;
  claimedCount: number;
  itemCount: number;
}

export function EventBand({
  title,
  description,
  organizerName,
  location,
  goingCount,
  claimedCount,
  itemCount,
}: EventBandProps) {
  return (
    <div className="mb-7 overflow-hidden rounded-(--r-xl) shadow-(--sh-lg) max-[720px]:mb-5.5 max-[720px]:rounded-(--r-lg)">
      <div className="relative h-57.5 overflow-hidden bg-[linear-gradient(180deg,#ffd58a_0%,#ff9d6b_38%,#f1633f_74%,#e0492a_100%)] max-[720px]:h-37.5">
        <PicnicScene variant="sunset" slot="wide" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6 bg-card px-8.5 pt-6 pb-6.5 max-[720px]:gap-4 max-[720px]:px-5.5 max-[720px]:pt-5.5 max-[720px]:pb-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium tracking-[0.14em] wrap-anywhere text-(--accent-deep) uppercase">
            <Trans>{organizerName} is hosting</Trans>
            {location && <> · {location}</>}
          </p>
          <h1 className="m-0 mt-1.5 font-display text-[38px] leading-[1.05] font-extrabold tracking-tight wrap-break-word text-foreground max-[900px]:text-[32px] max-[720px]:text-[27px]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-[54ch] wrap-break-word text-muted-foreground max-[720px]:text-[15px]">
              {description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-6.5">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[26px] leading-none font-extrabold max-[720px]:text-[22px]">
              {goingCount}
            </span>
            <span className="text-[12px] font-semibold text-(--ink-soft)">
              <Trans>going</Trans>
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[26px] leading-none font-extrabold max-[720px]:text-[22px]">
              {claimedCount}/{itemCount}
            </span>
            <span className="text-[12px] font-semibold text-(--ink-soft)">
              <Trans>items</Trans>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
