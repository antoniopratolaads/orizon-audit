import { cn } from "@/lib/utils";

type Slice = { label: string; value: number; color: string };

/**
 * Minimal inline-SVG donut chart — no dependencies.
 */
export function DonutMini({
  slices,
  size = 96,
  strokeWidth = 10,
  centerLabel,
  centerValue,
  className,
}: {
  slices: Slice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            slices.map((s) => {
              const frac = s.value / total;
              const dash = frac * circumference;
              const gap = circumference - dash;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return el;
            })}
        </svg>
        {(centerLabel || centerValue !== undefined) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue !== undefined && (
              <div className="font-display text-xl leading-none tabular-nums">
                {centerValue}
              </div>
            )}
            {centerLabel && (
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {centerLabel}
              </div>
            )}
          </div>
        )}
      </div>
      {slices.length > 0 && (
        <ul className="space-y-1.5 text-xs">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="ml-auto font-mono tabular-nums">
                {s.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
