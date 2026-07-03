import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  kicker: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  kicker,
  title,
  right,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "border-border bg-card rounded-(--r-lg) border px-7 py-6.5 shadow-(--sh-md) max-[720px]:px-5 max-[720px]:py-5.5",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase">
            {kicker}
          </p>
          <h3 className="m-0 mt-1 font-display text-[21px] font-bold tracking-[-0.01em]">
            {title}
          </h3>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
