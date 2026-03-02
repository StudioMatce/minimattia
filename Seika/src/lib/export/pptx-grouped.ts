import { toHex, ga, gn, font, accumT, parsePath } from "./svg-parse";
import type { AddPathFn, CoordFn, ScaleFn } from "./pptx-types";

export function processGroups(
  groups: Element[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slide: any, pres: any,
  vbW: number, vbH: number,
  tx: CoordFn, ty: CoordFn, ts: ScaleFn, tp: ScaleFn,
  _sc: number,
  addPath: AddPathFn
) {
  for (const g of groups) {
    const t = accumT(g);
    const rect = g.querySelector(":scope > rect");
    const poly = g.querySelector(":scope > polygon");
    const text = g.querySelector(":scope > text");
    const path = g.querySelector(":scope > path");

    if (rect && rect.getAttribute("width") !== "100%") {
      const rw = gn(rect, "width"), rh = gn(rect, "height");
      if (rw < 1 || rh < 1 || (rw >= vbW * 0.95 && rh >= vbH * 0.95)) continue;

      slide.addText(text?.textContent?.trim() || "", {
        shape: pres.ShapeType.roundRect,
        x: tx(t.x + gn(rect, "x")), y: ty(t.y + gn(rect, "y")),
        w: ts(rw), h: ts(rh),
        rectRadius: Math.min(ts(gn(rect, "rx")), ts(rh) / 2),
        fill: { color: toHex(ga(rect, "fill") || "#FFF"),
          transparency: Math.round((1 - parseFloat(ga(rect, "opacity") || "1")) * 100) },
        line: { color: toHex(ga(rect, "stroke") || "#000"),
          width: gn(rect, "stroke-width") || 1,
          dashType: ga(rect, "stroke-dasharray") ? "dash" : "solid" },
        fontSize: tp(gn(text, "font-size") || 14), fontFace: font(text),
        color: toHex(ga(text, "fill") || "#000"), align: "center", valign: "middle",
        bold: ga(text, "font-weight") === "600" || ga(text, "font-weight") === "bold",
      });
    } else if (poly) {
      const pts = ga(poly, "points").trim().split(/\s+/).map((p) => p.split(",").map(Number));
      if (pts.length < 3) continue;
      const xs = pts.map((c) => c[0]), ys = pts.map((c) => c[1]);
      const bx = Math.min(...xs), by = Math.min(...ys);
      const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
      if (bw < 15 && bh < 15) continue;

      slide.addText(text?.textContent?.trim() || "", {
        shape: pres.ShapeType.diamond,
        x: tx(t.x + bx), y: ty(t.y + by), w: ts(bw), h: ts(bh),
        fill: { color: toHex(ga(poly, "fill") || "#FFF") },
        line: { color: toHex(ga(poly, "stroke") || "#00A67D"),
          width: gn(poly, "stroke-width") || 1 },
        fontSize: tp(gn(text, "font-size") || 11), fontFace: font(text),
        color: toHex(ga(text, "fill") || "#000"), align: "center", valign: "middle",
      });
    } else if (path) {
      const cmds = parsePath(ga(path, "d"));
      if (cmds.length < 2) continue;
      addPath(cmds, accumT(g),
        toHex(ga(path, "stroke") || "#1C2D28"), gn(path, "stroke-width") || 1,
        !!ga(path, "stroke-dasharray"), !!ga(path, "marker-end"));

      const label = text?.textContent?.trim();
      if (label) {
        const off = accumT(g);
        slide.addText(label, {
          x: tx(off.x + gn(text, "x")) - 0.5,
          y: ty(off.y + gn(text, "y")) - 0.15,
          w: 1, h: 0.3,
          fontSize: tp(gn(text, "font-size") || 11), fontFace: font(text),
          color: toHex(ga(text, "fill") || "#666"), align: "center", valign: "middle",
        });
      }
    }
  }
}
