import { useState, type ReactNode } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "../utils/cn";

/** A collapsible group of settings. */
export function Section({
  title,
  hint,
  defaultOpen = false,
  onReset,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  onReset?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{title}</span>
          {hint && <span className="block truncate text-xs text-white/40">{hint}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/40 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-white/5 px-4 pb-5 pt-4">
          {children}
          {onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-2 text-xs font-medium text-white/40 active:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Label({ label, value, hint }: { label: string; value?: string; hint?: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-white/80">{label}</span>
        {value !== undefined && <span className="text-xs tabular-nums text-fuchsia-300">{value}</span>}
      </div>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-white/35">{hint}</p>}
    </div>
  );
}

export function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const shown = format ? format(value) : String(value);
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <Label label={label} value={shown} hint={hint} />
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider h-1 w-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, #e879f9 ${fill}%, rgba(255,255,255,0.12) ${fill}%)`,
        }}
      />
    </div>
  );
}

/** A whole number typed in; `special` names a value ("0 = automatic"). */
export function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label label={label} hint={hint} />
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        onChange={(e) => {
          const next = e.target.value === "" ? NaN : Number(e.target.value);
          if (Number.isNaN(next)) return;
          const low = min ?? -Infinity;
          const high = max ?? Infinity;
          onChange(Math.min(high, Math.max(low, Math.round(next))));
        }}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400/50"
      />
    </div>
  );
}

export function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="flex w-full items-center gap-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-white/80">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-white/35">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          value ? "bg-fuchsia-500" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
            value ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** A choice between a few values, as buttons. */
export function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <Label label={label} hint={hint} />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              option.value === value
                ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-200"
                : "border-white/10 text-white/60 active:bg-white/10",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TextField({
  label,
  hint,
  value,
  placeholder,
  rows,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  const className =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-fuchsia-400/50";
  return (
    <div>
      <Label label={label} hint={hint} />
      {rows ? (
        <textarea
          aria-label={label}
          dir="auto"
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(className, "resize-none")}
        />
      ) : (
        <input
          aria-label={label}
          dir="auto"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      )}
    </div>
  );
}
