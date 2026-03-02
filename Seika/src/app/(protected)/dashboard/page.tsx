import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Palette } from "lucide-react";
import { TOOLS } from "@/lib/tools/registry";

export default function DashboardPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Benvenuto su Mini Mattia. Disegna, genera, esporta.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card key={tool.slug}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {tool.name}
                </CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/tools/${tool.slug}`}>
                  <Button>Apri</Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Brand
            </CardTitle>
            <CardDescription>
              Configura colori, font e stile del brand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/brand">
              <Button variant="outline">Configura brand</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
