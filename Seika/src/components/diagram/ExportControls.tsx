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
    // Client-side SVG to PNG conversion
    const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
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
    </div>
  );
}
