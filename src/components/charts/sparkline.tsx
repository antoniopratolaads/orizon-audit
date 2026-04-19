import { cn } from "@/lib/utils";

/**
 * Minimal inline-SVG sparkline — no dependencies.
 * Values are normalized to fit the viewport. Shows a stroked line
 * with an optional area fill underneath.
 */
export function Sparkline({
  values,
  width = 80,
  height = 24,
  className,
  stroke = "var(--primary)",
  fill = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  fill?: boolean;
}) {
  if (!values || values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={cn("text-muted-foreground", className)}
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeDasharray="2 3"
          strokeOpacity={0.4}
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");

  const areaPath = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
    >
      {fill && (
        <path
          d={areaPath}
          fill={stroke}
          opacity={0.12}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
