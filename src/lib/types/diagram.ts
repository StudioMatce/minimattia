export type DiagramNodeType =
  | "process"
  | "decision"
  | "start"
  | "end"
  | "data"
  | "group";

export interface DiagramNode {
  id: string;
  label: string;
  type: DiagramNodeType;
  parentId?: string;
  metadata?: Record<string, string>;
  /** Approximate x position from sketch (0-1000 grid) */
  x?: number;
  /** Approximate y position from sketch (0-1000 grid) */
  y?: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: "arrow" | "line" | "dashed";
  /** Curvature from tldraw arrow bend (0 = straight) */
  bend?: number;
}

export type DiagramDirection = "TB" | "LR" | "BT" | "RL";
export type DiagramType = "flowchart" | "orgchart" | "process" | "mindmap";

export interface DiagramGraph {
  title?: string;
  diagramType: DiagramType;
  direction: DiagramDirection;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}
