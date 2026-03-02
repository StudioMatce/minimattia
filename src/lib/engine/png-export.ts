import { Resvg } from "@resvg/resvg-js";

export function svgToPng(svgString: string, width = 2400): Buffer {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width" as const, value: width },
    font: {
      loadSystemFonts: true,
    },
  });

  const pngData = resvg.render();
  return pngData.asPng();
}
