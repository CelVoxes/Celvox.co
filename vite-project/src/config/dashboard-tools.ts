import type React from "react";
import {
  Activity,
  Microscope,
  Users,
  Layers,
  Pill,
  BarChart2,
  Search,
  Cpu,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import type { CapabilityDataRequirement, PlatformCatalog } from "@/utils/api";

export type DashboardViewId =
  | "qc"
  | "tsne"
  | "knn"
  | "dysregulation"
  | "deconvolution"
  | "drug"
  | "cnv"
  | "hamlet"
  | "molecular-prediction"
  | "ask-ai";

export type DashboardViewEntry = {
  id: DashboardViewId;
  label: string;
  mobileLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type DashboardSection = {
  title: string;
  viewIds: DashboardViewId[];
};

export const DASHBOARD_VIEW_REGISTRY: Record<DashboardViewId, DashboardViewEntry> = {
  qc: { id: "qc", label: "QC Metrics", mobileLabel: "QC", icon: Activity },
  tsne: { id: "tsne", label: "Clustering", mobileLabel: "t-SNE", icon: Microscope },
  knn: { id: "knn", label: "KNN Report", mobileLabel: "KNN", icon: Users },
  dysregulation: { id: "dysregulation", label: "Dysregulation", icon: AlertTriangle },
  deconvolution: { id: "deconvolution", label: "Deconvolution", icon: Layers },
  drug: { id: "drug", label: "Drug Response", mobileLabel: "Drug", icon: Pill },
  cnv: { id: "cnv", label: "CNV", icon: BarChart2 },
  hamlet: { id: "hamlet", label: "HAMLET", icon: Search },
  "molecular-prediction": { id: "molecular-prediction", label: "Molecular Prediction", mobileLabel: "Prediction", icon: Cpu },
  "ask-ai": { id: "ask-ai", label: "Ask AI", icon: MessageSquare },
};

export const DASHBOARD_SECTIONS: DashboardSection[] = [
  { title: "QC", viewIds: ["qc"] },
  { title: "Explore", viewIds: ["tsne", "knn"] },
  { title: "Cell", viewIds: ["deconvolution", "dysregulation"] },
  { title: "Genomic", viewIds: ["cnv", "hamlet"] },
  { title: "Clinical", viewIds: ["drug", "molecular-prediction"] },
  { title: "AI", viewIds: ["ask-ai"] },
];

// Default to a reference-explorable view (Clustering is `both`, so it works
// without upload) rather than an upload-gated one, supporting explore-first.
export const DEFAULT_DASHBOARD_VIEW_ID: DashboardViewId = "tsne";

export type DashboardToolEntry = {
  label: string;
  shortLabel: string;
  question: string;
  runLabel: string;
  repoUrl?: string;
  docsUrl?: string;
  description: string;
  badges: string[];
};

export const DASHBOARD_TOOL_REGISTRY: Record<string, DashboardToolEntry> = {
  deconvolution: {
    label: "seAMLess",
    shortLabel: "Cell Deconvolution",
    question: "What is the immune cell composition of your samples?",
    runLabel: "Run Deconvolution",
    repoUrl: "https://github.com/eonurk/seAMLess",
    description:
      "Estimates the relative abundance of immune and stromal cell types in bulk RNA-seq samples using reference-based deconvolution.",
    badges: ["RNA-seq", "Immune Profiling", "Bulk Deconvolution"],
  },
};

// --- Capability gating -------------------------------------------------------
// DashboardViewId values are intentionally 1:1 with backend capability ids, so
// the catalog's capabilities drive which views render. See backend/capabilities.R.

export type ViewAvailability = {
  available: boolean;
  locked: boolean;
  reason?: string;
};

export type ViewGatingContext = {
  modality: string;
  cohorts: string[];
  /** uploaded AND harmonized samples are present. */
  samplesReady: boolean;
};

function cohortProvides(
  catalog: PlatformCatalog,
  cohortId: string,
  modality: string,
): string[] {
  const cohort = catalog.cohorts.find((c) => c.id === cohortId);
  return cohort?.provides?.[modality] ?? [];
}

// Compute per-view availability from the catalog and the current selection.
// A view is hidden when its modality/cohort-data requirements aren't met, and
// shown-but-locked when it needs uploaded samples that aren't ready yet
// (reference_only / both views stay open so cohorts are explorable with no upload).
export function computeViewAvailability(
  catalog: PlatformCatalog,
  ctx: ViewGatingContext,
): Record<string, ViewAvailability> {
  const result: Record<string, ViewAvailability> = {};
  for (const cap of catalog.capabilities) {
    const supportsModality = cap.modalities.includes(ctx.modality);
    const cohortOk =
      cap.requires_cohort_data.length === 0 ||
      cap.requires_cohort_data.every((req) =>
        ctx.cohorts.some((cohortId) =>
          cohortProvides(catalog, cohortId, ctx.modality).includes(req),
        ),
      );
    const available = supportsModality && cohortOk;
    const locked =
      available &&
      cap.data_requirement === "requires_samples" &&
      !ctx.samplesReady;

    let reason: string | undefined;
    if (!available) {
      reason = supportsModality
        ? "Not available for the selected cohort"
        : "Not available for this data type";
    } else if (locked) {
      reason = "Upload and harmonize samples to use this view";
    }
    result[cap.id] = { available, locked, reason };
  }
  return result;
}

// Cohorts selectable for a modality: those that ship reference data for it.
export function getReferenceCohortOptions(
  catalog: PlatformCatalog,
  modality: string,
): { value: string; label: string }[] {
  return catalog.cohorts
    .filter((c) => c.modalities.includes(modality))
    .map((c) => ({ value: c.id, label: c.label }));
}

// --- Static fallback catalog -------------------------------------------------
// Mirrors backend/catalog.R for today's deployment so the UI keeps working if
// GET /catalog is unavailable (older backend). Kept deliberately minimal: only
// what gating needs. The live catalog supersedes this as soon as it resolves.
const RNA = "rna_bulk";
export const STATIC_FALLBACK_CATALOG: PlatformCatalog = {
  version: "0-fallback",
  modalities: [
    { id: RNA, label: "Bulk RNA-seq", status: "available" },
    { id: "methylation", label: "DNA Methylation", status: "planned" },
    { id: "variants", label: "Variants (WGS/WES)", status: "planned" },
  ],
  cohorts: [
    {
      id: "aml",
      label: "AML",
      modalities: [RNA],
      provides: {
        [RNA]: [
          "reference_expression",
          "metadata",
          "drug_response",
          "aberrations",
          "cnv_reference",
        ],
      },
    },
    {
      id: "ball",
      label: "B-ALL",
      modalities: [RNA],
      provides: { [RNA]: ["reference_expression", "metadata"] },
    },
    {
      id: "tall",
      label: "T-ALL",
      modalities: [RNA],
      provides: { [RNA]: ["reference_expression", "metadata"] },
    },
  ],
  capabilities: (
    [
      ["qc", "QC Metrics", "requires_samples", []],
      ["tsne", "Clustering", "both", []],
      ["knn", "KNN Report", "requires_samples", []],
      ["dysregulation", "Dysregulation", "requires_samples", []],
      ["deconvolution", "Deconvolution", "both", []],
      ["drug", "Drug Response", "both", ["drug_response"]],
      ["cnv", "CNV", "requires_samples", ["cnv_reference"]],
      ["hamlet", "HAMLET", "requires_samples", []],
      ["molecular-prediction", "Molecular Prediction", "requires_samples", []],
      ["ask-ai", "Ask AI", "both", []],
    ] as [string, string, CapabilityDataRequirement, string[]][]
  ).map(([id, label, data_requirement, requires_cohort_data]) => ({
    id,
    label,
    modalities: [RNA],
    data_requirement,
    requires_cohort_data,
  })),
  tools: [],
};

// Molecular prediction tools are served by the backend catalog
// (GET /molecular-tools) and consumed directly in MolecularPrediction.tsx; the
// previously-duplicated static MOLECULAR_TOOL_CONFIGS has been removed.
