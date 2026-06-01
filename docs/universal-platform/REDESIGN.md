# Seamless → Universal Platform Redesign

Status: **Design / in progress** · Branch: `redesign/universal-platform`

Goal: turn Seamless from a bulk-RNA-seq *leukemia* tool into a modality- and
cohort-agnostic analysis platform, **product-grade** rather than merged into one
`plumber.R`. First milestone is a *refactor for extensibility* — no new cohort
is onboarded yet; instead the three existing diseases (AML, B-ALL, T-ALL) are
re-expressed as data-driven config so the next cohort/modality is "add a row,
not edit a switch."

Target modalities to support after this work: **bulk RNA-seq** (today),
**DNA methylation**, **variants (WGS/WES)**.

---

## 1. Where we are today

A single pipeline, keyed on a closed `disease` enum, with views layered on top.

```
upload (STAR counts) ─▶ harmonize vs disease reference (ComBat)
   ─▶ explore (t-SNE / KNN)  ─▶ deconvolution (seAMLess/MuSiC)
   ─▶ dysregulation / GSEA   ─▶ molecular prediction (Bridge, AMLmapR,
                                  ALLSorts, TALLSorts, ALLCatchR)
   ─▶ drug response / CNV / aberrations / HAMLET  ─▶ AI report
```

- **Backend:** `backend/plumber.R` — **3,565 lines**, every endpoint + all
  business logic. Four registries already extracted and sourced at the top:
  `data_registry.R`, `tools_registry.R`, `metadata_alignment_registry.R`
  (`MOLECULAR_TOOL_REGISTRY` lives inside `tools_registry.R`).
- **Frontend:** `vite-project/src/config/dashboard-tools.ts` (view + tool config),
  `vite-project/src/utils/api.tsx` (`DiseaseId` union, per-endpoint disease params).
- **Disease enum:** `aml | ball | tall | pan_leukemia`, defined in
  `normalize_disease_id()` (R) and `DiseaseId` (TS); `default = "aml"` is wired
  through nearly every endpoint and referenced ~128× in the frontend.

### Structural blockers to "universal"

| # | Blocker | Evidence |
|---|---------|----------|
| 1 | `disease` is a **closed enum** and conflates 3 concepts: reference cohort, biology, and tool/view applicability. | `normalize_disease_id` hardcodes 4 ids; `DiseaseId` union; `default="aml"` everywhere. |
| 2 | **No modality concept.** Pipeline hardwired to RNA counts + Ensembl + ComBat. | `input_modality` exists as a *string field* on tools but nothing branches on it; `ComBat_seq` is unconditional in `/harmonize-data`. |
| 3 | `pan_leukemia` is a **fake enum value** meaning "more than one selected." | `deriveDiseaseParam`: `if (diseases.length > 1) return "pan_leukemia"`. |
| 4 | Backend + frontend **tool catalogs are hand-duplicated and have drifted.** | Bridge: backend = pan-leukemia / official package; frontend = AML-only / "Bayesian Ridge regression". |
| 5 | **AML-only features render unconditionally.** Drug response, CNV, aberrations only exist under AML data, but those tabs show for any cohort. | `DATA_REGISTRY$disease$ball/tall` have only `metadata` + `training`; dashboard sections are static. |
| 6 | **Path resolution is migration cruft** — 3–4 fallback candidates per asset. | `TOOLS_REGISTRY` bundles list `tools_runtime/` + `tools/` + `data/tools/` + `data/...`. |
| 7 | **Monolith + AML branding baked in.** | `AIAMLReport`, `"You are an AML clinical research assistant"`, `seAMLess`, `description = "A collection of AML samples."` |
| 8 | **No reference-only exploration.** The whole dashboard is gated behind `setupReady = uploadedCount > 0`; you can't browse a cohort until you upload — even though the backend already serves reference data without upload. | `Dashboard.tsx:120,281`; backend already serves cohort t-SNE / drug response and `exampleTCGA` deconvolution (`plumber.R:1212`) with no upload. |

---

## 2. Target conceptual model

Replace the `disease` axis with three orthogonal, data-driven concepts plus an
explicit analysis context.

### 2.1 Modality
The *kind* of data. A registry entry, not a hardcoded branch. Each modality declares:
- **ingestion** — accepted file formats → a canonical representation (matrix/table).
- **feature space + identifier** — genes/Ensembl (RNA), CpG probes (methylation),
  variant loci/genes (variants).
- **QC metrics** — what "quality" means for this data type.
- **harmonization strategy** — RNA = `ComBat_seq`; methylation = its own (e.g.
  BMIQ/quantile); variants = overlay, no batch correction. **Harmonization
  becomes a capability a modality may or may not have**, not a mandatory step.
- **default capabilities** — which analyses are even meaningful.

Initial: `rna_bulk` (full), `methylation` (scaffold), `variants` (scaffold).

### 2.2 Cohort
A named, versioned **biology group** (e.g. AML, B-ALL, T-ALL) that *provides
datasets per modality*. **Recommended model (open Q1): a cohort is a biology
group, not a per-modality dataset** — "AML" is one cohort that can expose RNA,
methylation, and variant reference datasets. The analysis context is then
`(cohort(s) + chosen modality)`, and a cohort is only selectable for a modality
it actually provides. Each cohort carries:
- reference dataset(s) keyed by modality (counts/features + metadata),
- a **metadata-alignment spec** (today's `METADATA_ALIGNMENT_REGISTRY`, per cohort),
- descriptive biology tags (lineage, disease label) — **descriptive, never control-flow**,
- the **capabilities/datasets** it provides (drug response, aberrations, CNV ref, …).

### 2.3 Capability (≈ dashboard view / analysis)
QC, clustering, KNN, deconvolution, dysregulation, drug response, CNV, molecular
prediction, AI report. Each capability declares:
- **which modalities it supports**,
- **what cohort data it requires**,
- **its data requirement** — `reference_only` (runs on the cohort reference
  alone, no upload), `requires_samples` (needs uploaded data), or `both`
  (reference view by default, richer with uploaded samples).

A view renders only if the active `(modality, cohort[])` provides it → fixes
blocker #5 (no more AML-only tabs everywhere). The data-requirement axis drives
exploration mode (§2.6) and fixes blocker #8. Replaces the static
`DASHBOARD_SECTIONS`.

### 2.4 Tool
A model/analysis consuming one modality, applicable to a set of cohorts/biology.
**Single source of truth in the backend**, served to the frontend. Carries:
modality, applicable cohorts, required feature/identifier, output schema/kind,
asset resolution, `integrated` flag. Generalizes `MOLECULAR_TOOL_REGISTRY`.

### 2.5 Analysis context
Replaces the implicit "selected disease(s)." Every request carries
`{ modality, cohorts[] }` instead of `disease`/`diseases`. Multi-cohort selection
*within one modality* is the natural replacement for `pan_leukemia` (blocker #3).

### 2.6 Exploration vs Analysis modes
Two first-class entry points, distinguished by whether uploaded samples exist:

- **Explore (reference-only):** land → pick modality + cohort(s) → immediately
  browse the cohort's reference data and `reference_only`/`both` capabilities
  (cohort embedding, KNN landscape, drug-response/aberration maps, example-data
  deconvolution). **No upload required.** The backend already supports this; the
  blocker is purely the `setupReady` gate on the frontend.
- **Analyze (with upload):** upload samples → harmonize against the cohort →
  `requires_samples`/`both` capabilities project the user's samples onto the
  reference and run per-sample prediction.

The context grows a `samplesPresent` flag (derived, not user-set). Capabilities
are gated by `dataRequirement × samplesPresent`: `reference_only` always
available, `requires_samples` enabled once samples are uploaded + harmonized,
`both` shown in reference mode and enriched after upload. This replaces the
all-or-nothing `setupReady` gate.

---

## 3. Target backend architecture (layered)

Thin plumber routes over service layers. Split `plumber.R` into sourced modules.

```
backend/
  registry/            # single source of truth (data-driven config + resolvers)
    modalities.R       #   modality registry
    cohorts.R          #   cohort registry (was data_registry.R, generalized)
    tools.R            #   tool catalog (was tools_registry.R)
    capabilities.R     #   capability/view registry (drives dashboard)
    metadata_align.R   #   per-cohort metadata alignment (existing)
    resolve.R          #   ONE asset-resolution rule (kills 3–4 path fallbacks)
  ingest/              # file -> canonical representation, per modality
  harmonize/           # per-modality reference alignment + correction
  analysis/            # qc, embedding, knn, deconvolution, dysregulation, gsea
  predict/             # tool dispatch (generalize dispatch_molecular_prediction)
  report/              # AI report, parametrized by modality/cohort/biology
  api/                 # thin plumber endpoints: parse context -> service -> serialize
  context.R            # parse + validate {modality, cohorts[]} from req
```

- **Endpoints become adapters.** Each route parses `{modality, cohorts[]}`,
  validates against the registry, dispatches to a service, serializes. No
  business logic in the route body.
- **`/catalog` endpoint** serves modalities + cohorts + capabilities + tools as
  the single source of truth. Frontend fetches it instead of hardcoding.
- **Asset resolution:** one canonical runtime root (`tools_runtime/`, `data/`) +
  a documented deployment layout. Registries store *logical keys*; the resolver
  maps to the canonical root with at most one legacy fallback behind a retire flag.

---

## 4. Target frontend changes

- Delete the duplicated `MOLECULAR_TOOL_CONFIGS` and the hardcoded `DiseaseId`
  union; fetch `/catalog` at load and derive everything from it.
- `DASHBOARD_SECTIONS` / `DASHBOARD_VIEW_REGISTRY` become **capability-driven**:
  render views the active `(modality, cohort[])` actually supports.
- Selection UI: choose **modality** → choose one-or-more **cohorts** of that
  modality (replaces the leukemia-only disease picker + faked pan-leukemia).
- Retire AML branding in component names/strings (`AIAMLReport`, copy) behind a
  product-name pass (low priority, last).

---

## 5. Phased plan

Each phase is independently shippable and leaves `main` behavior intact for the
three existing diseases (regression-safe). Order is dependency-driven.

**Phase 0 — Foundations & guardrails** ✅ *delivered*
- Capture current behavior: `backend/tests/capture_golden.sh` snapshots the
  reference-level endpoints per cohort against a running backend, as the
  regression baseline (run after each phase and `git diff` the output).
- `backend/context.R` — additive, back-compatible `{modality, cohorts[]}` parser
  (`parse_analysis_context`); maps cohorts↔legacy disease ids, expands
  `pan_leukemia`, validates modality. Not yet wired into endpoints (Phase 3).
- `backend/catalog.R` + `GET /catalog` — descriptive platform catalog
  (modalities, cohorts, capabilities w/ `dataRequirement`, tools) derived from
  the existing registries. No behavior change; not consumed by frontend yet.
- Known follow-up: tool `supported_cohorts` still includes the legacy
  `pan_leukemia` pseudo-id (faithful to `MOLECULAR_TOOL_REGISTRY`); reconcile
  tool↔cohort applicability in Phase 1.

**Phase 1 — Registry layer = single source of truth** ✅ *delivered*
- `backend/cohorts.R` — `COHORT_REGISTRY` (biology-group descriptors: label,
  lineage, modalities) layered over `data_registry.R`; owns `list_known_cohorts`,
  `normalize_cohort_id`, and `cohort_datasets(cohort, modality)` (per-modality
  dataset lookup; today implicitly `rna_bulk`). Underlying `DATA_REGISTRY`
  storage unchanged (its modality-keyed restructure is deferred to Phase 4 to
  avoid rippling into every `plumber.R` caller before endpoints move).
- `backend/modalities.R` — `MODALITY_REGISTRY` (`rna_bulk` available;
  `methylation`/`variants` planned) + accessors.
- `backend/capabilities.R` — `CAPABILITY_REGISTRY` (views w/ `data_requirement`
  and `requires_cohort_data`); single source for the Phase 2 frontend.
- `backend/catalog.R` is now a **thin assembler** over those registries (no
  hardcoded lists). Tool `supported_cohorts` reconciled: the legacy
  `pan_leukemia` pseudo-id is dropped, leaving real cohorts
  (`amlmapr→aml`, `allsorts/allcatchr→ball`, `bridge→aml,ball,tall`, …).
  `provides` is now keyed per modality (`{rna_bulk: [...]}`).
- `backend/resolve.R` — one `resolve_asset()` rule (canonical roots first, legacy
  last, gated by `SEAMLESS_INCLUDE_LEGACY_PATHS`, default ON). Defined as the
  intended entry point; **existing resolvers are not yet routed through it** —
  that rewiring lands with Phase 3 so it can be golden-verified.
- Behavior preserved: the three existing registry files are untouched; new
  modules are additive + (catalog/context) not yet consumed by endpoints. Smoke
  test confirms context back-compat and that capability gating correctly blocks
  Drug/CNV for B-ALL/T-ALL.

**Phase 2a — Frontend consumes the catalog + exploration mode** ✅ *delivered*
- `api.tsx` — `PlatformCatalog` types (ids are `string`, not closed unions) +
  `fetchCatalog()`.
- `hooks/useCatalog.ts` — fetches `/catalog` once (module-cached) with a static
  fallback (`STATIC_FALLBACK_CATALOG`) so the UI never breaks if the endpoint is
  unavailable.
- `config/dashboard-tools.ts` — `computeViewAvailability(catalog, {modality,
  cohorts, samplesReady})` → per-view `{available, locked, reason}`
  (`DashboardViewId` is 1:1 with capability ids); `getReferenceCohortOptions`;
  the static fallback catalog.
- `Dashboard.tsx` — analysis views are now capability-gated: views unsupported by
  the selected cohort are **hidden** (Drug/CNV vanish for B-ALL/T-ALL),
  `requires_samples` views are shown **locked** with a reason until samples are
  harmonized, and `reference_only`/`both` views are explorable with no upload.
  Default landing view moved to Clustering (reference-explorable). Active tab
  auto-corrects when the current view becomes unavailable.
- Verified type-clean via `tsc` (no errors in changed files).

**Phase 2b — MolecularPrediction on catalog + green build** ✅ *delivered*
- Reworked `MolecularPrediction.tsx` to drive its tool list from the live
  `/molecular-tools` catalog (availability, labels, repo/docs, disease scope) +
  a small local `TOOL_PRESENTATION` map for the two UI-copy fields
  (`question`, `outputType`) the catalog doesn't carry. **Deleted
  `MOLECULAR_TOOL_CONFIGS` and `MolecularDashboardToolMetadata`** — the
  frontend/backend tool-catalog drift (blocker #4) is gone.
- Fixed the two pre-existing build errors (the `tool.question`/`tool.outputType`
  references, now resolved by the rework; and the `QCmetrics.tsx` chart-matrix
  result cast). **`npm run build` is green** (`tsc -b` clean + `vite build` ok).

**Phase 2c — catalog-driven selection UI** *(deferred, intentional)*
- Driving the cohort/modality **selection UI** from the catalog (replacing the
  closed `ReferenceDiseaseId` union in `Dashboard.tsx`/`HarmonizeData.tsx` and
  `getSelectedReferenceDiseases`/localStorage) is **no-op churn until a real new
  cohort exists** — today's three cohorts are correct and type-encoded, and the
  mechanism (`getReferenceCohortOptions` + open string ids in the catalog) is
  already in place. Do this as part of onboarding the first non-leukemia cohort
  (after Phase 4), when it actually pays off.

**Phase 3 — Backend layering**
- *Extraction half* ✅ *delivered.* The un-annotated business-logic helpers are
  pulled out of `plumber.R` (3579 → 2516 lines) into sourced service modules:
  `ingest.R`, `predict.R`, `analysis.R`, `metadata.R`, `reference.R`, `report.R`.
  The `#* @get/@post` endpoint handlers stay in `plumber.R` (plumber parses
  annotations from the main file). Pure code movement — verified behavior-
  identical (golden byte-match on `/catalog` + `/molecular-tools`; 200s across the
  AML session endpoints). Two constraints: modules are sourced `local = TRUE`
  (else they land in globalenv and can't see `plumber.R`'s helpers — a 500 on the
  first try); functions under an annotation are handlers, not helpers.
- *Rewiring half* (next): endpoints become thin adapters over the services;
  everything keyed on `{modality, cohorts[]}` via `context.R`, with `disease`
  accepted as a back-compat alias. Route the existing resolvers through
  `resolve.R`. This is the behavioral surface — golden-verified per endpoint group.

**Phase 4 — Modality abstraction proven**
- Make `rna_bulk` a first-class modality implementation behind the abstraction
  (no behavior change). Add **scaffolds** for `methylation` and `variants`
  (ingestion + harmonization + capability stubs) to validate the seams — full
  models land later when a dataset exists.

**Phase 5 — Cleanup / product polish**
- Retire `disease` aliases and legacy paths. AML branding pass. Docs + deploy
  layout update.

---

## 6. Open questions / ambiguities to resolve

1. **Cohort granularity (Q1):** confirm "cohort = biology group exposing datasets
   per modality" (recommended) vs. "cohort = one per-modality dataset." Affects
   selection UX and registry shape. *Proceeding with the recommended model unless
   you say otherwise.*
2. **Default context:** today everything defaults to `aml`. Universal system
   should either force an explicit modality+cohort selection or define a default
   per deployment. Which?
3. **Cross-cohort harmonization scope:** confirm multi-cohort (old pan-leukemia)
   is only valid *within a single modality*. (Assumed yes.)
4. **Methylation/variants harmonization semantics:** RNA uses `ComBat_seq`. What
   is "harmonize" for methylation (BMIQ? quantile?) and for variants (likely just
   reference overlay, no correction)? Needed before Phase 4 fills the scaffolds.
5. **Catalog typing on the frontend:** generate TS types from the served catalog
   schema, or hand-write a thin interface and treat ids as strings? (Recommend
   generated types to prevent drift.)
6. **AI report scope:** keep one parametrized prompt (modality/cohort-aware) or a
   per-capability prompt registry?
