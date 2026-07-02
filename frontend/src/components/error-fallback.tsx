import { Trans } from "@lingui/react/macro";
import { useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";

export function ErrorFallback({ reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-295 flex-col items-center gap-4 px-[max(var(--web-gutter),env(safe-area-inset-right))] py-24 text-center">
      <h1 className="font-display text-2xl font-bold">
        <Trans>Something went wrong.</Trans>
      </h1>
      <p className="text-muted-foreground">
        <Trans>Please try again in a moment.</Trans>
      </p>
      <button
        type="button"
        onClick={() => {
          reset();
          router.invalidate();
        }}
        className="bg-primary mt-1 inline-flex cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 px-4 py-2.5 font-sans text-[14px] leading-none font-bold whitespace-nowrap text-white no-underline shadow-(--sh-pop) transition-[transform,box-shadow,background] duration-160 hover:-translate-y-0.5 hover:bg-(--accent-deep) active:translate-y-0"
      >
        <Trans>Try again</Trans>
      </button>
    </div>
  );
}
