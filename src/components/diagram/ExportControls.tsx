"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportControlsProps {
  svgContent: string;
  projectName?: string;
}

export function ExportControls({
  svgContent,
  projectName = "diagram",
}: ExportControlsProps) {
  function downloadSvg() {
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPng() {
    // Parse viewBox to get intended dimensions (width/height may be stripped)
    const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
    const vb = vbMatch ? vbMatch[1].split(/[\s,]+/).map(Number) : null;
    const svgW = vb ? vb[2] : 900;
    const svgH = vb ? vb[3] : 600;

    // Inject explicit width/height so the Image renders at the correct size
    const sized = svgContent.replace(
      /<svg([^>]*)>/,
      `<svg$1 width="${svgW}" height="${svgH}">`
    );

    const svgBlob = new Blob([sized], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = svgW * scale;
      canvas.height = svgH * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, svgW, svgH);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${projectName}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
    };

    img.src = url;
  }

  async function downloadPptx() {
    const { exportSvgToPptx } = await import("@/lib/export/svg-to-pptx");
    await exportSvgToPptx(svgContent, `${projectName}.pptx`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={downloadSvg}>
        <Download className="mr-2 h-4 w-4" />
        SVG
      </Button>
      <Button variant="outline" size="sm" onClick={downloadPng}>
        <Download className="mr-2 h-4 w-4" />
        PNG
      </Button>
      <Button variant="outline" size="sm" onClick={downloadPptx}>
        <Download className="mr-2 h-4 w-4" />
        PPTX
      </Button>
    </div>
  );
}
