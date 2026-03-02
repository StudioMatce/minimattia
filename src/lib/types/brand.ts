export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
}

export interface BrandTypography {
  headingFamily: string;
  bodyFamily: string;
  scale: {
    h1: number;
    h2: number;
    h3: number;
    body: number;
    caption: number;
  };
}

export interface BrandSpacing {
  nodeWidth: number;
  nodeHeight: number;
  nodePadding: number;
  nodeGap: number;
  borderRadius: number;
}

export interface BrandShapes {
  nodeStrokeWidth: number;
  edgeStrokeWidth: number;
  arrowSize: number;
  edgeStyle: "straight" | "orthogonal" | "bezier";
  nodeShape: "rectangle" | "rounded" | "pill" | "ellipse";
  dashedOutlines: boolean;
}

export interface BrandTheme {
  colors: BrandColors;
  typography: BrandTypography;
  spacing: BrandSpacing;
  shapes: BrandShapes;
}
