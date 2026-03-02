# Mini Mattia — Diagram Design Specification

## Canvas
- viewBox: "0 0 900 600"
- Background: <rect> fill="${background}" covering full viewBox

### Content Area (inner padding 15%)
- The diagram content is drawn inside a padded area:
  - Left: 135px (15% of 900)
  - Right: 765px (900 - 135)
  - Top: 90px (15% of 600)
  - Bottom: 510px (600 - 90)
- Content area = 630 × 420 px
- Center the diagram within this area
- Decorative elements (dots, background circles) can extend into the padding zone

## Color Palette
- background: #EBEEE4 (light) / #1C2D28 (dark)
- stroke: #1C2D28 (light) / #EBEEE4 (dark)
- accent: #00A67D (same in both modes)
- muted-text: #5A6B62 (light) / #8A9B92 (dark)

## Nodes

### Shape rule
- If the node has content (label, number, text) → use <circle>
- If the node is empty (no label) → use <ellipse>
- NEVER use <rect>

### Standard node (dashed outline, solid fill)
- stroke="${stroke}" stroke-width="1.2" stroke-dasharray="8 5" fill="${background}"
- Circle: r = 45-65 (scales with label length)
- Ellipse: rx = 80-120, ry = 55-75
- The fill="${background}" is essential — it covers connections that pass underneath

### Highlighted node (max 1 per diagram)
- Outer glow shape: r/rx/ry ~35% larger than inner, fill="url(#glow)"
- Inner shape: stroke="${accent}" stroke-width="1.5" fill="${background}"
- Text color: ${accent} instead of ${stroke}, font-weight="600"

### Solid node (variant)
- stroke="${stroke}" stroke-width="1.2" fill="${background}" (NO dasharray)

## Connections
All connections are <path> elements, drawn BEFORE nodes in SVG order.
Nodes are drawn AFTER connections, so nodes with fill="${background}" cover any crossing.

### Default line styles
- **Nodes: DASHED** outlines (stroke-dasharray="8 5")
- **Connections: SOLID** lines (no dasharray)

### Solid connection
- stroke="${stroke}" stroke-width="1.2" fill="none"
- With arrow: marker-end="url(#arrow)"

### Dashed connection
- stroke="${stroke}" stroke-width="1" stroke-dasharray="5 4" fill="none"

### Arrow marker (in <defs>)
```xml
<marker id="arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
  <path d="M 0 0 L 10 3 L 0 6" fill="none" stroke="${stroke}" stroke-width="1.2"/>
</marker>
```

### Connection endpoints
- Connections start and end exactly at the node border, NEVER inside or past it
- Horizontal: start at (fromCx + fromR, cy), end at (toCx - toR, cy)
- Vertical: start at (cx, fromCy + fromR), end at (cx, toCy - toR)
- For ellipses: use rx for horizontal, ry for vertical

### Path shape — STRAIGHT LINES with ROUNDED CORNERS
- Connections are always STRAIGHT (horizontal/vertical), NEVER curved or diagonal
- Straight line: "M x1 y1 L x2 y2"
- 90-degree turn with rounded corner (r = 8-12px):
  - H then V: "M x1 y1 L (xBend-r) y1 Q xBend y1 xBend (y1+r) L xBend y2"
  - V then H: "M x1 y1 L x1 (yBend-r) Q x1 yBend (x1+r) yBend L x2 yBend"
- NEVER use C (cubic bezier) commands
- NEVER use diagonal lines

## Typography
- Font: font-family="Aptos, sans-serif"
- Node label: font-size="14" font-weight="500" fill="${stroke}"
- Highlighted label: font-size="15" font-weight="600" fill="${accent}"
- Subtitle/description: font-size="10" fill="${muted-text}", positioned below the node
- All text: text-anchor="middle" dominant-baseline="central"
- Multi-line: split into separate <text> elements, 20px apart vertically

## Decorative Elements — Background Layer

Decorative elements create a subtle texture in the BACKGROUND of the image.
They can be placed ANYWHERE on the canvas (margins, gaps, inside the content area).
They must NEVER overlap with diagram elements (nodes, connections, text). Only fill empty space.

### Coverage rule
- Decorative elements should cover roughly 10% of the total image surface
- They are at FULL opacity (no opacity attribute) — they are real visual elements, not ghost overlays
- Keep them sparse and balanced — don't cluster them

### Dot markers (4-6 per diagram)
Scattered in empty areas, margins, and gaps. NEVER on top of nodes or connections.
Mix of:
- Solid accent: fill="${accent}" r="3"-"5.5"
- Solid stroke: fill="${stroke}" r="2.5"-"4"

### Dashed ring markers (2-3 per diagram)
Scattered in empty areas. NEVER on top of nodes or connections.
- fill="none" stroke="${accent}" or stroke="${stroke}" stroke-width="0.8" stroke-dasharray="3 3" r="7"-"12"

### Background circles (2-3 per diagram)
Large decorative circles placed in empty areas anywhere on the canvas. NEVER on top of nodes or connections.
- fill="none" stroke="${stroke}" stroke-width="0.6" stroke-dasharray="4 4" opacity="0.25"
- r: 35-50

## Glow Gradient (in <defs>)
```xml
<radialGradient id="glow" cx="50%" cy="50%" r="50%">
  <stop offset="0%" stop-color="#00A67D" stop-opacity="0.30"/>
  <stop offset="60%" stop-color="#00A67D" stop-opacity="0.08"/>
  <stop offset="100%" stop-color="#00A67D" stop-opacity="0"/>
</radialGradient>
```

## SVG Structure Order (layering)
1. <defs> (arrow marker, glow gradient)
2. Background <rect>
3. Decorative elements — BEHIND everything
4. Connections (<path> elements) — BELOW nodes
5. Nodes (<circle>/<ellipse> with fill="${background}" + <text>) — ON TOP, covering connections

This layering ensures connections that pass near nodes are hidden by the node's solid fill.

## Absolute Rules
- NEVER use <rect> for nodes
- Circle for nodes WITH content, ellipse for EMPTY nodes
- ALL nodes have fill="${background}" — never fill="none"
- NEVER use curved lines (C bezier) — only straight H/V lines with rounded Q corners
- NEVER use diagonal lines
- NEVER add text/labels not present in the source data
- Maximum 1 highlighted node per diagram
- Nodes: DASHED outline, Connections: SOLID line (default contrast)
- Decorative elements NEVER overlap with diagram content
- Decorative elements at full opacity, covering ~10% of total image surface
- Diagram content centered within the 15% padded content area
