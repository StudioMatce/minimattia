"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveBrandConfig } from "@/app/(protected)/brand/actions";
import type { BrandTheme } from "@/lib/types/brand";
import { toast } from "sonner";

interface BrandConfigFormProps {
  initialConfig: BrandTheme;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 cursor-pointer rounded border p-0.5"
      />
      <div className="flex-1 space-y-1">
        <Label className="text-xs">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function BrandConfigForm({ initialConfig }: BrandConfigFormProps) {
  const [config, setConfig] = useState<BrandTheme>(initialConfig);
  const [saving, setSaving] = useState(false);

  function updateColors(key: keyof BrandTheme["colors"], value: string) {
    setConfig((c) => ({ ...c, colors: { ...c.colors, [key]: value } }));
  }

  function updateTypography(
    key: keyof BrandTheme["typography"],
    value: string
  ) {
    setConfig((c) => ({
      ...c,
      typography: { ...c.typography, [key]: value },
    }));
  }

  function updateScale(key: keyof BrandTheme["typography"]["scale"], value: number) {
    setConfig((c) => ({
      ...c,
      typography: {
        ...c.typography,
        scale: { ...c.typography.scale, [key]: value },
      },
    }));
  }

  function updateSpacing(key: keyof BrandTheme["spacing"], value: number) {
    setConfig((c) => ({ ...c, spacing: { ...c.spacing, [key]: value } }));
  }

  function updateShapes(key: keyof BrandTheme["shapes"], value: string | number) {
    setConfig((c) => ({ ...c, shapes: { ...c.shapes, [key]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveBrandConfig(config);
      toast.success("Brand salvato");
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const colorFields: { key: keyof BrandTheme["colors"]; label: string }[] = [
    { key: "primary", label: "Primario" },
    { key: "secondary", label: "Secondario" },
    { key: "accent", label: "Accento" },
    { key: "background", label: "Sfondo" },
    { key: "surface", label: "Superficie" },
    { key: "text", label: "Testo" },
    { key: "textSecondary", label: "Testo secondario" },
    { key: "border", label: "Bordo" },
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="colors">
        <TabsList>
          <TabsTrigger value="colors">Colori</TabsTrigger>
          <TabsTrigger value="typography">Tipografia</TabsTrigger>
          <TabsTrigger value="spacing">Spaziatura</TabsTrigger>
          <TabsTrigger value="shapes">Forme</TabsTrigger>
        </TabsList>

        <TabsContent value="colors">
          <Card>
            <CardHeader>
              <CardTitle>Palette colori</CardTitle>
              <CardDescription>
                Definisci i colori del brand per i visual generati
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {colorFields.map((f) => (
                <ColorField
                  key={f.key}
                  label={f.label}
                  value={config.colors[f.key]}
                  onChange={(v) => updateColors(f.key, v)}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="typography">
          <Card>
            <CardHeader>
              <CardTitle>Tipografia</CardTitle>
              <CardDescription>
                Font e dimensioni per i diagrammi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Font titoli</Label>
                  <Input
                    value={config.typography.headingFamily}
                    onChange={(e) =>
                      updateTypography("headingFamily", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Font corpo</Label>
                  <Input
                    value={config.typography.bodyFamily}
                    onChange={(e) =>
                      updateTypography("bodyFamily", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  Object.entries(config.typography.scale) as [
                    keyof BrandTheme["typography"]["scale"],
                    number,
                  ][]
                ).map(([key, val]) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs uppercase">{key}</Label>
                    <Input
                      type="number"
                      value={val}
                      onChange={(e) =>
                        updateScale(key, Number(e.target.value))
                      }
                      className="h-8"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spacing">
          <Card>
            <CardHeader>
              <CardTitle>Spaziatura</CardTitle>
              <CardDescription>
                Dimensioni e distanze tra gli elementi
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {(
                Object.entries(config.spacing) as [
                  keyof BrandTheme["spacing"],
                  number,
                ][]
              ).map(([key, val]) => (
                <div key={key} className="space-y-2">
                  <Label className="text-xs">
                    {
                      {
                        nodeWidth: "Larghezza nodo",
                        nodeHeight: "Altezza nodo",
                        nodePadding: "Padding nodo",
                        nodeGap: "Gap tra nodi",
                        borderRadius: "Raggio bordo",
                      }[key]
                    }
                  </Label>
                  <Input
                    type="number"
                    value={val}
                    onChange={(e) =>
                      updateSpacing(key, Number(e.target.value))
                    }
                    className="h-8"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shapes">
          <Card>
            <CardHeader>
              <CardTitle>Forme</CardTitle>
              <CardDescription>
                Stile dei nodi e delle connessioni
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Spessore bordo nodo</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={config.shapes.nodeStrokeWidth}
                  onChange={(e) =>
                    updateShapes("nodeStrokeWidth", Number(e.target.value))
                  }
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label>Spessore connessioni</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={config.shapes.edgeStrokeWidth}
                  onChange={(e) =>
                    updateShapes("edgeStrokeWidth", Number(e.target.value))
                  }
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label>Dimensione freccia</Label>
                <Input
                  type="number"
                  value={config.shapes.arrowSize}
                  onChange={(e) =>
                    updateShapes("arrowSize", Number(e.target.value))
                  }
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label>Stile connessioni</Label>
                <Select
                  value={config.shapes.edgeStyle}
                  onValueChange={(v) => updateShapes("edgeStyle", v)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight">Dritto</SelectItem>
                    <SelectItem value="orthogonal">Ortogonale</SelectItem>
                    <SelectItem value="bezier">Curvo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Forma nodi</Label>
                <Select
                  value={config.shapes.nodeShape}
                  onValueChange={(v) => updateShapes("nodeShape", v)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rectangle">Rettangolo</SelectItem>
                    <SelectItem value="rounded">Arrotondato</SelectItem>
                    <SelectItem value="pill">Pillola</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} disabled={saving} size="lg">
        {saving ? "Salvataggio..." : "Salva configurazione brand"}
      </Button>
    </div>
  );
}
