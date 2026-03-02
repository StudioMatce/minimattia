import type { LayoutResult, LayoutedNode, LayoutedEdge } from "./elk-layout";
import type { BrandTheme } from "@/lib/types/brand";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRectNode(node: LayoutedNode, theme: BrandTheme): string {
  const rx =
    theme.shapes.nodeShape === "pill"
      ? node.height / 2
      : theme.shapes.nodeShape === "rounded"
        ? theme.spacing.borderRadius
        : 0;

  return `<g transform="translate(${node.x}, ${node.y})">
    <rect width="${node.width}" height="${node.height}" rx="${rx}"
      fill="${theme.colors.surface}" stroke="${theme.colors.primary}"
      stroke-width="${theme.shapes.nodeStrokeWidth}" />
    <text x="${node.width / 2}" y="${node.height / 2}"
      text-anchor="middle" dominant-baseline="central"
      font-family="${escapeXml(theme.typography.bodyFamily)}"
      font-size="${theme.typography.scale.body}"
      fill="${theme.colors.text}">${escapeXml(node.label)}</text>
  </g>`;
}

function renderDiamondNode(node: LayoutedNode, theme: BrandTheme): string {
  const cx = node.width / 2;
  const cy = node.height / 2;
  const points = `${cx},0 ${node.width},${cy} ${cx},${node.height} 0,${cy}`;

  return `<g transform="translate(${node.x}, ${node.y})">
    <polygon points="${points}"
      fill="${theme.colors.surface}" stroke="${theme.colors.accent}"
      stroke-width="${theme.shapes.nodeStrokeWidth}" />
    <text x="${cx}" y="${cy}"
      text-anchor="middle" dominant-baseline="central"
      font-family="${escapeXml(theme.typography.bodyFamily)}"
      font-size="${theme.typography.scale.caption}"
      fill="${theme.colors.text}">${escapeXml(node.label)}</text>
  </g>`;
}

function renderPillNode(
  node: LayoutedNode,
  theme: BrandTheme,
  fill: string
): string {
  return `<g transform="translate(${node.x}, ${node.y})">
    <rect width="${node.width}" height="${node.height}" rx="${node.height / 2}"
      fill="${fill}" stroke="${theme.colors.primary}"
      stroke-width="${theme.shapes.nodeStrokeWidth}" />
    <text x="${node.width / 2}" y="${node.height / 2}"
      text-anchor="middle" dominant-baseline="central"
      font-family="${escapeXml(theme.typography.bodyFamily)}"
      font-size="${theme.typography.scale.body}"
      fill="${theme.colors.background}">${escapeXml(node.label)}</text>
  </g>`;
}

function renderGroupZone(node: LayoutedNode, theme: BrandTheme): string {
  return `<g transform="translate(${node.x}, ${node.y})">
    <rect width="${node.width}" height="${node.height}" rx="${theme.spacing.borderRadius}"
      fill="${theme.colors.surface}" stroke="${theme.colors.border}"
      stroke-width="1" stroke-dasharray="4 4" opacity="0.5" />
    <text x="12" y="20"
      font-family="${escapeXml(theme.typography.headingFamily)}"
      font-size="${theme.typography.scale.caption}" font-weight="600"
      fill="${theme.colors.textSecondary}">${escapeXml(node.label)}</text>
  </g>`;
}

function renderNode(node: LayoutedNode, theme: BrandTheme): string {
  switch (node.type) {
    case "decision":
      return renderDiamondNode(node, theme);
    case "start":
      return renderPillNode(node, theme, theme.colors.primary);
    case "end":
      return renderPillNode(node, theme, theme.colors.accent);
    case "group":
      return renderGroupZone(node, theme);
    default:
      return renderRectNode(node, theme);
  }
}

function renderEdge(edge: LayoutedEdge, theme: BrandTheme): string {
  if (edge.sections.length === 0) return "";

  const section = edge.sections[0];
  const points = [
    section.startPoint,
    ...(section.bendPoints ?? []),
    section.endPoint,
  ];

  let d: string;
  // Use quadratic bezier curves when there are bend points (always, not just for "bezier" style)
  if (points.length >= 3) {
    d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      d += ` Q ${curr.x} ${curr.y} ${next.x} ${next.y}`;
    }
  } else {
    d = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
  }

  const dasharray = edge.type === "dashed" ? ' stroke-dasharray="6 4"' : "";
  const markerEnd =
    edge.type !== "line" ? ' marker-end="url(#arrowhead)"' : "";

  let labelSvg = "";
  if (edge.label && section.bendPoints && section.bendPoints.length > 0) {
    const mid = section.bendPoints[Math.floor(section.bendPoints.length / 2)];
    labelSvg = `<text x="${mid.x}" y="${mid.y - 8}"
      text-anchor="middle"
      font-family="${escapeXml(theme.typography.bodyFamily)}"
      font-size="${theme.typography.scale.caption}"
      fill="${theme.colors.textSecondary}">${escapeXml(edge.label)}</text>`;
  }

  return `<g>
    <path d="${d}" fill="none" stroke="${theme.colors.secondary}"
      stroke-width="${theme.shapes.edgeStrokeWidth}"${dasharray}${markerEnd} />
    ${labelSvg}
  </g>`;
}

export function renderDiagramToSvg(
  layout: LayoutResult,
  theme: BrandTheme
): string {
  const padding = 40;
  const width = layout.width + padding * 2;
  const height = layout.height + padding * 2;
  const arrowH = theme.shapes.arrowSize * 0.7;

  const groups = layout.nodes.filter((n) => n.type === "group");
  const regularNodes = layout.nodes.filter((n) => n.type !== "group");

  return `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="arrowhead"
      markerWidth="${theme.shapes.arrowSize}" markerHeight="${arrowH}"
      refX="${theme.shapes.arrowSize}" refY="${arrowH / 2}" orient="auto">
      <polygon points="0 0, ${theme.shapes.arrowSize} ${arrowH / 2}, 0 ${arrowH}"
        fill="${theme.colors.secondary}" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="${theme.colors.background}" />
  <g transform="translate(${padding}, ${padding})">
    ${groups.map((n) => renderNode(n, theme)).join("\n    ")}
    ${layout.edges.map((e) => renderEdge(e, theme)).join("\n    ")}
    ${regularNodes.map((n) => renderNode(n, theme)).join("\n    ")}
  </g>
</svg>`;
}
