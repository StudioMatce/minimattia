import type { BrandTheme } from "@/lib/types/brand";

export const DEFAULT_BRAND_THEME: BrandTheme = {
  colors: {
    primary: "#1C2D28",
    secondary: "#1C2D28",
    accent: "#00A67D",
    background: "#EBEEE4",
    surface: "#FFFFFF",
    text: "#1C2D28",
    textSecondary: "#5A6B62",
    border: "#C8CEC3",
  },
  typography: {
    headingFamily: "Aptos, sans-serif",
    bodyFamily: "Aptos, sans-serif",
    scale: {
      h1: 32,
      h2: 24,
      h3: 18,
      body: 14,
      caption: 11,
    },
  },
  spacing: {
    nodeWidth: 180,
    nodeHeight: 80,
    nodePadding: 20,
    nodeGap: 60,
    borderRadius: 50,
  },
  shapes: {
    nodeStrokeWidth: 1.5,
    edgeStrokeWidth: 1.5,
    arrowSize: 8,
    edgeStyle: "bezier",
    nodeShape: "ellipse",
    dashedOutlines: true,
  },
};

export function mergeBrandTheme(
  partial: Partial<BrandTheme> | unknown
): BrandTheme {
  if (!partial || typeof partial !== "object") return DEFAULT_BRAND_THEME;

  const p = partial as Partial<BrandTheme>;
  return {
    colors: { ...DEFAULT_BRAND_THEME.colors, ...p.colors },
    typography: {
      ...DEFAULT_BRAND_THEME.typography,
      ...p.typography,
      scale: {
        ...DEFAULT_BRAND_THEME.typography.scale,
        ...p.typography?.scale,
      },
    },
    spacing: { ...DEFAULT_BRAND_THEME.spacing, ...p.spacing },
    shapes: { ...DEFAULT_BRAND_THEME.shapes, ...p.shapes },
  };
}
