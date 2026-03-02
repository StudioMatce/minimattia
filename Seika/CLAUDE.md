# Seika

## Business
**Client:** Small business consulting firm (consulenza aziendale), Italy
**Industry:** Business consulting, SMB, Italy

## User
**End user:** Business consultants at the firm
**Need:** Draw rough sketches of schemas, diagrams, slides, and visuals — and get back polished, brand-compliant versions automatically. No design skills needed. The system generates the final visual, not just a compliance report.

## Core Loop
1. Consultant draws a rough sketch (browser canvas or uploads a photo)
2. System understands structure and intent (nodes, connections, text, layout, visual type)
3. System generates a polished, on-brand visual using brand guidelines and templates
4. Consultant reviews, adjusts, exports

## Visual Types
- **Schemi/diagrammi:** Flowcharts, org charts, concept maps, process schemas
- **Illustrazioni di processi:** Visual explanations of methods and workflows
- **Slide:** Single slides for client presentations
- **Social/marketing:** Posts, banners, infographics

## Stack
| Tool | Role |
|------|------|
| Next.js | Frontend, Server Components default |
| Supabase | Database, auth, storage (brand assets, sketches, generated visuals) |
| Vercel | Hosting, edge functions |
| Inngest | Generation pipeline, async processing |
| shadcn + Tailwind | App UI (not the generated visuals) |
| tldraw | Embedded canvas for sketch input |
| Claude Vision | Sketch understanding — extract structure and intent |
| SVG/HTML rendering engine | Deterministic brand-compliant output for diagrams and slides |

## EIID

### Enrichment (data)
**Have:** Designer will prepare brand guidelines, templates, color palettes, typography specs, example visuals
**Missing:** Machine-readable brand rules (structured JSON), rendering templates per visual type, brand-consistent shape/icon library
**Connect:** Canvas state extraction (tldraw API → structured JSON), image upload → vision analysis, brand asset storage (Supabase Storage)

### Inference (patterns)
**Detect:** Sketch structure — nodes, connections, text labels, layout zones, hierarchy, content type
**Predict:** Visual type from sketch characteristics (diagram vs slide vs social)
**Flag:** Ambiguous elements that need clarification before generation

### Interpretation (insights)
**Surface:** "Here's what I understood from your sketch" — structured preview before final generation
**Frame as:** Interactive preview the consultant can adjust before exporting the final visual

### Delivery (reach)
**Channels:** Web app — canvas + generated preview side-by-side
**Triggers:** Sketch completed → generation triggered
**Timing:** Near-real-time preview (seconds), iterate, export when satisfied
**Export:** PNG, PDF, SVG, PPTX

## Build or Buy
**Buy:** Canvas (tldraw — open source), auth, hosting, storage (Supabase + Vercel — commodity)
**Enhance:** Sketch understanding — vision AI extracts structure, consultant confirms/adjusts before generation (human-in-the-loop)
**Build:** Brand rule engine (guidelines → constraints), sketch-to-structure pipeline (the AI core), structure-to-visual rendering engine (the generation core), rendering templates per visual type

## Technology Constraints
No package.json detected — new project. Constraints will be set on first install.

## Code Architecture
- No source file over 200 lines. Split by responsibility.
- One component per file. One utility per file.
- Colocation: tests next to source, types next to usage.
- Prefer composition over inheritance.
- If a module has two distinct modes, split into separate files.

## Design System
**Framework:** shadcn/ui + Tailwind CSS
**Token source:** globals.css
