import { Minus, Plus } from "lucide-react";

import { ArcadeButton } from "./ArcadeButton";

export function AttributeRow({
  label,
  hint,
  value,
  max = 5,
  canIncrease,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  max?: number;
  canIncrease: boolean;
  onChange: (delta: number) => void;
}) {
  return (
    <div className="rounded-sm border border-neon/25 bg-card/40 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="font-arcade text-[9px] uppercase leading-relaxed text-foreground">
            {label}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-neon/60">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ArcadeButton
            tone="purple"
            aria-label={`Diminuir ${label}`}
            disabled={value <= 0}
            onClick={() => onChange(-1)}
            className="grid h-11 w-11 place-items-center"
          >
            <Minus className="h-4 w-4" />
          </ArcadeButton>
          <span className="font-arcade w-6 text-center text-sm text-whisky text-glow">{value}</span>
          <ArcadeButton
            aria-label={`Aumentar ${label}`}
            disabled={!canIncrease || value >= max}
            onClick={() => onChange(1)}
            className="grid h-11 w-11 place-items-center"
          >
            <Plus className="h-4 w-4" />
          </ArcadeButton>
        </div>
      </div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-sm ${
              i < value ? "bg-neon shadow-[0_0_6px_var(--neon)]" : "bg-input"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
