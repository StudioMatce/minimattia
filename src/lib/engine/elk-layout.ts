import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import type {
  DiagramGraph,
  DiagramNode,
  DiagramEdge,
  DiagramDirection,
} from "@/lib/types/diagram";
import type { BrandTheme } from "@/lib/types/brand";

const elk = new ELK();

export interface LayoutedNode extends DiagramNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutedEdge extends DiagramEdge {
  sections: Array<{
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    bendPoints?: Array<{ x: number; y: number }>;
  }>;
}

export interface LayoutResult {
  nodes: LayoutedNode[];
  edges: LayoutedEdge[];
  width: number;
  height: number;
}

const DIRECTION_MAP: Record<DiagramDirection, string> = {
  TB: "DOWN",
  BT: "UP",
  LR: "RIGHT",
  RL: "LEFT",
};

// ── Helpers ──────────────────────────────────────────────────────────

function getNodeSize(node: DiagramNode, theme: BrandTheme) {
  const w =
    node.type === "decision"
      ? theme.spacing.nodeWidth * 1.2
      : theme.spacing.nodeWidth;
  const h =
    node.type === "decision"
      ? theme.spacing.nodeHeight * 1.2
      : theme.spacing.nodeHeight;
  return { width: w, height: h };
}

/**
 * Detect if nodes form a non-linear layout.
 * Both axes must have significant spread for it to be non-linear.
 */
function hasNonLinearPositions(nodes: DiagramNode[]): boolean {
  const withPos = nodes.filter(
    (n) => n.x !== undefined && n.y !== undefined
  );
  if (withPos.length < 2) return false;

  const xs = withPos.map((n) => n.x!);
  const ys = withPos.map((n) => n.y!);

  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);

  // Both axes have meaningful spread → free-form layout
  const THRESHOLD = 100; // on a 0-1000 grid
  return xRange > THRESHOLD && yRange > THRESHOLD;
}

/**
 * Find the connection point on a node's border closest to a target point.
 */
function getConnectionPoint(
  node: LayoutedNode,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  const dx = targetX - cx;
  const dy = targetY - cy;
  const angle = Math.atan2(dy, dx);

  // Rectangular intersection
  const hw = node.width / 2;
  const hh = node.height / 2;

  const tanAngle = Math.abs(Math.tan(angle));
  let ix: number, iy: number;

  if (tanAngle <= hh / hw) {
    // Intersects left or right edge
    ix = cx + Math.sign(dx) * hw;
    iy = cy + Math.sign(dx) * hw * Math.tan(angle);
  } else {
    // Intersects top or bottom edge
    ix = cx + Math.sign(dy) * hh / Math.tan(angle);
    iy = cy + Math.sign(dy) * hh;
  }

  return { x: ix, y: iy };
}

// ── Direct layout (uses Claude's positions) ──────────────────────────

function computeDirectLayout(
  graph: DiagramGraph,
  theme: BrandTheme
): LayoutResult {
  const nodes = graph.nodes.filter((n) => n.type !== "group");
  const groups = graph.nodes.filter((n) => n.type === "group");

  const padding = theme.spacing.nodeGap;

  // Place nodes using tldraw positions directly (no scaling)
  const layoutedNodes: LayoutedNode[] = [];
  const nodeById = new Map<string, LayoutedNode>();

  for (const node of nodes) {
    const size = getNodeSize(node, theme);
    // x,y from tldraw is already the center position
    const cx = (node.x ?? 0) + padding;
    const cy = (node.y ?? 0) + padding;

    const ln: LayoutedNode = {
      ...node,
      x: cx - size.width / 2,
      y: cy - size.height / 2,
      width: size.width,
      height: size.height,
    };
    layoutedNodes.push(ln);
    nodeById.set(node.id, ln);
  }

  // Place group nodes (bounding box of their children)
  for (const group of groups) {
    const children = layoutedNodes.filter((n) => n.parentId === group.id);
    if (children.length === 0) continue;

    const gx = Math.min(...children.map((c) => c.x)) - 20;
    const gy = Math.min(...children.map((c) => c.y)) - 40;
    const gx2 = Math.max(...children.map((c) => c.x + c.width)) + 20;
    const gy2 = Math.max(...children.map((c) => c.y + c.height)) + 20;

    const ln: LayoutedNode = {
      ...group,
      x: gx,
      y: gy,
      width: gx2 - gx,
      height: gy2 - gy,
    };
    layoutedNodes.push(ln);
    nodeById.set(group.id, ln);
  }

  // Compute edges with bend/curve support
  const layoutedEdges: LayoutedEdge[] = graph.edges.map((edge) => {
    const src = nodeById.get(edge.source);
    const tgt = nodeById.get(edge.target);

    if (!src || !tgt) {
      return { ...edge, sections: [] };
    }

    const srcCx = src.x + src.width / 2;
    const srcCy = src.y + src.height / 2;
    const tgtCx = tgt.x + tgt.width / 2;
    const tgtCy = tgt.y + tgt.height / 2;

    const bend = edge.bend ?? 0;

    if (Math.abs(bend) > 5) {
      // Curved edge: compute a midpoint offset perpendicular to the line
      const midX = (srcCx + tgtCx) / 2;
      const midY = (srcCy + tgtCy) / 2;
      const dx = tgtCx - srcCx;
      const dy = tgtCy - srcCy;
      const len = Math.hypot(dx, dy) || 1;
      // Perpendicular direction, scaled by bend
      const perpX = -dy / len;
      const perpY = dx / len;
      // Scale bend proportionally (tldraw bend is in pixels, scale it)
      const scaledBend = bend * 0.5;
      const bendPoint = {
        x: midX + perpX * scaledBend,
        y: midY + perpY * scaledBend,
      };

      // Compute connection points aiming at the bend point
      const startPoint = getConnectionPoint(src, bendPoint.x, bendPoint.y);
      const endPoint = getConnectionPoint(tgt, bendPoint.x, bendPoint.y);

      return {
        ...edge,
        sections: [{ startPoint, endPoint, bendPoints: [bendPoint] }],
      };
    } else {
      // Straight edge
      const startPoint = getConnectionPoint(src, tgtCx, tgtCy);
      const endPoint = getConnectionPoint(tgt, srcCx, srcCy);
      return { ...edge, sections: [{ startPoint, endPoint }] };
    }
  });

  // Total dimensions
  const allRight = layoutedNodes.map((n) => n.x + n.width);
  const allBottom = layoutedNodes.map((n) => n.y + n.height);
  const totalWidth = Math.max(...allRight) + padding;
  const totalHeight = Math.max(...allBottom) + padding;

  return {
    nodes: layoutedNodes,
    edges: layoutedEdges,
    width: totalWidth,
    height: totalHeight,
  };
}

// ── ELK layout (for linear/sequential diagrams) ─────────────────────

async function computeElkLayout(
  graph: DiagramGraph,
  theme: BrandTheme
): Promise<LayoutResult> {
  const groupNodes = graph.nodes.filter((n) => n.type === "group");
  const regularNodes = graph.nodes.filter((n) => n.type !== "group");

  const childrenByParent = new Map<string | undefined, DiagramNode[]>();
  for (const node of regularNodes) {
    const parent = node.parentId;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent)!.push(node);
  }

  function buildElkChildren(parentId?: string): ElkNode[] {
    const children: ElkNode[] = [];
    const directChildren = childrenByParent.get(parentId) ?? [];

    for (const node of directChildren) {
      const size = getNodeSize(node, theme);
      children.push({
        id: node.id,
        width: size.width,
        height: size.height,
        labels: [{ text: node.label }],
      });
    }

    for (const group of groupNodes) {
      if (group.parentId === parentId) {
        children.push({
          id: group.id,
          labels: [{ text: group.label }],
          layoutOptions: {
            "elk.algorithm": "layered",
            "elk.padding": "[top=40,left=20,bottom=20,right=20]",
          },
          children: buildElkChildren(group.id),
        });
      }
    }

    return children;
  }

  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": DIRECTION_MAP[graph.direction],
      "elk.spacing.nodeNode": String(theme.spacing.nodeGap),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(
        theme.spacing.nodeGap * 1.5
      ),
      "elk.padding": `[top=${theme.spacing.nodePadding},left=${theme.spacing.nodePadding},bottom=${theme.spacing.nodePadding},right=${theme.spacing.nodePadding}]`,
      "elk.edgeRouting":
        theme.shapes.edgeStyle === "orthogonal"
          ? "ORTHOGONAL"
          : theme.shapes.edgeStyle === "bezier"
            ? "SPLINES"
            : "POLYLINE",
    },
    children: buildElkChildren(undefined),
    edges: graph.edges.map((edge, i) => ({
      id: edge.id || `e${i}`,
      sources: [edge.source],
      targets: [edge.target],
      labels: edge.label ? [{ text: edge.label }] : [],
    })),
  };

  const layouted = await elk.layout(elkGraph);

  const nodeMap = new Map<string, DiagramNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  const layoutedNodes: LayoutedNode[] = [];

  function extractNodes(
    elkNode: Record<string, unknown>,
    offsetX = 0,
    offsetY = 0
  ) {
    const children = elkNode.children as Record<string, unknown>[] | undefined;
    if (!children) return;

    for (const child of children) {
      const id = child.id as string;
      const x = (child.x as number) + offsetX;
      const y = (child.y as number) + offsetY;
      const width = child.width as number;
      const height = child.height as number;
      const original = nodeMap.get(id);

      if (original) {
        layoutedNodes.push({ ...original, x, y, width, height });
      }

      if (child.children) {
        extractNodes(child as Record<string, unknown>, x, y);
      }
    }
  }

  extractNodes(layouted as unknown as Record<string, unknown>);

  const edgeMap = new Map<string, DiagramEdge>();
  for (const edge of graph.edges) {
    edgeMap.set(edge.id, edge);
  }

  const layoutedEdges: LayoutedEdge[] = [];
  const elkEdges = (layouted as unknown as Record<string, unknown>)
    .edges as Record<string, unknown>[];

  if (elkEdges) {
    for (const elkEdge of elkEdges) {
      const id = elkEdge.id as string;
      const original = edgeMap.get(id);
      const sections =
        (elkEdge.sections as Array<{
          startPoint: { x: number; y: number };
          endPoint: { x: number; y: number };
          bendPoints?: Array<{ x: number; y: number }>;
        }>) ?? [];

      if (original) {
        layoutedEdges.push({ ...original, sections });
      }
    }
  }

  const totalWidth =
    (layouted as unknown as Record<string, number>).width ?? 0;
  const totalHeight =
    (layouted as unknown as Record<string, number>).height ?? 0;

  return {
    nodes: layoutedNodes,
    edges: layoutedEdges,
    width: totalWidth,
    height: totalHeight,
  };
}

// ── Public API ───────────────────────────────────────────────────────

export async function computeLayout(
  graph: DiagramGraph,
  theme: BrandTheme
): Promise<LayoutResult> {
  const regularNodes = graph.nodes.filter((n) => n.type !== "group");
  const hasPositions = regularNodes.some(
    (n) => n.x !== undefined && n.y !== undefined
  );

  // Use direct positioning when nodes have tldraw positions
  if (hasPositions) {
    return computeDirectLayout(graph, theme);
  }

  // Fall back to ELK for diagrams without position data (e.g. photo upload)
  return computeElkLayout(graph, theme);
}
