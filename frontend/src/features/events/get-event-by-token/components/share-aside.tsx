import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "./section-card";

interface ShareAsideProps {
  shareUrl: string;
}

export function ShareAside({ shareUrl }: ShareAsideProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the link is still visible for manual copy.
    }
  }

  return (
    <SectionCard
      kicker={<Trans>Spread the word</Trans>}
      title={<Trans>Invite more friends</Trans>}
    >
      <div className="mb-3 flex items-center gap-2 rounded-(--r-sm) border-[1.5px] border-dashed border-(--line) bg-(--card-2) px-3.5 py-2.75">
        <LinkIcon size={17} color="var(--accent-deep)" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
          {shareUrl}
        </span>
      </div>
      <Button
        variant={copied ? "default" : "outline"}
        className="w-full gap-2"
        onClick={() => void handleCopy()}
      >
        {copied ? (
          <>
            <CheckIcon className="h-4 w-4" />
            <Trans>Copied!</Trans>
          </>
        ) : (
          <>
            <CopyIcon className="h-4 w-4" />
            <Trans>Copy invite link</Trans>
          </>
        )}
      </Button>
    </SectionCard>
  );
}
