import {
  toHex, ga, gn, font, accumT, parsePath,
  isNodeCircle, findTextsNear,
  type PathCmd,
} from "./svg-parse";
import { processGroups } from "./pptx-grouped";

type AddPathFn = (
  cmds: PathCmd[], off: { x: number; y: number },
  color: string, width: number, dashed: boolean, hasArrow: boolean
) => void;

export async function exportSvgToPptx(
  svgContent: string,
  fileName: string
): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const doc = new DOMParser().parseFromString(svgContent, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return;

  const vbStr =
    svg.getAttribute("viewBox") ||
    `0 0 ${svg.getAttribute("width") || 900} ${svg.getAttribute("height") || 600}`;
  const vb = vbStr.split(/[\s,]+/).map(Number);
  const vbW = vb[2], vbH = vb[3];

  const SW = 10, SH = 5.625;
  const sc = Math.min(SW / vbW, SH / vbH);
  const ox = (SW - vbW * sc) / 2, oy = (SH - vbH * sc) / 2;
  const tx = (v: number) => v * sc + ox;
  const ty = (v: number) => v * sc + oy;
  const ts = (v: number) => v * sc;
  const tp = (px: number) => Math.max(6, Math.round(px * sc * 72));

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  const slide = pres.addSlide();

  const bgRect = svg.querySelector(":scope > rect, defs ~ rect");
  slide.background = { color: toHex(ga(bgRect, "fill") || "#EBEEE4") };

  // Freeform path with curves for each connection
  const addPath: AddPathFn = (cmds, off, color, width, dashed, hasArrow) => {
    if (cmds.length < 2) return;

    // Collect all points in PPTX inches for bounding box
    const allX: number[] = [], allY: number[] = [];
    for (const c of cmds) {
      allX.push(tx(off.x + c.x)); allY.push(ty(off.y + c.y));
      if (c.cx1 !== undefined) { allX.push(tx(off.x + c.cx1)); allY.push(ty(off.y + c.cy1!)); }
      if (c.cx2 !== undefined) { allX.push(tx(off.x + c.cx2)); allY.push(ty(off.y + c.cy2!)); }
    }
    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minY = Math.min(...allY), maxY = Math.max(...allY);
    const w = Math.max(maxX - minX, 0.01), h = Math.max(maxY - minY, 0.01);

    // Points in inches relative to bounding box origin
    const rx = (v: number) => v - minX;
    const ry = (v: number) => v - minY;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points: any[] = [];
    for (const c of cmds) {
      const px = rx(tx(off.x + c.x)), py = ry(ty(off.y + c.y));
      if (c.type === "quad") {
        points.push({ x: px, y: py, curve: {
          type: "quadratic",
          x1: rx(tx(off.x + c.cx1!)), y1: ry(ty(off.y + c.cy1!)) } });
      } else if (c.type === "cubic") {
        points.push({ x: px, y: py, curve: {
          type: "cubic",
          x1: rx(tx(off.x + c.cx1!)), y1: ry(ty(off.y + c.cy1!)),
          x2: rx(tx(off.x + c.cx2!)), y2: ry(ty(off.y + c.cy2!)) } });
      } else {
        points.push({ x: px, y: py });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slide.addShape("custGeom" as any, {
      x: minX, y: minY, w, h, points,
      line: { color, width, dashType: dashed ? "dash" : "solid",
        endArrowType: hasArrow ? "triangle" : undefined },
      fill: { type: "none" },
    });
  };

  // Detect strategy
  const leafGroups = [...svg.querySelectorAll("g")].filter(
    (g) => !g.closest("defs") && !g.querySelector(":scope > g")
  );
  const groupsWithShapes = leafGroups.filter(
    (g) => g.querySelector(":scope > rect") || g.querySelector(":scope > polygon")
  );

  if (groupsWithShapes.length >= 2) {
    processGroups(leafGroups, slide, pres, vbW, vbH, tx, ty, ts, tp, sc, addPath);
  } else {
    processFlat(svg, slide, pres, tx, ty, ts, tp, addPath);
  }

  await pres.writeFile({ fileName });
}

function processFlat(
  svg: Element,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slide: any, pres: any,
  tx: (v: number) => number, ty: (v: number) => number,
  ts: (v: number) => number, tp: (px: number) => number,
  addPath: AddPathFn
) {
  const allTexts = [...svg.querySelectorAll("text")].filter(
    (t) => !t.closest("defs")
  );
  const usedTexts = new Set<Element>();

  // ── Connections FIRST (below nodes in z-order) ──

  for (const path of svg.querySelectorAll("path")) {
    if (path.closest("defs") || path.closest("marker")) continue;
    if (ga(path, "fill") && ga(path, "fill") !== "none") continue;
    const cmds = parsePath(ga(path, "d"));
    if (cmds.length < 2) continue;
    addPath(cmds, accumT(path),
      toHex(ga(path, "stroke") || "#1C2D28"), gn(path, "stroke-width") || 1,
      !!ga(path, "stroke-dasharray"), !!ga(path, "marker-end"));
  }

  for (const line of svg.querySelectorAll("line")) {
    if (line.closest("defs")) continue;
    const cmds: PathCmd[] = [
      { type: "move", x: gn(line, "x1"), y: gn(line, "y1") },
      { type: "line", x: gn(line, "x2"), y: gn(line, "y2") },
    ];
    addPath(cmds, { x: 0, y: 0 },
      toHex(ga(line, "stroke") || "#1C2D28"), gn(line, "stroke-width") || 1,
      !!ga(line, "stroke-dasharray"), !!ga(line, "marker-end"));
  }

  // ── Nodes AFTER connections ──

  for (const circle of svg.querySelectorAll("circle")) {
    if (circle.closest("defs") || circle.closest("marker")) continue;
    if (!isNodeCircle(circle)) continue;

    const cx = gn(circle, "cx"), cy = gn(circle, "cy"), r = gn(circle, "r");
    const d = ts(r * 2);
    const nearTexts = findTextsNear(circle, allTexts);
    nearTexts.forEach((t) => usedTexts.add(t));
    const label = nearTexts.map((t) => t.textContent?.trim()).filter(Boolean).join("\n");
    const ft = nearTexts[0] || null;

    slide.addText(label, {
      shape: pres.ShapeType.ellipse,
      x: tx(cx) - d / 2, y: ty(cy) - d / 2, w: d, h: d,
      fill: { color: toHex(ga(circle, "fill") || "#EBEEE4") },
      line: { color: toHex(ga(circle, "stroke") || "#1C2D28"),
        width: gn(circle, "stroke-width") || 1,
        dashType: ga(circle, "stroke-dasharray") ? "dash" : "solid" },
      fontSize: tp(gn(ft, "font-size") || 14), fontFace: font(ft),
      color: toHex(ga(ft, "fill") || "#1C2D28"),
      align: "center", valign: "middle",
      bold: ga(ft, "font-weight") === "600" || ga(ft, "font-weight") === "bold",
    });
  }

  for (const el of svg.querySelectorAll("ellipse")) {
    if (el.closest("defs") || el.closest("marker")) continue;
    const fill = ga(el, "fill");
    if (fill === "none" || fill.startsWith("url(")) continue;
    const ecx = gn(el, "cx"), ecy = gn(el, "cy");
    const rx = gn(el, "rx"), ry = gn(el, "ry");
    if (rx < 20 || ry < 20) continue;
    const w = ts(rx * 2), h = ts(ry * 2);
    slide.addText("", {
      shape: pres.ShapeType.ellipse,
      x: tx(ecx) - w / 2, y: ty(ecy) - h / 2, w, h,
      fill: { color: toHex(fill || "#EBEEE4") },
      line: { color: toHex(ga(el, "stroke") || "#1C2D28"),
        width: gn(el, "stroke-width") || 1,
        dashType: ga(el, "stroke-dasharray") ? "dash" : "solid" },
    });
  }

  // Orphan text
  for (const t of allTexts) {
    if (usedTexts.has(t) || t.closest("defs")) continue;
    const content = t.textContent?.trim();
    if (!content) continue;
    const pt = accumT(t);
    slide.addText(content, {
      x: tx(pt.x + gn(t, "x")) - 0.5, y: ty(pt.y + gn(t, "y")) - 0.12,
      w: 1, h: 0.25,
      fontSize: tp(gn(t, "font-size") || 12), fontFace: font(t),
      color: toHex(ga(t, "fill") || "#000"), align: "center", valign: "middle",
    });
  }
}
