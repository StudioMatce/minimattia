"use client";

interface DiagramPreviewProps {
  svgContent: string;
}

export function DiagramPreview({ svgContent }: DiagramPreviewProps) {
  return (
    <div className="flex items-center justify-center rounded-lg border bg-white p-8 overflow-auto min-h-[400px]">
      <div
        dangerouslySetInnerHTML={{ __html: svgContent }}
        className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[70vh]"
      />
    </div>
  );
}
