import { getBrandConfig } from "./actions";
import { BrandConfigForm } from "@/components/brand/BrandConfigForm";
import { DEFAULT_BRAND_THEME } from "@/lib/engine/brand-theme";
import { mergeBrandTheme } from "@/lib/engine/brand-theme";

export default async function BrandPage() {
  const saved = await getBrandConfig();
  const config = saved ? mergeBrandTheme(saved) : DEFAULT_BRAND_THEME;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Brand</h2>
        <p className="text-sm text-muted-foreground">
          Configura colori, tipografia e stile dei visual generati
        </p>
      </div>
      <BrandConfigForm initialConfig={config} />
    </div>
  );
}
