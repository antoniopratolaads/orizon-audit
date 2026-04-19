"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  audits: "Audit",
  clients: "Clienti",
  settings: "Settings",
  new: "Nuovo",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segs = pathname.split("/").filter(Boolean);
  const parts: { href: string; label: string }[] = [
    { href: "/", label: "Home" },
  ];
  let acc = "";
  for (const seg of segs) {
    acc += `/${seg}`;
    parts.push({ href: acc, label: LABELS[seg] ?? decodeURIComponent(seg) });
  }

  return (
    <nav className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
      {parts.map((p, i) => (
        <div key={p.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3 opacity-50" />}
          {i === parts.length - 1 ? (
            <span className="font-medium text-foreground">{p.label}</span>
          ) : (
            <Link
              href={p.href}
              className="transition-colors hover:text-foreground"
            >
              {p.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
