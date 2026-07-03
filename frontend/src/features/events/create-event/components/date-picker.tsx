import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { CalendarIcon, CheckIcon, ClockIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime12h } from "../datetime";

export const MAX_DATES = 10;

export interface DateSelection {
  date: Date;
  time: string; // HH:MM 24h
}

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PRESET_TIMES = [
  { label: "3:00 PM", value: "15:00" },
  { label: "3:30 PM", value: "15:30" },
  { label: "4:00 PM", value: "16:00" },
  { label: "4:30 PM", value: "16:30" },
  { label: "5:00 PM", value: "17:00" },
  { label: "5:30 PM", value: "17:30" },
  { label: "6:00 PM", value: "18:00" },
];

const DEFAULT_TIME = "16:30";

interface DateInfo {
  id: string;
  dow: string;
  day: string;
  mon: string;
  date: Date;
}

function dateId(dt: Date): string {
  return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
}

function toDateInfo(dt: Date): DateInfo {
  return {
    id: dateId(dt),
    dow: DOW_SHORT[dt.getDay()],
    day: String(dt.getDate()),
    mon: MON_SHORT[dt.getMonth()],
    date: new Date(dt),
  };
}

function generatePool(): DateInfo[] {
  const pool: DateInfo[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cur = new Date(today);
  cur.setDate(cur.getDate() + 1);
  for (let i = 0; i < 3; i++) {
    pool.push(toDateInfo(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return pool;
}

const DATE_POOL = generatePool();

// ---- Date Tile ----

interface DateTileProps {
  info: DateInfo;
  selected: boolean;
  time?: string;
  editable?: boolean;
  onToggle: () => void;
  onTime?: (time: string) => void;
}

function DateTile({
  info,
  selected,
  time,
  editable,
  onToggle,
  onTime,
}: DateTileProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  return (
    <div
      className={cn(
        "relative cursor-pointer rounded-(--r-md) px-3.75 py-3.5 transition-all duration-160 ease-in-out",
        selected
          ? "border-primary bg-accent border-2 shadow-none"
          : "border-border bg-card border-[1.5px] shadow-(--sh-sm)",
      )}
    >
      <div className="flex items-center justify-between" onClick={onToggle}>
        <div className="flex items-center gap-3">
          {/* Compact date stamp */}
          <div className="shrink-0 text-center leading-none">
            <div className="font-mono text-[10px] tracking-[0.08em] text-(--accent-deep) uppercase">
              {info.dow}
            </div>
            <div className="my-0.5 font-display text-2xl leading-[1.02] font-extrabold tracking-tight text-balance text-foreground">
              {info.day}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {info.mon}
            </div>
          </div>

          {/* Label + time chip */}
          <div>
            <div className="text-[15px] font-bold text-foreground">
              {info.dow}, {info.mon} {info.day}
            </div>
            {selected && editable && time && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTimePicker((v) => !v);
                }}
                className="mt-1.75 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground"
              >
                <ClockIcon size={12} />
                {formatTime12h(time)}
              </button>
            )}
          </div>
        </div>

        {/* Toggle indicator — acts as "Remove date" button when selected */}
        {selected ? (
          <button
            type="button"
            aria-label="Remove date"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-primary p-0"
          >
            <CheckIcon size={15} color="#fff" />
          </button>
        ) : (
          <div className="size-6 shrink-0 rounded-full border-2 border-border" />
        )}
      </div>

      {/* Time picker panel */}
      {showTimePicker && selected && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2.75 border-t border-border pt-2.75"
        >
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TIMES.map((pt) => (
              <button
                key={pt.value}
                type="button"
                onClick={() => {
                  onTime?.(pt.value);
                  setCustomMode(false);
                  setShowTimePicker(false);
                }}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.75 py-1.5 text-xs font-semibold",
                  time === pt.value
                    ? "border-primary bg-primary text-white"
                    : "border-border text-foreground bg-(--card-2)",
                )}
              >
                {pt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCustomMode((v) => !v);
              }}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-2.75 py-1.5 text-xs font-semibold",
                customMode
                  ? "border-primary bg-primary text-white"
                  : "border-border text-foreground bg-(--card-2)",
              )}
            >
              <ClockIcon size={13} /> <Trans>Custom</Trans>
            </button>
          </div>
          {customMode && (
            <div className="mt-2.5">
              <input
                type="time"
                value={time}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  if (e.target.value) onTime?.(e.target.value);
                }}
                className="rounded-(--r-sm) border-[1.5px] border-border bg-card px-3 py-2 font-mono text-[13px] text-foreground"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Mini inline calendar for custom dates ----

interface CustomDatePickerProps {
  selectedIds: Set<string>;
  onPick: (info: DateInfo, time: string) => void;
}

function CustomDatePicker({ selectedIds, onPick }: CustomDatePickerProps) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date | null>(null);
  const [time, setTime] = useState(DEFAULT_TIME);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [view, setView] = useState({
    y: today.getFullYear(),
    m: today.getMonth(),
  });

  const firstDay = new Date(view.y, view.m, 1);
  const leadDays = firstDay.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadDays; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(new Date(view.y, view.m, d));

  const atMin = view.y === today.getFullYear() && view.m === today.getMonth();

  const shift = (n: number) =>
    setView((v) => {
      const nm = v.m + n;
      return { y: v.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });

  const pendingId = pending ? dateId(pending) : null;

  const commit = () => {
    if (pending) {
      onPick(toDateInfo(pending), time);
      setPending(null);
      setOpen(false);
    }
  };

  const close = () => {
    setOpen(false);
    setPending(null);
  };

  return (
    <div className="mt-4.5">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "bg-card inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3.5 py-2.25 text-[13px] font-semibold",
          open
            ? "border-primary text-(--accent-deep)"
            : "border-border text-foreground",
        )}
      >
        <CalendarIcon size={15} />
        <Trans>Pick a custom date</Trans>
      </button>

      {open && (
        <div className="mt-3 max-w-80 rounded-(--r-md) border-[1.5px] border-border bg-card p-4 shadow-(--sh-md)">
          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => !atMin && shift(-1)}
              disabled={atMin}
              aria-label={t`Previous month`}
              className={cn(
                "border-border bg-card flex size-7.5 shrink-0 items-center justify-center rounded-(--r-sm) border-[1.5px]",
                atMin ? "cursor-default opacity-40" : "cursor-pointer",
              )}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path
                  d="M12 5l-5 5 5 5"
                  stroke="var(--ink-soft)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="text-[15px] font-bold text-foreground">
              {MON_SHORT[view.m]} {view.y}
            </div>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label={t`Next month`}
              className="flex size-7.5 shrink-0 cursor-pointer items-center justify-center rounded-(--r-sm) border-[1.5px] border-border bg-card"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path
                  d="M8 5l5 5-5 5"
                  stroke="var(--ink-soft)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers + date grid */}
          <div className="grid grid-cols-7 gap-1">
            {DOW_SHORT.map((w) => (
              <div
                key={w}
                className="py-0.5 text-center font-mono text-[10px] text-(--ink-faint)"
              >
                {w[0]}
              </div>
            ))}
            {cells.map((dt, i) => {
              if (!dt) return <div key={`e${i}`} />;
              const past = dt < today;
              const already = selectedIds.has(dateId(dt));
              const isPending = pendingId === dateId(dt);
              const isToday = dt.getTime() === today.getTime();
              const hi = already || isPending;
              return (
                <button
                  key={dateId(dt)}
                  type="button"
                  disabled={past || already}
                  onClick={() => setPending(dt)}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-(--r-sm) border-[1.5px] text-[13px]",
                    hi ? "font-bold" : "font-medium",
                    isToday && !hi ? "border-border" : "border-transparent",
                    isPending
                      ? "bg-primary"
                      : already
                        ? "bg-accent"
                        : "bg-transparent",
                    isPending
                      ? "text-white"
                      : already
                        ? "text-(--accent-deep)"
                        : past
                          ? "text-(--ink-faint)"
                          : "text-foreground",
                    past || already ? "cursor-default" : "cursor-pointer",
                    past && "opacity-45",
                  )}
                >
                  {dt.getDate()}
                </button>
              );
            })}
          </div>

          {/* Pending date — pick a time and confirm */}
          {pending && (
            <div className="mt-3.5 border-t border-border pt-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="text-sm font-bold text-foreground">
                  {DOW_SHORT[pending.getDay()]}, {MON_SHORT[pending.getMonth()]}{" "}
                  {pending.getDate()}
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-xs font-semibold text-(--accent-deep)">
                  <ClockIcon size={12} />
                  {formatTime12h(time)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_TIMES.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setTime(pt.value)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.75 py-1.5 text-xs font-semibold",
                      time === pt.value
                        ? "border-primary bg-primary text-white"
                        : "border-border text-foreground bg-(--card-2)",
                    )}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>

              <div className="mt-2.5 flex gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => {
                    if (e.target.value) setTime(e.target.value);
                  }}
                  className="rounded-(--r-sm) border-[1.5px] border-border bg-card px-3 py-2 font-mono text-[13px] text-foreground"
                />
                <button
                  type="button"
                  onClick={commit}
                  className="inline-flex flex-1 cursor-pointer appearance-none items-center justify-center gap-2.25 rounded-full border-0 bg-primary px-4 py-2.5 font-sans text-[13px] leading-none font-bold whitespace-nowrap text-white shadow-(--sh-pop) transition-[transform,box-shadow,background] duration-160 hover:-translate-y-0.5 hover:bg-(--accent-deep) active:translate-y-0"
                >
                  <PlusIcon size={14} />
                  <Trans>Add this date</Trans>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main DatePicker ----

interface DatePickerProps {
  selections: DateSelection[];
  onChange: (selections: DateSelection[]) => void;
}

export function DatePicker({ selections, onChange }: DatePickerProps) {
  const { t } = useLingui();

  const selectedIds = new Set(selections.map((s) => dateId(s.date)));
  const availablePool = DATE_POOL.filter((d) => !selectedIds.has(d.id));

  function getInfo(sel: DateSelection): DateInfo {
    return (
      DATE_POOL.find((d) => d.id === dateId(sel.date)) ?? toDateInfo(sel.date)
    );
  }

  function toggle(info: DateInfo) {
    if (selectedIds.has(info.id)) {
      onChange(selections.filter((s) => dateId(s.date) !== info.id));
    } else {
      if (selections.length >= MAX_DATES) return;
      onChange([...selections, { date: info.date, time: DEFAULT_TIME }]);
    }
  }

  function setTime(id: string, time: string) {
    onChange(
      selections.map((s) => (dateId(s.date) === id ? { ...s, time } : s)),
    );
  }

  function addCustom(info: DateInfo, time: string) {
    if (selectedIds.has(info.id) || selections.length >= MAX_DATES) return;
    onChange([...selections, { date: info.date, time }]);
  }

  const count = selections.length;
  const hint =
    count === 0
      ? t`Pick at least one day to continue.`
      : count === 1
        ? t`With one date this is an announcement — add more to open voting.`
        : t`${count} days proposed · friends vote Yes / Maybe / No`;

  return (
    <div>
      {/* Selected dates */}
      {selections.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5">
          {selections.map((sel) => {
            const info = getInfo(sel);
            return (
              <DateTile
                key={info.id}
                info={info}
                selected
                editable
                time={sel.time}
                onToggle={() => toggle(info)}
                onTime={(tm) => setTime(info.id, tm)}
              />
            );
          })}
        </div>
      )}

      {/* Unselected pool */}
      {availablePool.length > 0 && (
        <>
          <p
            className={cn(
              "mb-2.5 font-mono text-[11px] font-medium tracking-[0.14em] text-(--accent-deep) uppercase",
              selections.length > 0 ? "mt-4.5" : "mt-0",
            )}
          >
            {selections.length > 0 ? (
              <Trans>Add more days</Trans>
            ) : (
              <Trans>Suggested days</Trans>
            )}
          </p>
          <div className="grid grid-cols-1 gap-2.5">
            {availablePool.map((info) => (
              <DateTile
                key={info.id}
                info={info}
                selected={false}
                onToggle={() => {
                  if (selections.length < MAX_DATES) toggle(info);
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Custom date picker */}
      {selections.length < MAX_DATES && (
        <CustomDatePicker selectedIds={selectedIds} onPick={addCustom} />
      )}

      {/* Hint */}
      <p
        className={cn(
          "mt-3.5 text-[13px] leading-normal",
          count === 0
            ? "text-muted-foreground font-normal"
            : "font-semibold text-(--accent-deep)",
        )}
      >
        {hint}
      </p>
    </div>
  );
}
