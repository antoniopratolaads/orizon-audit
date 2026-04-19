"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Upload,
  Sparkles,
  Plus,
  FileSpreadsheet,
  ShoppingCart,
  UserCheck,
  Loader2,
  FileText,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HealthBar } from "@/components/status-pill";
import { ScriptInstructions } from "@/components/script-instructions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Client = { id: string; name: string; description?: string | null };
type Platform = "google" | "meta";
type Business = "ecom" | "leadgen";

const STEPS = [
  { n: 1, label: "Piattaforma" },
  { n: 2, label: "Tipo business" },
  { n: 3, label: "Cliente" },
  { n: 4, label: "Upload file" },
  { n: 5, label: "Genera" },
] as const;

export function NewAuditWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = React.useState(1);
  const [platform, setPlatform] = React.useState<Platform | null>(null);
  const [business, setBusiness] = React.useState<Business | null>(null);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [clientId, setClientId] = React.useState<string>(params.get("clientId") ?? "");
  const [newClientName, setNewClientName] = React.useState("");
  const [newClientDescription, setNewClientDescription] = React.useState("");
  const [auditor, setAuditor] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [stages, setStages] = React.useState<string[]>([]);
  const [elapsed, setElapsed] = React.useState(0);
  const [tokensGen, setTokensGen] = React.useState(0);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [successData, setSuccessData] = React.useState<{
    auditId: string;
    elapsed: number;
    summary: {
      executiveSummary?: string;
      counts?: { ok: number; warn: number; crit: number; na: number };
      actionsCount?: number;
      topActions?: { area: string; action: string; priority: string }[];
      kpiCount?: number;
      presentationCount?: number;
    };
  } | null>(null);

  React.useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [busy]);

  React.useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(Array.isArray(d) ? d : []));
  }, []);

  const canProceed = React.useMemo(() => {
    if (step === 1) return !!platform;
    if (step === 2) return !!business;
    if (step === 3)
      return !!clientId || newClientName.trim().length > 0;
    if (step === 4) return !!file;
    return true;
  }, [step, platform, business, clientId, newClientName, file]);

  async function handleNext() {
    if (!canProceed) return;
    if (step === 3 && !clientId && newClientName.trim()) {
      // Create client inline
      setBusy(true);
      try {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newClientName.trim(),
            description: newClientDescription.trim(),
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        setClientId(created.id);
        setClients((cs) => [created, ...cs]);
        toast.success(`Cliente "${created.name}" creato`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    if (step < 5) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  async function startGenerate() {
    if (!clientId || !platform || !business || !file) return;
    setBusy(true);
    setStages(["Parsing del file..."]);
    try {
      const fd = new FormData();
      fd.append("clientId", clientId);
      fd.append("platform", platform);
      fd.append("businessType", business);
      if (auditor) fd.append("auditor", auditor);
      fd.append("file", file);

      const createRes = await fetch("/api/audits", {
        method: "POST",
        body: fd,
      });
      if (!createRes.ok) throw new Error(await createRes.text());
      const { id } = await createRes.json();

      setStages((s) => [...s, "Invio a Claude..."]);
      const genRes = await fetch(`/api/audits/${id}/generate`, { method: "POST" });
      if (!genRes.ok || !genRes.body) {
        throw new Error("Errore generazione");
      }
      const reader = genRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      let error: string | null = null;
      let doneSummary: {
        executiveSummary?: string;
        counts?: { ok: number; warn: number; crit: number; na: number };
        actionsCount?: number;
        topActions?: { area: string; action: string; priority: string }[];
        kpiCount?: number;
        presentationCount?: number;
      } = {};
      const startTime = Date.now();
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
            if (evtLine === "stage") {
              setStages((s) => [...s, payload.message]);
            } else if (evtLine === "token") {
              setTokensGen((t) => t + (payload.chunk?.length ?? 0));
            } else if (evtLine === "heartbeat") {
              // keepalive, keeps the connection open — no UI update needed
            } else if (evtLine === "error") {
              error = payload.message;
            } else if (evtLine === "done") {
              setStages((s) => [...s, "Completato."]);
              doneSummary = payload.summary ?? {};
            }
          }
        }
      }
      if (error) throw new Error(error);
      const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
      setSuccessData({ auditId: id, elapsed: totalElapsed, summary: doneSummary });
      setSuccessOpen(true);
      router.prefetch(`/audits/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  const platformLabel =
    platform === "google" ? "Google Ads" : platform === "meta" ? "Meta Ads" : "";
  const businessLabel =
    business === "ecom" ? "E-commerce" : business === "leadgen" ? "Lead Gen" : "";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Nuovo audit" description="5 step per generare un audit compilato." />

      <Stepper current={step} />

      <Card className="mt-5">
        <CardContent className="pt-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Scegli la piattaforma</h3>
                <p className="text-xs text-muted-foreground">
                  Il flusso cambia in base alla piattaforma selezionata.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectCard
                  active={platform === "google"}
                  onClick={() => setPlatform("google")}
                  title="Google Ads"
                  description="Script XLSX (23 tab)"
                  icon={<FileSpreadsheet className="size-5" />}
                />
                <SelectCard
                  active={platform === "meta"}
                  onClick={() => {
                    setPlatform("meta");
                    // Meta doesn't need businessType for template selection (generic) but we still ask
                  }}
                  title="Meta Ads"
                  description="Export CSV Ads Manager"
                  icon={<FileText className="size-5" />}
                />
              </div>

              {platform && <ScriptInstructions platform={platform} />}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Tipo di business</h3>
                <p className="text-xs text-muted-foreground">
                  Determina quale template usare e le metriche chiave.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectCard
                  active={business === "ecom"}
                  onClick={() => setBusiness("ecom")}
                  title="E-commerce"
                  description="Shopping, GMC, ROAS, AOV"
                  icon={<ShoppingCart className="size-5" />}
                />
                <SelectCard
                  active={business === "leadgen"}
                  onClick={() => setBusiness("leadgen")}
                  title="Lead Generation"
                  description="Form, CPA, OCT, qualità lead"
                  icon={<UserCheck className="size-5" />}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Cliente</h3>
                <p className="text-xs text-muted-foreground">
                  Seleziona un cliente esistente oppure creane uno nuovo.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Cliente esistente</Label>
                <Select
                  value={clientId || ""}
                  onValueChange={(v) => setClientId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  oppure
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="newName">Nuovo cliente — Nome</Label>
                  <Input
                    id="newName"
                    value={newClientName}
                    onChange={(e) => {
                      setNewClientName(e.target.value);
                      if (e.target.value) setClientId("");
                    }}
                    placeholder="Es. THEMOIRè"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newDesc">Descrizione</Label>
                  <Textarea
                    id="newDesc"
                    rows={2}
                    value={newClientDescription}
                    onChange={(e) => setNewClientDescription(e.target.value)}
                    placeholder="Settore, note interne..."
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Carica il file</h3>
                <p className="text-xs text-muted-foreground">
                  {platform === "google"
                    ? "XLSX generato dallo script Google Ads ORIZON v4 (23 tab)."
                    : "CSV export da Meta Ads Manager (livello ad × placement)."}
                </p>
              </div>

              <Dropzone
                accept={platform === "google" ? ".xlsx" : ".csv"}
                file={file}
                onFile={setFile}
              />

              <div className="space-y-1.5">
                <Label htmlFor="auditor">Auditor (opzionale)</Label>
                <Input
                  id="auditor"
                  value={auditor}
                  onChange={(e) => setAuditor(e.target.value)}
                  placeholder="Il tuo nome"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Riepilogo e generazione</h3>
                <p className="text-xs text-muted-foreground">
                  Controlla i dettagli e avvia la generazione. Claude analizzerà i dati.
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/20 p-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Piattaforma
                  </dt>
                  <dd>{platformLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Tipo business
                  </dt>
                  <dd>{businessLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Cliente
                  </dt>
                  <dd>
                    {clients.find((c) => c.id === clientId)?.name ?? newClientName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    File
                  </dt>
                  <dd className="truncate">{file?.name ?? "—"}</dd>
                </div>
              </dl>

              {stages.length > 0 && (
                <div className="space-y-3 rounded-md border border-border bg-card p-3">
                  {busy && (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="relative flex size-1.5">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                        </span>
                        In corso · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                      </span>
                      {tokensGen > 0 && (
                        <span className="font-mono tabular-nums">
                          {tokensGen.toLocaleString("it-IT")} char generati
                        </span>
                      )}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {stages.map((s, i) => {
                      const last = i === stages.length - 1;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs"
                        >
                          {last && busy ? (
                            <Loader2 className="size-3 animate-spin text-primary" />
                          ) : (
                            <Check className="size-3 text-[color:var(--status-ok)]" />
                          )}
                          <span
                            className={cn(
                              last && busy
                                ? "text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {s}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {busy && elapsed > 60 && (
                    <p className="text-[11px] text-muted-foreground">
                      Claude sta analizzando un dataset grosso. Può richiedere fino a 3-4 minuti.
                      Non chiudere la pagina.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-5 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1 || busy}
        >
          <ArrowLeft className="size-4" /> Indietro
        </Button>

        {step < 5 ? (
          <Button onClick={handleNext} disabled={!canProceed || busy}>
            Avanti <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={startGenerate} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Genera audit
          </Button>
        )}
      </div>

      <SuccessDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        data={successData}
        clientName={
          clients.find((c) => c.id === clientId)?.name ?? newClientName
        }
        onOpenEditor={() => {
          if (successData) router.push(`/audits/${successData.auditId}`);
        }}
      />
    </div>
  );
}

function SuccessDialog({
  open,
  onOpenChange,
  data,
  clientName,
  onOpenEditor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: {
    auditId: string;
    elapsed: number;
    summary: {
      executiveSummary?: string;
      counts?: { ok: number; warn: number; crit: number; na: number };
      actionsCount?: number;
      topActions?: { area: string; action: string; priority: string }[];
      kpiCount?: number;
      presentationCount?: number;
    };
  } | null;
  clientName: string;
  onOpenEditor: () => void;
}) {
  if (!data) return null;
  const c = data.summary.counts ?? { ok: 0, warn: 0, crit: 0, na: 0 };
  const hasContent =
    (data.summary.kpiCount ?? 0) > 0 || (c.ok + c.warn + c.crit) > 0;
  const elapsedFmt = `${Math.floor(data.elapsed / 60)}m ${data.elapsed % 60}s`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-[color:var(--status-ok-bg)]">
            <Check className="size-5 text-[color:var(--status-ok)]" />
          </div>
          <DialogTitle>Audit generato</DialogTitle>
          <DialogDescription>
            {hasContent ? (
              <>
                Claude ha analizzato i dati di <strong>{clientName}</strong> in{" "}
                {elapsedFmt}. Ecco un&apos;anteprima. Scarica l&apos;XLSX oppure
                apri l&apos;editor per rivedere e correggere prima della consegna.
              </>
            ) : (
              <>
                Il processo è terminato in {elapsedFmt} ma l&apos;output di
                Claude non è stato parsabile. Apri l&apos;editor per vedere la
                risposta raw e diagnosticare.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasContent && (
          <div className="space-y-4">
            <HealthBar
              ok={c.ok}
              warn={c.warn}
              crit={c.crit}
              na={c.na}
            />

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat n={data.summary.kpiCount ?? 0} label="KPI" />
              <Stat n={data.summary.actionsCount ?? 0} label="Azioni" />
              <Stat n={data.summary.presentationCount ?? 0} label="Slide" />
            </div>

            {data.summary.executiveSummary && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Executive summary
                </div>
                <p className="text-xs leading-relaxed line-clamp-5">
                  {data.summary.executiveSummary}
                </p>
              </div>
            )}

            {data.summary.topActions && data.summary.topActions.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Azioni prioritarie
                </div>
                <ul className="space-y-1">
                  {data.summary.topActions.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                    >
                      <span className="mt-0.5 shrink-0 rounded-sm border border-border bg-muted px-1 font-mono text-[9px] uppercase tracking-wider">
                        {a.priority}
                      </span>
                      <span className="shrink-0 font-medium">{a.area}</span>
                      <span className="text-muted-foreground">{a.action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
          <Button variant="outline" onClick={onOpenEditor}>
            Apri editor
          </Button>
          <Button asChild>
            <a href={`/api/audits/${data.auditId}/export`}>
              <Download className="size-4" />
              Scarica XLSX
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="font-display text-2xl leading-none tabular-nums">{n}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mt-4 flex items-center gap-2">
      {STEPS.map((s) => {
        const active = current === s.n;
        const done = current > s.n;
        return (
          <li key={s.n} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium transition-colors",
                active && "border-primary bg-primary text-primary-foreground",
                done && "border-primary bg-primary text-primary-foreground",
                !active && !done && "border-border bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="size-3" /> : s.n}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            {s.n < STEPS.length && (
              <div
                className={cn(
                  "ml-1 h-px flex-1 transition-colors",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SelectCard({
  title,
  description,
  icon,
  active,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-all",
        active
          ? "border-primary bg-accent ring-1 ring-primary/40"
          : "border-border hover:border-primary/40 hover:bg-accent/40"
      )}
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-md",
          active ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {active && <Check className="ml-auto size-4 text-primary" />}
    </button>
  );
}

function Dropzone({
  accept,
  file,
  onFile,
}: {
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 p-6 text-center transition-colors",
        over ? "border-primary bg-accent/60" : "border-border"
      )}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <>
          <FileSpreadsheet className="size-6 text-primary" />
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{file.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB · Clicca per sostituire
            </div>
          </div>
        </>
      ) : (
        <>
          <Upload className="size-6 text-muted-foreground" />
          <div className="space-y-0.5">
            <div className="text-sm font-medium">
              Trascina il file qui o clicca
            </div>
            <div className="text-[11px] text-muted-foreground">
              Formato {accept}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
