"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Settings,
  Plus,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const SECTIONS = [
  {
    label: "Agency",
    items: [{ href: "/", label: "Home", icon: LayoutDashboard }],
  },
  {
    label: "Lavoro",
    items: [
      { href: "/audits", label: "Audit", icon: FileSpreadsheet },
      { href: "/clients", label: "Clienti", icon: Users },
    ],
  },
  {
    label: "Sistema",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar/60 backdrop-blur">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-[13px] font-semibold text-primary-foreground shadow-soft">
          O
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-tight">
            ORIZON
          </span>
          <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Audit Suite
          </span>
        </div>
      </div>

      <div className="p-3">
        <Button asChild size="sm" className="w-full justify-start gap-2 shadow-soft">
          <Link href="/audits/new" onClick={onNavigate}>
            <Plus className="size-4" />
            Nuovo audit
          </Link>
        </Button>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-foreground/80 transition-colors",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        active &&
                          "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      )}
                    >
                      <Icon className="size-[15px]" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Command className="size-3" />
            Command palette
          </span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </div>
        <div className="flex items-center justify-between rounded-md px-2 py-1 text-[11px] text-muted-foreground">
          <span>Tema</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
