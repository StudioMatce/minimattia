# Seika Innovation — Illustration Design Specification

## Canvas
- viewBox: "0 0 900 600"
- Background: <rect> fill="${background}" covering full viewBox

### Content Area (inner padding 15%)
- The illustration content is drawn inside a padded area:
  - Left: 135px (15% of 900)
  - Right: 765px (900 - 135)
  - Top: 90px (15% of 600)
  - Bottom: 510px (600 - 90)
- Content area = 630 × 420 px
- Center the illustration within this area
- Decorative elements (dots, background circles) can extend into the padding zone

## Color Palette
- background: #EBEEE4 (light) / #1C2D28 (dark)
- stroke: #1C2D28 (light) / #EBEEE4 (dark)
- accent: #00A67D (same in both modes)
- muted-text: #5A6B62 (light) / #8A9B92 (dark)

## Nodes

### Shape rule
- ALL nodes are ALWAYS <ellipse> elements — NEVER use <circle> or <rect>
- Circular nodes (round shapes in sketch): rx = ry (range 45-65) — they look like circles but use <ellipse>
- Elliptical nodes (oval shapes in sketch): rx != ry (rx: 60-120, ry: 40-80)
- PRESERVE the shape from the sketch: if the user drew a circle, keep it circular (rx=ry)

### Standard node (dashed outline, solid fill)
- stroke="${stroke}" stroke-width="1.2" stroke-dasharray="8 5" fill="${background}"
- Circular: rx = ry = 45-65, Elliptical: rx = 60-120, ry = 40-80
- The fill="${background}" is essential — it covers connections underneath

### Highlighted node (max 1 per diagram)
- Outer glow shape: rx/ry ~35% larger than inner, fill="url(#glow)"
- Inner shape: stroke="${accent}" stroke-width="1.5" fill="${background}"
- Text color: ${accent} instead of ${stroke}, font-weight="600"

### Solid node (variant)
- stroke="${stroke}" stroke-width="1.2" fill="${background}" (NO dasharray)

## Connections
All connections are <path> elements using elliptical arc commands, drawn BEFORE nodes in SVG order.
Nodes are drawn AFTER connections, so nodes with fill="${background}" cover any crossing.

### Path rule — ELLIPTICAL ARCS ONLY
- Use A (elliptical arc) for ALL connections. NEVER use straight H/V lines.
- Path format: d="M startX,startY A arcRx,arcRy 0 largeArc,sweep endX,endY"
- arcRx, arcRy: radii of the elliptical arc (controls curve shape)
- largeArc: 0 = minor arc, 1 = major arc
- sweep: 0 = counterclockwise (curves UP), 1 = clockwise (curves DOWN)
- x-rotation is always 0
- CURVATURE: arcRx should be ~half the horizontal distance between nodes.
  arcRy controls depth of the curve (40-80 for visible U-shaped bulge).
  Do NOT make arcRx too large — it flattens the arc into a near-straight line.

### Default line styles
- **Nodes: DASHED** outlines (stroke-dasharray="8 5")
- **Connections: SOLID** arcs (no dasharray)

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
- Endpoint calculation: find the point on the ellipse border in the direction of the arc
- For ellipse with center (cx, cy) and radii (rx, ry), the border point toward target (tx, ty) is:
  - angle = atan2(ty - cy, tx - cx)
  - borderX = cx + rx * cos(angle)
  - borderY = cy + ry * sin(angle)

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
4. Connections (<path> elements with arc commands) — BELOW nodes
5. Nodes (<ellipse> with fill="${background}" + <text>) — ON TOP, covering connections

This layering ensures connections that pass near nodes are hidden by the node's solid fill.

## Absolute Rules
- NEVER use <rect> for nodes
- NEVER use <circle> — ALL nodes are <ellipse> (even circular ones use rx=ry)
- ALL nodes have fill="${background}" — never fill="none"
- NEVER use straight lines (H, V, L) for connections — ONLY use A (elliptical arc) commands
- NEVER use C (cubic bezier) or Q (quadratic bezier) for connections
- NEVER add text/labels not present in the source data
- Maximum 1 highlighted node per diagram
- Nodes: DASHED outline, Connections: SOLID arc (default contrast)
- Decorative elements NEVER overlap with diagram content
- Decorative elements at full opacity, covering ~10% of total image surface
- Diagram content centered within the 15% padded content area
