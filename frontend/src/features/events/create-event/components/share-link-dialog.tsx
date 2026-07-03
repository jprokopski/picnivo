import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { CheckIcon, CopyIcon, ExternalLinkIcon, LinkIcon } from "lucide-react";
import { PicnicScene } from "@/components/picnic-scene";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShareLinkDialogProps {
  token: string;
  onClose: () => void;
  onOpenEvent: () => void;
}

export function ShareLinkDialog({
  token,
  onClose,
  onOpenEvent,
}: ShareLinkDialogProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/e/${token}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — URL is still visible for manual copy.
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-(--r-xl) border-0 bg-card p-0 shadow-(--sh-lg) sm:max-w-md">
        {/* Cover scene */}
        <div className="relative h-33 overflow-hidden bg-[linear-gradient(180deg,#ffd58a_0%,#ff9d6b_40%,#f1633f_78%,#e0492a_100%)]">
          <PicnicScene variant="sunset" slot="card" />
        </div>

        {/* Accent bar */}
        <div className="h-1.25 shrink-0 bg-primary" />

        {/* Body */}
        <div className="min-w-0 px-7.5 pt-6.5 pb-7.5 text-center max-[720px]:px-5.5">
          {/* Floating success circle */}
          <div className="relative mx-auto -mt-14 mb-3.5 flex size-15 items-center justify-center rounded-full border-3 border-card bg-[radial-gradient(circle_at_40%_35%,#d9f0e0,var(--yes)_60%,#2f7d4d)] shadow-[0_10px_30px_rgba(63,158,99,0.5)]">
            <CheckIcon size={28} color="#fff" />
          </div>

          <DialogHeader>
            <DialogTitle className="m-0 text-center font-display text-[26px] leading-[1.02] font-extrabold tracking-tight text-balance text-foreground">
              <Trans>Your picnic is live!</Trans>
            </DialogTitle>
          </DialogHeader>

          <p className="mt-2 text-sm text-muted-foreground">
            <Trans>
              Share this link with the group. They vote and claim items — no
              app, no login.
            </Trans>
          </p>

          {/* URL row */}
          <div
            data-testid="share-url-box"
            className="mt-5 flex items-center gap-2 rounded-(--r-sm) border-[1.5px] border-dashed border-border bg-(--card-2) px-4 py-3.25"
          >
            <LinkIcon
              size={18}
              color="var(--accent-deep)"
              className="shrink-0"
            />
            <span className="min-w-0 flex-1 truncate text-left font-mono text-[14.5px]">
              {shareUrl}
            </span>
          </div>

          {/* Actions */}
          <div className="mt-3.5 flex gap-2.5 max-[720px]:flex-col">
            <Button
              variant={copied ? "default" : "outline"}
              className="flex-1 gap-2 max-[720px]:w-full"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <CheckIcon className="size-4" />
                  <Trans>Copied!</Trans>
                </>
              ) : (
                <>
                  <CopyIcon className="size-4" />
                  <Trans>Copy link</Trans>
                </>
              )}
            </Button>
            <Button
              className="flex-1 gap-2 max-[720px]:w-full"
              onClick={onOpenEvent}
            >
              <Trans>Open event page</Trans>
              <ExternalLinkIcon className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
