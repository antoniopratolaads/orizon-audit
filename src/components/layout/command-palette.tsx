"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Settings,
  Plus,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";

type Client = { id: string; name: string };
type Audit = {
  id: string;
  clientName: string;
  platform: string;
  createdAt: string;
};

type Ctx = {
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const CommandPaletteCtx = React.createContext<Ctx | null>(null);

export function useCommandPalette() {
  const ctx = React.useContext(CommandPaletteCtx);
  if (!ctx) {
    // Safe no-op fallback before provider mounts
    return { open: () => {}, close: () => {}, toggle: () => {} };
  }
  return ctx;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [audits, setAudits] = React.useState<Audit[]>([]);
  const router = useRouter();
  const { setTheme } = useTheme();

  const ctx = React.useMemo<Ctx>(
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
    }),
    []
  );

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/audits?limit=10")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAudits(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandPaletteCtx.Provider value={ctx}>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Cerca o vai a..." />
        <CommandList>
          <CommandEmpty>Nessun risultato.</CommandEmpty>

          <CommandGroup heading="Azioni">
            <CommandItem onSelect={() => go("/audits/new")}>
              <Plus /> Nuovo audit
            </CommandItem>
            <CommandItem onSelect={() => go("/clients/new")}>
              <Plus /> Nuovo cliente
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Vai a">
            <CommandItem onSelect={() => go("/")}>
              <LayoutDashboard /> Home
            </CommandItem>
            <CommandItem onSelect={() => go("/audits")}>
              <FileSpreadsheet /> Audit
            </CommandItem>
            <CommandItem onSelect={() => go("/clients")}>
              <Users /> Clienti
            </CommandItem>
            <CommandItem onSelect={() => go("/settings")}>
              <Settings /> Settings
            </CommandItem>
          </CommandGroup>

          {clients.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Clienti">
                {clients.slice(0, 8).map((c) => (
                  <CommandItem
                    key={c.id}
                    onSelect={() => go(`/clients/${c.id}`)}
                  >
                    <Users /> {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {audits.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Audit recenti">
                {audits.slice(0, 8).map((a) => (
                  <CommandItem
                    key={a.id}
                    onSelect={() => go(`/audits/${a.id}`)}
                  >
                    <FileSpreadsheet /> {a.clientName} — {a.platform}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Tema">
            <CommandItem onSelect={() => { setTheme("light"); setOpen(false); }}>
              <Sun /> Tema chiaro
            </CommandItem>
            <CommandItem onSelect={() => { setTheme("dark"); setOpen(false); }}>
              <Moon /> Tema scuro
            </CommandItem>
            <CommandItem onSelect={() => { setTheme("system"); setOpen(false); }}>
              <Monitor /> Sistema
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandPaletteCtx.Provider>
  );
}
