"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  Sparkles,
  Loader2,
  Check,
  RefreshCw,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AvatarInitials } from "@/components/avatar-initials";
import { StatusPill, HealthBar } from "@/components/status-pill";
import { EditableText } from "@/components/editable-text";
import { EmptyState } from "@/components/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  businessLabel,
  formatDateTime,
  platformLabel,
} from "@/lib/format";
import type { AuditData } from "@/lib/parsers/types";

type Props = {
  id: string;
  clientName: string;
  platform: string;
  businessType: string;
  createdAt: string;
  status: string;
  auditData: Partial<AuditData>;
};

export function AuditEditor(props: Props) {
  const router = useRouter();
  const [data, setData] = React.useState<Partial<AuditData>>(props.auditData);
  const [saving, setSaving] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [stages, setStages] = React.useState<string[]>([]);
  const [suggesting, setSuggesting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const dirtyRef = React.useRef(false);

  const hasData = Boolean(data.checklist?.length);

  const counts = React.useMemo(() => {
    const c = { ok: 0, warn: 0, crit: 0, na: 0 };
    for (const x of data.checklist ?? []) {
      if (x.status === "OK") c.ok++;
      else if (x.status === "Warning") c.warn++;
      else if (x.status === "Critico") c.crit++;
      else if (x.status === "N/A" || x.type === "MANUAL") c.na++;
    }
    return c;
  }, [data.checklist]);

  // Debounced autosave
  React.useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/audits/${props.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auditData: data }),
        });
        dirtyRef.current = false;
      } catch {
        toast.error("Errore salvataggio");
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [data, props.id]);

  function update<K extends keyof AuditData>(
    key: K,
    updater: (v: AuditData[K]) => AuditData[K]
  ) {
    setData((d) => ({ ...d, [key]: updater(d[key] as AuditData[K]) }));
    dirtyRef.current = true;
  }

  function patchChecklist(idx: number, patch: Partial<AuditData["checklist"][number]>) {
    update("checklist", (list) =>
      list.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  }

  function patchKpi(idx: number, patch: Partial<AuditData["kpi"][number]>) {
    update("kpi", (list) =>
      list.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  }

  function patchAction(idx: number, patch: Partial<AuditData["actions"][number]>) {
    update("actions", (list) =>
      list.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  }

  function patchPresentation(
    idx: number,
    patch: Partial<AuditData["presentation"][number]>
  ) {
    update("presentation", (list) =>
      list.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  }

  async function runGenerate() {
    setGenerating(true);
    setStages([]);
    try {
      const res = await fetch(`/api/audits/${props.id}/generate`, {
        method: "POST",
      });
      if (!res.ok || !res.body) throw new Error("Errore");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let error: string | null = null;
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          buf += decoder.decode(value, { stream: true });
          const events = buf.split(/\n\n/);
          buf = events.pop() ?? "";
          for (const ev of events) {
            const evtLine = ev.match(/^event:\s*(.+)$/m)?.[1];
            const dataLine = ev.match(/^data:\s*(.+)$/m)?.[1];
            if (!evtLine || !dataLine) continue;
            const payload = JSON.parse(dataLine);
            if (evtLine === "stage") setStages((s) => [...s, payload.message]);
            if (evtLine === "error") error = payload.message;
            if (evtLine === "done") {
              setStages((s) => [...s, "Completato."]);
            }
          }
        }
      }
      if (error) throw new Error(error);
      // Reload data
      const fresh = await fetch(`/api/audits/${props.id}`).then((r) => r.json());
      setData(fresh.auditData);
      toast.success("Rigenerato");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setGenerating(false);
    }
  }

  async function suggestExtraActions() {
    setSuggesting(true);
    try {
      const res = await fetch(`/api/audits/${props.id}/suggest-actions`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const { actions } = await res.json();
      update("actions", (current) => {
        const list = [...(current ?? [])];
        let n = list.length;
        for (const a of actions as AuditData["actions"]) {
          list.push({ ...a, n: ++n });
        }
        return list;
      });
      toast.success(`${actions.length} azioni aggiunte`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setSuggesting(false);
    }
  }

  async function downloadXlsx() {
    window.location.href = `/api/audits/${props.id}/export`;
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/audits/${props.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Audit eliminato");
      router.push("/audits");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
      setDeleting(false);
    }
  }

  const platformBadge =
    props.platform === "google" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 align-middle text-[11px] font-medium text-primary">
        <span className="size-1.5 rounded-full bg-primary" />
        Google Ads
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 align-middle text-[11px] font-medium text-blue-500">
        <span className="size-1.5 rounded-full bg-blue-500" />
        Meta Ads
      </span>
    );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={props.clientName}
        description={
          <span className="flex items-center gap-2">
            {platformBadge}
            <span>·</span>
            <span>{businessLabel(props.businessType)}</span>
            <span>·</span>
            <span>creato {formatDateTime(props.createdAt)}</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {saving && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Salvo...
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={runGenerate}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Rigenera
            </Button>
            <Button size="sm" onClick={downloadXlsx}>
              <Download className="size-3.5" /> Scarica XLSX
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Elimina audit"
              onClick={() => setConfirmDelete(true)}
              className="text-muted-foreground hover:text-[color:var(--status-crit)]"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        }
      />

      {generating && stages.length > 0 && (
        <Card className="mb-4">
          <CardContent className="space-y-1.5 py-3">
            {stages.map((s, i) => {
              const last = i === stages.length - 1;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {last ? (
                    <Loader2 className="size-3 animate-spin text-primary" />
                  ) : (
                    <Check className="size-3 text-[color:var(--status-ok)]" />
                  )}
                  <span className={last ? "text-foreground" : "text-muted-foreground"}>
                    {s}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!hasData && !generating && (
        <EmptyState
          icon={FileSpreadsheet}
          title="Audit non ancora generato"
          description="Avvia la generazione con Claude per popolare i campi AUTO."
          action={
            <Button onClick={runGenerate} size="sm">
              <Sparkles className="size-3.5" /> Genera con Claude
            </Button>
          }
        />
      )}

      {hasData && (
        <>
          <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <AvatarInitials name={props.clientName} size={32} />
                <div className="leading-tight">
                  <div className="text-sm font-medium">{props.clientName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {platformLabel(props.platform)} · {businessLabel(props.businessType)}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {props.status === "completed" ? "Completato" : "Draft"}
                </Badge>
              </div>
              <div className="ml-auto min-w-[280px] flex-1 max-w-md">
                <HealthBar
                  ok={counts.ok}
                  warn={counts.warn}
                  crit={counts.crit}
                  na={counts.na}
                />
              </div>
            </div>
          </div>

          {data.executiveSummary && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Executive summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EditableText
                  value={data.executiveSummary ?? ""}
                  onChange={(v) => {
                    dirtyRef.current = true;
                    setData((d) => ({ ...d, executiveSummary: v }));
                  }}
                  className="text-sm"
                />
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="checklist">
            <TabsList>
              <TabsTrigger value="checklist">
                Checklist ({data.checklist?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="kpi">KPI ({data.kpi?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="actions">
                Azioni ({data.actions?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="presentation">
                Slide ({data.presentation?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="checklist" className="pt-4">
              <ChecklistView
                items={data.checklist ?? []}
                onChange={patchChecklist}
              />
            </TabsContent>

            <TabsContent value="kpi" className="pt-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-1">
                    {(data.kpi ?? []).map((k, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/30"
                      >
                        <div className="text-sm font-medium">{k.metric}</div>
                        <EditableText
                          value={String(k.value ?? "")}
                          onChange={(v) => patchKpi(i, { value: v })}
                          multiline={false}
                          className="text-right text-sm font-mono tabular-nums"
                        />
                        <EditableText
                          value={k.note ?? ""}
                          onChange={(v) => patchKpi(i, { note: v })}
                          placeholder="Nota..."
                          multiline={false}
                          className="text-xs text-muted-foreground"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="pt-4 space-y-3">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={suggestExtraActions}
                  disabled={suggesting}
                >
                  {suggesting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Suggerisci azioni extra
                </Button>
              </div>
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-1">
                    {(data.actions ?? []).map((a, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[auto_100px_1fr_120px_90px] items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/30"
                      >
                        <div className="pt-1 text-xs font-mono text-muted-foreground">
                          {i + 1}
                        </div>
                        <EditableText
                          value={a.area ?? ""}
                          onChange={(v) => patchAction(i, { area: v })}
                          placeholder="Area"
                          multiline={false}
                          className="text-xs"
                        />
                        <EditableText
                          value={a.action ?? ""}
                          onChange={(v) => patchAction(i, { action: v })}
                          placeholder="Azione"
                          className="text-sm"
                        />
                        <Select
                          value={a.priority ?? ""}
                          onValueChange={(v) =>
                            patchAction(i, {
                              priority: v as "Alta" | "Media" | "Bassa",
                            })
                          }
                        >
                          <SelectTrigger size="sm" className="h-7 text-xs">
                            <SelectValue placeholder="Priorità" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Alta">Alta</SelectItem>
                            <SelectItem value="Media">Media</SelectItem>
                            <SelectItem value="Bassa">Bassa</SelectItem>
                          </SelectContent>
                        </Select>
                        <EditableText
                          value={a.type ?? ""}
                          onChange={(v) => patchAction(i, { type: v })}
                          placeholder="Tipo"
                          multiline={false}
                          className="text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="presentation" className="pt-4">
              <PresentationView
                items={data.presentation ?? []}
                onChange={patchPresentation}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Eliminare questo audit?</DialogTitle>
            <DialogDescription>
              Audit di <strong>{props.clientName}</strong>. Tutti i dati
              (checklist, KPI, azioni, considerazioni) verranno cancellati
              definitivamente. L&apos;azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              Elimina definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChecklistView({
  items,
  onChange,
}: {
  items: AuditData["checklist"];
  onChange: (idx: number, patch: Partial<AuditData["checklist"][number]>) => void;
}) {
  const grouped = React.useMemo(() => {
    const byS = new Map<string, { item: AuditData["checklist"][number]; idx: number }[]>();
    items.forEach((it, idx) => {
      const sec = it.section || "Generale";
      if (!byS.has(sec)) byS.set(sec, []);
      byS.get(sec)!.push({ item: it, idx });
    });
    return Array.from(byS.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      {grouped.map(([section, entries]) => (
        <Card key={section}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{section}</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="divide-y divide-border">
              {entries.map(({ item, idx }) => (
                <div key={idx} className="grid grid-cols-[auto_1fr] gap-3 py-2">
                  <div className="flex w-40 shrink-0 flex-col gap-1.5">
                    <Badge
                      variant="outline"
                      className="w-fit text-[10px] font-mono"
                    >
                      {item.type}
                    </Badge>
                    <Select
                      value={item.status || ""}
                      onValueChange={(v) =>
                        onChange(idx, { status: v as AuditData["checklist"][number]["status"] })
                      }
                    >
                      <SelectTrigger size="sm" className="h-7 w-fit text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OK">OK</SelectItem>
                        <SelectItem value="Warning">Warning</SelectItem>
                        <SelectItem value="Critico">Critico</SelectItem>
                        <SelectItem value="N/A">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                    {item.status && <StatusPill status={item.status} />}
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">{item.checkpoint}</div>
                    <EditableText
                      value={item.note ?? ""}
                      onChange={(v) => onChange(idx, { note: v })}
                      placeholder="Nota / finding (clicca per editare)"
                      className="text-[13px] text-muted-foreground"
                    />
                    <EditableText
                      value={item.action ?? ""}
                      onChange={(v) => onChange(idx, { action: v })}
                      placeholder="Azione (clicca per editare)"
                      className="text-[13px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PresentationView({
  items,
  onChange,
}: {
  items: AuditData["presentation"];
  onChange: (
    idx: number,
    patch: Partial<AuditData["presentation"][number]>
  ) => void;
}) {
  const grouped = React.useMemo(() => {
    const byS = new Map<string, { item: AuditData["presentation"][number]; idx: number }[]>();
    items.forEach((it, idx) => {
      const sec = it.section || "Slide";
      if (!byS.has(sec)) byS.set(sec, []);
      byS.get(sec)!.push({ item: it, idx });
    });
    return Array.from(byS.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      {grouped.map(([section, entries]) => (
        <Card key={section}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Slide: {section}</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="divide-y divide-border">
              {entries.map(({ item, idx }) => (
                <div
                  key={idx}
                  className="grid grid-cols-[180px_1fr] items-start gap-3 py-2"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-medium">{item.field}</div>
                    <Badge
                      variant="outline"
                      className="w-fit text-[10px] font-mono"
                    >
                      {item.kind}
                    </Badge>
                  </div>
                  <EditableText
                    value={item.value ?? ""}
                    onChange={(v) => onChange(idx, { value: v })}
                    placeholder="(clicca per editare)"
                    className="text-[13px]"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
