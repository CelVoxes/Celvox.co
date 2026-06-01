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
import type { MolecularToolId } from "@/utils/api";

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

export const DEFAULT_DASHBOARD_VIEW_ID: DashboardViewId = "qc";

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

export type MolecularDashboardToolMetadata = {
  id: MolecularToolId;
  label: string;
  shortLabel?: string;
  repoUrl?: string;
  docsUrl?: string;
  diseaseScope?: string;
  supportedDiseases?: string[];
  description?: string;
  notes?: string;
};

export const MOLECULAR_TOOL_CONFIGS: MolecularDashboardToolMetadata[] = [
  {
    id: "bridge",
    label: "BRIDGE",
    shortLabel: "BRIDGE",
    diseaseScope: "aml",
    supportedDiseases: ["aml"],
    description: "Bayesian Ridge regression for integrated diagnostic gene expression in AML.",
  },
  {
    id: "amlmapr",
    label: "AML-MaPR",
    shortLabel: "AML-MaPR",
    repoUrl: "https://github.com/eonurk/AML-MaPR",
    diseaseScope: "aml",
    supportedDiseases: ["aml"],
    description: "Molecular profiling and risk stratification for AML.",
  },
  {
    id: "allcatchr",
    label: "ALLCatchR",
    shortLabel: "ALLCatchR",
    repoUrl: "https://github.com/ThomasBeder/ALLCatchR",
    diseaseScope: "ball",
    supportedDiseases: ["ball"],
    description: "B-ALL subtype classification using gene expression.",
  },
  {
    id: "allsorts",
    label: "ALLSorts",
    shortLabel: "ALLSorts",
    repoUrl: "https://github.com/Oshlack/ALLSorts",
    diseaseScope: "ball",
    supportedDiseases: ["ball"],
    description: "B-ALL subtype classification from RNA-seq data.",
  },
  {
    id: "tallsorts",
    label: "TALLSorts",
    shortLabel: "TALLSorts",
    repoUrl: "https://github.com/Oshlack/TALLSorts",
    diseaseScope: "tall",
    supportedDiseases: ["tall"],
    description: "T-ALL subtype classification from RNA-seq data.",
  },
];
