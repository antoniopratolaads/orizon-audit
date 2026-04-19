"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Key, Sparkles, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Settings = {
  anthropicApiKey: string;
  hasApiKey: boolean;
  promptGoogleEcom: string;
  promptGoogleLeadgen: string;
  promptMeta: string;
};

export default function SettingsPage() {
  const [data, setData] = React.useState<Settings | null>(null);
  const [apiKeyInput, setApiKeyInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setApiKeyInput(d.anthropicApiKey || "");
      });
  }, []);

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="Settings" description="Configurazione dell'app." />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  async function save(partial: Partial<Settings>) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Salvato");
      const fresh = await fetch("/api/settings").then((r) => r.json());
      setData(fresh);
      if (partial.anthropicApiKey !== undefined) {
        setApiKeyInput(fresh.anthropicApiKey || "");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Settings" description="Configurazione Claude API e prompt templates." />

      <Tabs defaultValue="api">
        <TabsList>
          <TabsTrigger value="api">
            <Key className="size-3.5" /> API
          </TabsTrigger>
          <TabsTrigger value="prompts">
            <Sparkles className="size-3.5" /> Prompts AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Claude API Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Chiave API Anthropic. Usata per generare le considerazioni dell'audit.
                {data.hasApiKey ? " Una chiave è già configurata." : ""}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                {data.hasApiKey && (
                  <Button
                    variant="outline"
                    onClick={() => save({ anthropicApiKey: "" })}
                    disabled={saving}
                  >
                    Rimuovi
                  </Button>
                )}
                <Button
                  onClick={() => save({ anthropicApiKey: apiKeyInput })}
                  disabled={saving || !apiKeyInput || apiKeyInput.includes("••••")}
                >
                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                  Salva
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4 pt-4">
          <PromptEditor
            title="Google Ads — E-commerce"
            value={data.promptGoogleEcom}
            onSave={(v) => save({ promptGoogleEcom: v })}
            saving={saving}
          />
          <PromptEditor
            title="Google Ads — Lead Generation"
            value={data.promptGoogleLeadgen}
            onSave={(v) => save({ promptGoogleLeadgen: v })}
            saving={saving}
          />
          <PromptEditor
            title="Meta Ads"
            value={data.promptMeta}
            onSave={(v) => save({ promptMeta: v })}
            saving={saving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PromptEditor({
  title,
  value,
  onSave,
  saving,
}: {
  title: string;
  value: string;
  onSave: (v: string) => void;
  saving: boolean;
}) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  const dirty = v !== value;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={10}
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="font-mono text-xs"
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setV(value)}
            disabled={!dirty}
          >
            Annulla
          </Button>
          <Button size="sm" onClick={() => onSave(v)} disabled={!dirty || saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Salva
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
