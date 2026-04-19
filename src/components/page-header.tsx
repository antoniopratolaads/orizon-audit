import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col items-start justify-between gap-3 md:mb-6 md:flex-row md:items-center",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="font-display text-3xl leading-[1.05] md:text-[2rem]">
          {title}
        </h1>
        {description &&
          (typeof description === "string" ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : (
            <div className="text-sm text-muted-foreground">{description}</div>
          ))}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
