# Architecture Decisions

### 2026-02-27 - Strategic Priorities

**Type:** decision
**Summary:** Classified all EIID elements by constraint type. The critical path is Brand Rule Engine → Visual Analysis → Correction Suggestions. Phase 1 automates foundation (storage, upload, color/typography checks). Phase 2 differentiates with brand-specific rules, logo checking, and AI correction suggestions. Phase 3 innovates with composition/style consistency via multimodal AI and before/after visual generation. Email notifications and pattern prediction deferred — no data or user volume to justify them yet.

**Automate:**
- Brand asset storage (Supabase Storage + metadata)
- Visual upload pipeline (file upload, image processing)
- Color compliance checking (extract colors, compare to palette)
- Typography detection (vision API, font matching)
- Compliance score (weighted sum of rule checks)
- Web app shell (Next.js + auth + dashboard)

**Differentiate:**
- Brand guidelines ingestion (structured input form, designer defines rules with validation)
- Logo usage checking (detection + brand-specific rules + human review)
- Correction suggestions (AI-generated, consultant-approved, human-in-the-loop)
- Confidence scoring (calibrated against designer feedback)
- Visual corpus curation (designer labels correct/incorrect examples)
- Near-real-time feedback (optimize analysis pipeline for speed)

**Innovate:**
- Machine-readable brand rule engine (design intent → JSON constraints — the foundation)
- Composition/style consistency (multimodal AI + brand context — the hard problem)
- Before/after visual generation (analysis → generation → brand compliance loop — defer to Phase 3)
- Designer feedback loop (corrections inform future analysis — defer until data exists)

### 2026-02-27 - EIID Validation Flags

**Type:** alignment-check
**Summary:** Five items in the EIID mapping need scope/expectation adjustment. "Designer will prepare" is a dependency not an asset — ingestion format must be defined. Composition drift and style consistency require multimodal AI, not rules. Before/after generation is Phase 3 scope. Mistake pattern prediction needs historical data. "Immediate" feedback should be "near-real-time" (2-10s).
**EIID Layer:** enrichment / inference / interpretation
**Action:** No blocking changes needed. Enrichment ingestion format is the first design decision when building Phase 1. Composition checking deferred to Phase 3. Before/after generation deferred to Phase 3. Update "immediate" to "near-real-time" in delivery expectations.

### 2026-02-27 - Phase 1 Scope Definition

**Type:** decision
**Summary:** Phase 1 delivers a working MVP: consultant uploads a visual, gets a compliance score with specific color and typography violations flagged. Designer configures brand rules through a structured UI. This validates the core loop before investing in harder problems (composition, generation).
**EIID Layer:** enrichment / inference / interpretation / delivery
**Action:** Build in this order: (1) Next.js + Supabase scaffolding with auth, (2) brand rule schema + designer input UI, (3) visual upload + storage, (4) color + typography analysis via vision API, (5) compliance score + violation list UI. Ship when consultants can upload → get feedback.

### 2026-02-27 - Pivot: From Compliance Tool to Generative Tool

**Type:** decision
**Summary:** Fundamental product redefinition. Mini Mattia is NOT a compliance/analysis tool that tells consultants "your visual is wrong." It IS a generative tool: consultant draws a rough sketch → system generates a polished, brand-compliant visual. The output is the finished visual, not a report. This changes every layer: Inference becomes sketch understanding (not violation detection), Interpretation becomes interactive preview (not fix list), Delivery becomes side-by-side canvas + generated output with export (not compliance scores). The compliance checking becomes an internal quality gate inside the generation pipeline, not a user-facing feature.
**EIID Layer:** all
**Action:** CLAUDE.md rewritten to reflect generative core loop. Previous compliance-focused phases are superseded. New phases below.

### 2026-02-27 - Revised Strategic Priorities (Post-Pivot)

**Type:** decision
**Summary:** Reclassified all elements for the generative product. Critical path is now: Brand Rule Engine → Sketch Understanding → Structure-to-Visual Rendering. The generation pipeline (sketch → structure → brand-compliant visual) is the product. Canvas input (tldraw) is open source — buy it. Sketch understanding via vision AI is the differentiator. Rendering templates per visual type are the innovation.

**Automate:**
- Canvas input (tldraw — open source, embed it)
- Image upload pipeline (file upload + storage)
- Brand asset storage (Supabase Storage + metadata)
- Web app shell (Next.js + Supabase auth)
- Export (PNG/PDF/SVG from rendered output)

**Differentiate:**
- Sketch understanding (vision AI extracts structure, consultant confirms before generation)
- Brand guidelines ingestion (designer defines rules via structured UI)
- Interactive preview (consultant adjusts the understood structure before final render)

**Innovate:**
- Brand rule engine (design intent → machine-readable constraints)
- Sketch-to-structure pipeline (rough input → structured JSON: elements, relationships, layout)
- Structure-to-visual rendering engine (structured JSON + brand tokens → polished output)
- Rendering templates per visual type (diagrams, slides, social, process illustrations)

### 2026-02-27 - Revised Phase Plan

**Type:** decision
**Summary:** Three phases, generative-first. Phase 1: sketch-to-diagram (most structured, most tractable). Phase 2: slides and social. Phase 3: process illustrations (hardest — may need AI image generation).
**EIID Layer:** all
**Action:** Phase 1 MVP: (1) Next.js + Supabase + auth, (2) tldraw canvas embedded, (3) brand rule schema + designer input UI, (4) sketch understanding via Claude Vision (extract nodes/connections/text → JSON), (5) SVG rendering engine with brand tokens for diagrams, (6) side-by-side preview + export. Ship when a consultant can sketch a flowchart and get a polished branded diagram back.
