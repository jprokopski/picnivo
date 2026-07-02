import { Trans } from "@lingui/react/macro";
import Logo from "./logo";

export default function Footer() {
  return (
    <footer className="border-t border-(--line) bg-[rgba(244,232,214,0.5)]">
      <div className="mx-auto flex max-w-295 flex-wrap items-center justify-between gap-4 py-7.5 pr-[max(var(--web-gutter),env(safe-area-inset-right))] pl-[max(var(--web-gutter),env(safe-area-inset-left))] max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-2.5">
        <Logo size={16} />
        <span className="m-0 text-[13px] leading-normal text-(--ink-soft)">
          <Trans>
            From scattered group chat to a ready-to-go plan — on one shared
            page.
          </Trans>
        </span>
        <span className="font-mono text-[13px] text-(--ink-faint)">
          <Trans>Picnivo · prototype</Trans>
        </span>
      </div>
    </footer>
  );
}
