"use client";

import { useCallback, useRef } from "react";
import {
  Tldraw,
  Editor,
  getSnapshot,
  loadSnapshot,
  DefaultStylePanel,
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultSizeStyle,
  DefaultFillStyle,
  DefaultColorThemePalette,
  StylePanelSection,
  StylePanelButtonPickerInline,
  StylePanelFontPicker,
  StylePanelTextAlignPicker,
  StylePanelArrowheadPicker,
  StylePanelSplinePicker,
  useStylePanelContext,
  type TLUiComponents,
} from "tldraw";
import * as Toolbar from "@radix-ui/react-toolbar";
import "tldraw/tldraw.css";
import { DEFAULT_BRAND_THEME } from "@/lib/engine/brand-theme";

// ── Brand colors from design tokens ──────────────────────────
const BRAND = {
  dark: DEFAULT_BRAND_THEME.colors.primary,
  accent: DEFAULT_BRAND_THEME.colors.accent,
  light: DEFAULT_BRAND_THEME.colors.background,
};

// ── Canvas bounds (fixed drawing area) ───────────────────────
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

// Light mode overrides
DefaultColorThemePalette.lightMode.black.solid = BRAND.dark;
DefaultColorThemePalette.lightMode.black.semi = BRAND.dark;
DefaultColorThemePalette.lightMode.black.pattern = BRAND.dark;
DefaultColorThemePalette.lightMode.green.solid = BRAND.accent;
DefaultColorThemePalette.lightMode.green.semi = BRAND.accent;
DefaultColorThemePalette.lightMode.green.pattern = BRAND.accent;
DefaultColorThemePalette.lightMode.grey.solid = BRAND.light;
DefaultColorThemePalette.lightMode.grey.semi = BRAND.light;
DefaultColorThemePalette.lightMode.grey.pattern = BRAND.light;

// Dark mode overrides
DefaultColorThemePalette.darkMode.black.solid = BRAND.dark;
DefaultColorThemePalette.darkMode.black.semi = BRAND.dark;
DefaultColorThemePalette.darkMode.black.pattern = BRAND.dark;
DefaultColorThemePalette.darkMode.green.solid = BRAND.accent;
DefaultColorThemePalette.darkMode.green.semi = BRAND.accent;
DefaultColorThemePalette.darkMode.green.pattern = BRAND.accent;
DefaultColorThemePalette.darkMode.grey.solid = BRAND.light;
DefaultColorThemePalette.darkMode.grey.semi = BRAND.light;
DefaultColorThemePalette.darkMode.grey.pattern = BRAND.light;

// ── Defaults ───────────────────────────────────────────────
DefaultSizeStyle.setDefaultValue("m");
DefaultDashStyle.setDefaultValue("solid");
DefaultFillStyle.setDefaultValue("none");

// ── Restricted items ───────────────────────────────────────
const BRAND_COLORS = [
  { value: "black", icon: "color" },
  { value: "green", icon: "color" },
  { value: "grey", icon: "color" },
];

const ALLOWED_DASHES = [
  { value: "solid", icon: "dash-solid" },
  { value: "dashed", icon: "dash-dashed" },
];

// ── Custom pickers ─────────────────────────────────────────
function BrandColorPicker() {
  const { styles } = useStylePanelContext();
  const color = styles.get(DefaultColorStyle);
  if (color === undefined) return null;
  return (
    <StylePanelButtonPickerInline
      title="Color"
      uiType="color"
      style={DefaultColorStyle}
      items={BRAND_COLORS}
      value={color}
    />
  );
}

function BrandDashPicker() {
  const { styles } = useStylePanelContext();
  const dash = styles.get(DefaultDashStyle);
  if (dash === undefined) return null;
  return (
    <StylePanelButtonPickerInline
      title="Dash"
      uiType="dash"
      style={DefaultDashStyle}
      items={ALLOWED_DASHES}
      value={dash}
    />
  );
}

// ── Custom style panel ─────────────────────────────────────
function CustomStylePanelContent() {
  return (
    <Toolbar.Root>
      <StylePanelSection>
        <BrandColorPicker />
      </StylePanelSection>
      <StylePanelSection>
        <BrandDashPicker />
      </StylePanelSection>
      <StylePanelSection>
        <StylePanelFontPicker />
        <StylePanelTextAlignPicker />
      </StylePanelSection>
      <StylePanelSection>
        <StylePanelArrowheadPicker />
        <StylePanelSplinePicker />
      </StylePanelSection>
    </Toolbar.Root>
  );
}

const components: Partial<TLUiComponents> = {
  StylePanel: (props) => (
    <DefaultStylePanel {...props}>
      <CustomStylePanelContent />
    </DefaultStylePanel>
  ),
};

// ── Main component ─────────────────────────────────────────
interface SketchCanvasProps {
  initialSnapshot?: unknown;
  onEditorReady?: (editor: Editor) => void;
}

export function SketchCanvas({
  initialSnapshot,
  onEditorReady,
}: SketchCanvasProps) {
  const editorRef = useRef<Editor | null>(null);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      // Enable grid by default
      editor.updateInstanceState({ isGridMode: true });

      // Constrain drawing area to fixed bounds
      editor.setCameraOptions({
        ...editor.getCameraOptions(),
        constraints: {
          bounds: { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT },
          padding: { x: 16, y: 16 },
          origin: { x: 0.5, y: 0.5 },
          initialZoom: "fit-max",
          baseZoom: "fit-max",
          behavior: "contain",
        },
      });

      if (initialSnapshot) {
        try {
          loadSnapshot(
            editor.store,
            initialSnapshot as Parameters<typeof loadSnapshot>[1]
          );
        } catch {
          // Ignore snapshot loading errors on version mismatch
        }
      }
      onEditorReady?.(editor);
    },
    [initialSnapshot, onEditorReady]
  );

  return (
    <div className="h-full w-full">
      <Tldraw onMount={handleMount} components={components} />
    </div>
  );
}

export function getCanvasSnapshot(editor: Editor) {
  return getSnapshot(editor.store);
}

export async function getCanvasImageBase64(
  editor: Editor
): Promise<string | null> {
  const shapeIds = [...editor.getCurrentPageShapeIds()];
  if (shapeIds.length === 0) return null;

  // Temporarily disable grid so it doesn't appear in the exported image
  const wasGrid = editor.getInstanceState().isGridMode;
  if (wasGrid) editor.updateInstanceState({ isGridMode: false });

  const { blob } = await editor.toImage(shapeIds, {
    format: "png",
    background: true,
    scale: 1,
  });

  // Re-enable grid
  if (wasGrid) editor.updateInstanceState({ isGridMode: true });

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/png;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.readAsDataURL(blob);
  });
}
