/** Convert CSS/SVG color to 6-char hex (no #). */
export function toHex(color: string): string {
  if (!color || color === "none") return "FFFFFF";
  if (color.startsWith("#")) {
    const h = color.slice(1);
    if (h.length === 3)
      return h
        .split("")
        .map((c) => c + c)
        .join("")
        .toUpperCase();
    return h.padEnd(6, "0").slice(0, 6).toUpperCase();
  }
  const m = color.match(/rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m)
    return [m[1], m[2], m[3]]
      .map((n) => parseInt(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  return "000000";
}

/** Get attribute, checking both presentation attrs and inline style. */
export function ga(el: Element | null, name: string): string {
  if (!el) return "";
  return (
    el.getAttribute(name) ||
    el
      .getAttribute("style")
      ?.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`))?.[1]
      ?.trim() ||
    ""
  );
}

/** Get numeric attribute value. */
export function gn(el: Element | null, name: string): number {
  return parseFloat(ga(el, name)) || 0;
}

/** Extract first font family name. */
export function font(el: Element | null): string {
  return (ga(el, "font-family") || "Arial")
    .split(",")[0]
    .replace(/['"]/g, "")
    .trim();
}

/** Walk parent chain summing translate transforms. */
export function accumT(el: Element): { x: number; y: number } {
  let x = 0,
    y = 0;
  let cur: Element | null = el;
  while (cur && cur.tagName !== "svg") {
    const tf = cur.getAttribute("transform");
    if (tf) {
      const m = tf.match(/translate\(\s*([\d.-]+)[,\s]+([\d.-]+)\s*\)/);
      if (m) {
        x += parseFloat(m[1]);
        y += parseFloat(m[2]);
      }
    }
    cur = cur.parentElement;
  }
  return { x, y };
}

export interface PathCmd {
  type: "move" | "line" | "quad" | "cubic";
  x: number;
  y: number;
  cx1?: number;
  cy1?: number;
  cx2?: number;
  cy2?: number;
}

/** Parse SVG path d into structured commands with absolute coordinates. */
export function parsePath(d: string): PathCmd[] {
  const cmds: PathCmd[] = [];
  const raw = d.match(/[MLQCSHVAZ][^MLQCSHVAZ]*/gi);
  if (!raw) return cmds;

  let cx = 0,
    cy = 0;
  for (const r of raw) {
    const t = r[0];
    const n = r.slice(1).match(/-?[\d.]+/g)?.map(Number) || [];
    switch (t) {
      case "M":
        cx = n[0]; cy = n[1];
        cmds.push({ type: "move", x: cx, y: cy });
        break;
      case "L":
        cx = n[0]; cy = n[1];
        cmds.push({ type: "line", x: cx, y: cy });
        break;
      case "H":
        cx = n[0];
        cmds.push({ type: "line", x: cx, y: cy });
        break;
      case "V":
        cy = n[0];
        cmds.push({ type: "line", x: cx, y: cy });
        break;
      case "Q":
        cmds.push({ type: "quad", x: n[2], y: n[3], cx1: n[0], cy1: n[1] });
        cx = n[2]; cy = n[3];
        break;
      case "C":
        cmds.push({ type: "cubic", x: n[4], y: n[5],
          cx1: n[0], cy1: n[1], cx2: n[2], cy2: n[3] });
        cx = n[4]; cy = n[5];
        break;
    }
  }
  return cmds;
}

/** Check if a circle is a real node (not decorative/glow). */
export function isNodeCircle(el: Element): boolean {
  const r = gn(el, "r");
  if (r < 25) return false;
  const fill = ga(el, "fill");
  if (fill === "none" || fill.startsWith("url(")) return false;
  const opacity = parseFloat(ga(el, "opacity") || "1");
  if (opacity < 0.5) return false;
  return true;
}

/** Find text elements near a circle (matching cx/cy within radius). */
export function findTextsNear(
  circle: Element,
  allTexts: Element[]
): Element[] {
  const cx = gn(circle, "cx");
  const cy = gn(circle, "cy");
  const r = gn(circle, "r");
  return allTexts.filter((t) => {
    const tx = gn(t, "x");
    const ty = gn(t, "y");
    return Math.abs(tx - cx) < r * 0.8 && Math.abs(ty - cy) < r * 1.3;
  });
}
