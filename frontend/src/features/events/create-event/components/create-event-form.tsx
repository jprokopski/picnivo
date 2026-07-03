import { useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { cn } from "@/lib/utils";
import { ClockIcon, HandIcon, LinkIcon, ShareIcon } from "lucide-react";
import { PicnicScene } from "@/components/picnic-scene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEventFn } from "../functions";
import { combineDateAndTime } from "../datetime";
import { DatePicker, type DateSelection } from "./date-picker";
import { ItemsEditor } from "./items-editor";
import { ShareLinkDialog } from "./share-link-dialog";

const TOTAL_STEPS = 3;

export function CreateEventForm() {
  const { t } = useLingui();
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [dateSelections, setDateSelections] = useState<DateSelection[]>([]);
  const [items, setItems] = useState<string[]>([]);

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stepValid = [title.trim().length > 0, dateSelections.length > 0, true];

  const canCreate =
    step === TOTAL_STEPS - 1 &&
    title.trim().length > 0 &&
    dateSelections.length > 0 &&
    !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;

    const dateOptions = dateSelections.map(({ date, time }) =>
      combineDateAndTime(date, time),
    );

    const now = new Date();
    if (dateOptions.some((iso) => new Date(iso) <= now)) {
      setSubmitError(
        t`One or more selected times are in the past. Please update the time.`,
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createEventFn({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          dateOptions,
          items,
        },
      });

      if (result.error || !result.token || !result.participantId) {
        setSubmitError(
          result.error ?? t`Something went wrong. Please try again.`,
        );
        return;
      }

      setShareToken(result.token);
    } catch {
      setSubmitError(t`Something went wrong. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(96, el.scrollHeight)}px`;
  }

  const basicsNode = (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="title" className="mb-1.5 block text-[13px] font-bold">
          <Trans>Event name</Trans>
        </Label>
        <Input
          id="title"
          value={title}
          placeholder={t`e.g. Sunset Beach Picnic`}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <Label
          htmlFor="location"
          className="mb-1.5 block text-[13px] font-bold"
        >
          <Trans>Where</Trans>
          <span className="text-muted-foreground ml-1.5 text-[13px] font-medium">
            · <Trans>optional</Trans>
          </span>
        </Label>
        <Input
          id="location"
          value={location}
          placeholder={t`Add a spot`}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div>
        <Label
          htmlFor="description"
          className="mb-1.5 block text-[13px] font-bold"
        >
          <Trans>A note</Trans>
          <span className="text-muted-foreground ml-1.5 text-[13px] font-medium">
            · <Trans>optional</Trans>
          </span>
        </Label>
        <Textarea
          id="description"
          ref={noteRef}
          value={description}
          placeholder={t`Set the vibe…`}
          rows={3}
          className="min-h-24 resize-none overflow-hidden"
          onChange={(e) => {
            setDescription(e.target.value);
            autoGrow(e.target);
          }}
        />
      </div>
    </div>
  );

  const datesNode = (
    <DatePicker selections={dateSelections} onChange={setDateSelections} />
  );

  const itemsNode = (
    <ItemsEditor
      items={items}
      onAdd={(label) => setItems((prev) => [...prev, label])}
      onRemove={(idx) => setItems((prev) => prev.filter((_, i) => i !== idx))}
    />
  );

  const stepsConfig = [
    {
      kicker: t`The basics`,
      title: t`What's the plan?`,
      node: basicsNode,
    },
    {
      kicker: t`Pick some days`,
      title: t`When could it happen?`,
      node: datesNode,
    },
    {
      kicker: t`Bring a little something`,
      title: t`What do we need?`,
      node: itemsNode,
    },
  ];

  return (
    <>
      <div className="mx-auto max-w-295 animate-[pv-fade_420ms_cubic-bezier(0.16,1,0.3,1)_both] pt-12 pr-[max(var(--web-gutter),env(safe-area-inset-right))] pb-24 pl-[max(var(--web-gutter),env(safe-area-inset-left))] max-[720px]:pt-7 max-[720px]:pb-16">
        {/* Page header */}
        <div className="mb-8.5 max-[720px]:mb-6">
          <p className="mb-2.5 font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
            <Trans>New event</Trans>
          </p>
          <h1 className="font-display text-foreground m-0 text-[46px] leading-[1.02] font-extrabold tracking-tight text-balance max-[900px]:text-[40px] max-[720px]:text-[32px] max-[480px]:text-[28px] max-[360px]:text-[26px]">
            <Trans>Plan something good.</Trans>
          </h1>
          <p className="text-muted-foreground m-0 mt-3 max-w-[56ch] text-[17px] leading-normal max-[720px]:mt-2.5 max-[720px]:text-[15.5px]">
            <Trans>
              Set it up once, share one link, and watch the date, the food, and
              the guest list fill themselves in.
            </Trans>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-[1.45fr_1fr] items-start gap-10 max-[900px]:grid-cols-1 max-[900px]:gap-6">
            {/* Form card — stepped wizard */}
            <div className="border-border bg-card flex min-w-0 flex-col gap-1 rounded-(--r-lg) border px-7 py-6.5 shadow-(--sh-md) max-[720px]:px-5 max-[720px]:py-5.5">
              {/* Progress dots + step counter */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {stepsConfig.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.75 rounded-full transition-all duration-220 ease-in-out",
                        i === step
                          ? "bg-primary w-5.5"
                          : i < step
                            ? "bg-primary w-1.75"
                            : "bg-border w-1.75",
                      )}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground font-mono text-[13px]">
                  <Trans>
                    Step {step + 1} of {TOTAL_STEPS}
                  </Trans>
                </span>
              </div>

              {/* Animated step content */}
              <div key={step} className="animate-[pv-fade_300ms_ease_both]">
                <p className="mb-1.25 font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
                  {stepsConfig[step].kicker}
                </p>
                <h2 className="font-display m-0 mb-5 text-2xl font-bold tracking-[-0.01em]">
                  {stepsConfig[step].title}
                </h2>
                {stepsConfig[step].node}
              </div>

              {/* Navigation buttons */}
              <div className="mt-7 flex items-center gap-3">
                {step > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((s) => s - 1)}
                  >
                    <Trans>Back</Trans>
                  </Button>
                )}

                {step < TOTAL_STEPS - 1 ? (
                  <Button
                    key="continue"
                    type="button"
                    disabled={!stepValid[step]}
                    onClick={() => setStep((s) => s + 1)}
                    className="ml-auto"
                  >
                    <Trans>Continue</Trans>
                  </Button>
                ) : (
                  <Button
                    key="submit"
                    type="submit"
                    disabled={!canCreate}
                    className="ml-auto gap-2"
                  >
                    <ShareIcon className="h-4 w-4" />
                    {isSubmitting ? (
                      <Trans>Creating…</Trans>
                    ) : (
                      <Trans>Create &amp; get link</Trans>
                    )}
                  </Button>
                )}
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="text-destructive mt-2 text-center text-xs"
                >
                  {submitError}
                </p>
              )}
            </div>

            {/* Aside — live preview */}
            <aside className="sticky top-24.5 flex min-w-0 flex-col gap-4 max-[900px]:static">
              <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
                <Trans>Live preview</Trans>
              </p>
              <PreviewCard
                title={title}
                location={location}
                description={description}
                dateCount={dateSelections.length}
                itemCount={items.length}
              />
              <p className="text-muted-foreground text-center text-xs">
                <Trans>
                  No account needed for guests — they just open the link.
                </Trans>
              </p>
            </aside>
          </div>
        </form>
      </div>

      {shareToken && (
        <ShareLinkDialog
          token={shareToken}
          onClose={() => setShareToken(null)}
          onOpenEvent={() => {
            window.open(`/e/${shareToken}`, "_blank");
          }}
        />
      )}
    </>
  );
}

interface PreviewCardProps {
  title: string;
  location: string;
  description: string;
  dateCount: number;
  itemCount: number;
}

function PreviewCard({
  title,
  location,
  description,
  dateCount,
  itemCount,
}: PreviewCardProps) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-(--r-md) border p-0 shadow-(--sh-md)">
      <div className="relative h-40 overflow-hidden bg-[linear-gradient(180deg,#ffd58a_0%,#ff9d6b_40%,#f1633f_78%,#e0492a_100%)]">
        <PicnicScene variant="sunset" slot="card" />
      </div>

      {/* Accent bar */}
      <div className="bg-primary h-1.25 shrink-0" />

      {/* Content */}
      <div className="px-5 pt-4.5 pb-5">
        <p className="mb-1 overflow-hidden font-mono text-[11px] font-medium tracking-[0.14em] text-ellipsis whitespace-nowrap text-(--accent-deep) uppercase">
          {location || "To be defined"}
        </p>
        <h3 className="font-display m-0 text-[21px] font-bold tracking-[-0.01em] wrap-break-word">
          {title || (
            <span className="text-muted-foreground font-normal">
              <Trans>Untitled event</Trans>
            </span>
          )}
        </h3>
        {description && (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-[13px] wrap-break-word">
            {description}
          </p>
        )}
        <div className="mt-3.5 flex gap-2.5">
          <span className="border-border bg-card text-foreground inline-flex items-center gap-1.5 rounded-full border px-3.25 py-1.75 text-[13px] font-semibold">
            <ClockIcon size={14} color="var(--ink-soft)" />
            <Trans>{dateCount} dates</Trans>
          </span>
          <span className="border-border bg-card text-foreground inline-flex items-center gap-1.5 rounded-full border px-3.25 py-1.75 text-[13px] font-semibold">
            <HandIcon size={14} color="var(--ink-soft)" />
            <Trans>{itemCount} items</Trans>
          </span>
        </div>
        <div className="border-border mt-4 flex items-center gap-2 rounded-(--r-sm) border-[1.5px] border-dashed bg-(--card-2) px-3.5 py-2.75">
          <LinkIcon size={18} color="var(--accent-deep)" />
          <span className="flex-1 font-mono text-[13.5px]">
            picnivo.com/e/••••••
          </span>
        </div>
      </div>
    </div>
  );
}
