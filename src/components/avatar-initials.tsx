import { cn } from "@/lib/utils";
import { avatarStyle, initials } from "@/lib/format";

export function AvatarInitials({
  name,
  className,
  size = 36,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md font-mono text-[13px] font-semibold",
        className
      )}
      style={{ width: size, height: size, ...avatarStyle(name) }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
