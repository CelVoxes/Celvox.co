"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DeconvolutionChart } from "@/components/charts/deconvolution";
import { TSNEChart } from "@/components/charts/tsne-chart";
import { DrugResponseTSNE } from "@/components/charts/tsne-drugresponse";
import { MutationTSNE } from "@/components/charts/tsne-mutation";
import { AberrationsTSNE } from "@/components/charts/tsne-aberrations";
import { DataUpload } from "@/components/data-upload/DataUpload";
import { GeneExpressionTSNE } from "@/components/charts/tsne-expression";
import { ClusterAssociationCard } from "@/components/charts/drugresponse-list";
import { HarmonizeData } from "@/components/charts/HarmonizeData";
import { TSNEKNNChart } from "@/components/charts/tsne-knn";
import { KNNReport } from "@/components/charts/knn-report";
import { KNNReportMutation } from "@/components/charts/knn-report-mutation";
import { DrugEffectivenessReport } from "@/components/charts/drug-effectiveness-report";
import { AIAMLReport } from "@/components/charts/AI-report";
import QCCharts from "@/components/charts/QCmetrics";
import { Navbar } from "../header/Navbar";
import { User } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { KNNReportExpression } from "@/components/charts/knn-report-expression";
import { KNNReportAberrations } from "@/components/charts/knn-report-aberrations";
import { DrugResponseHeatmap } from "@/components/charts/drug-response-per-group";
import { HamletDashboard } from "@/components/charts/HamletDashboard";
import { CNVChart } from "@/components/charts/cnv-chart";
import { MolecularPredictionPanel } from "@/components/charts/MolecularPrediction";
import { SampleDysregulationPanel } from "@/components/charts/SampleDysregulation";
import {
	DASHBOARD_SECTIONS,
	DASHBOARD_VIEW_REGISTRY,
	computeViewAvailability,
	type DashboardViewId,
	type ViewAvailability,
} from "@/config/dashboard-tools";
import { useCatalog } from "@/hooks/useCatalog";
import {
	DASHBOARD_DISEASE_STORAGE_KEY,
	type ReferenceDiseaseId,
	fetchHarmonizedDataNames,
	fetchSampleDataNames,
	getSelectedReferenceDiseases,
} from "@/utils/api";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Lock, Plus, X, Pencil, Compass, FlaskConical } from "lucide-react";

export const description = "A collection of leukemia reference samples.";

const ACTIVE_MODALITY = "rna_bulk";
const REFERENCE_COHORTS: { value: ReferenceDiseaseId; label: string }[] = [
	{ value: "aml", label: "AML" },
	{ value: "ball", label: "B-ALL" },
	{ value: "tall", label: "T-ALL" },
];

type Mode = "explore" | "analyze";
const CONTEXT_KEY = "seamless-analysis-context";
const TILES_KEY = "seamless-analysis-tiles";
const DEFAULT_COHORTS: ReferenceDiseaseId[] = ["aml"];
const DEFAULT_TILES: DashboardViewId[] = ["tsne", "deconvolution"];

type SetupStatus = {
	uploadedCount: number;
	harmonizedUploadedCount: number;
	totalHarmonizedColumns: number;
	isLoading: boolean;
};

const isViewId = (v: string): v is DashboardViewId => v in DASHBOARD_VIEW_REGISTRY;

function loadCohorts(): ReferenceDiseaseId[] {
	const stored = getSelectedReferenceDiseases();
	return stored.length ? stored : DEFAULT_COHORTS;
}
function loadMode(): Mode {
	try {
		const raw = window.localStorage.getItem(CONTEXT_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as { mode?: Mode };
			if (parsed.mode === "analyze" || parsed.mode === "explore") return parsed.mode;
		}
	} catch {
		/* ignore */
	}
	return "explore";
}
function loadTiles(): DashboardViewId[] {
	try {
		const raw = window.localStorage.getItem(TILES_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as string[];
			const valid = parsed.filter(isViewId);
			if (valid.length) return valid;
		}
	} catch {
		/* ignore */
	}
	return DEFAULT_TILES;
}

export function Dashboard({ user }: { user: User | null }) {
	const { catalog } = useCatalog();
	const [cohorts, setCohorts] = useState<ReferenceDiseaseId[]>(loadCohorts);
	const [mode, setMode] = useState<Mode>(loadMode);
	const [tiles, setTiles] = useState<DashboardViewId[]>(loadTiles);
	const [editOpen, setEditOpen] = useState(false);
	const [addOpen, setAddOpen] = useState(false);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [setupStatus, setSetupStatus] = useState<SetupStatus>({
		uploadedCount: 0,
		harmonizedUploadedCount: 0,
		totalHarmonizedColumns: 0,
		isLoading: true,
	});

	// Ready once ANY uploaded sample has been harmonized (users upload several
	// columns per sample but harmonize only the subset they select).
	const harmonizeComplete = setupStatus.harmonizedUploadedCount > 0;
	const cohortsKey = cohorts.join(",");

	// Persist context + keep the cohort selection in the key the chart components
	// read (DASHBOARD_DISEASE_STORAGE_KEY) so they fetch the right cohort's data.
	useEffect(() => {
		window.localStorage.setItem(
			DASHBOARD_DISEASE_STORAGE_KEY,
			JSON.stringify(cohorts),
		);
		window.localStorage.setItem(CONTEXT_KEY, JSON.stringify({ cohorts, mode }));
	}, [cohorts, mode]);

	useEffect(() => {
		window.localStorage.setItem(TILES_KEY, JSON.stringify(tiles));
	}, [tiles]);

	const refreshSetupStatus = useCallback(async () => {
		try {
			setSetupStatus((prev) => ({ ...prev, isLoading: true }));
			const [sampleNamesRaw, harmonizedNamesRaw] = await Promise.all([
				fetchSampleDataNames().catch(() => []),
				fetchHarmonizedDataNames().catch(() => []),
			]);
			const sampleNames = Array.isArray(sampleNamesRaw)
				? sampleNamesRaw.map(String)
				: [];
			const harmonizedNames = Array.isArray(harmonizedNamesRaw)
				? harmonizedNamesRaw.map(String)
				: [];
			const uploaded = sampleNames.slice(1);
			const harmonizedSet = new Set(harmonizedNames);
			const harmonizedUploadedCount = uploaded.filter((sample) => {
				const base = sample.replace(/_(unstranded|fwd|rev)$/i, "");
				return (
					harmonizedSet.has(sample) ||
					harmonizedSet.has(`${sample}_sample_data`) ||
					harmonizedSet.has(base) ||
					harmonizedSet.has(`${base}_sample_data`)
				);
			}).length;
			setSetupStatus({
				uploadedCount: uploaded.length,
				harmonizedUploadedCount,
				totalHarmonizedColumns: Math.max(0, harmonizedNames.length - 1),
				isLoading: false,
			});
		} catch {
			setSetupStatus((prev) => ({ ...prev, isLoading: false }));
		}
	}, []);

	useEffect(() => {
		void refreshSetupStatus();
	}, [refreshSetupStatus]);
	useEffect(() => {
		const onFocus = () => void refreshSetupStatus();
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [refreshSetupStatus]);

	const availability = useMemo(
		() =>
			computeViewAvailability(catalog, {
				modality: ACTIVE_MODALITY,
				cohorts,
				samplesReady: harmonizeComplete,
			}),
		[catalog, cohorts, harmonizeComplete],
	);
	const viewAvail = useCallback(
		(id: DashboardViewId): ViewAvailability =>
			availability[id] ?? { available: true, locked: false },
		[availability],
	);

	const cohortLabel =
		cohorts.length === REFERENCE_COHORTS.length
			? "Pan-Leukemia"
			: cohorts
					.map(
						(c) =>
							REFERENCE_COHORTS.find((o) => o.value === c)?.label ??
							c.toUpperCase(),
					)
					.join(" + ");

	const toggleCohort = (value: ReferenceDiseaseId) => {
		setCohorts((prev) => {
			if (prev.includes(value)) {
				const next = prev.filter((c) => c !== value);
				return next.length ? next : prev; // keep at least one
			}
			return [...REFERENCE_COHORTS.map((o) => o.value)].filter(
				(c) => prev.includes(c) || c === value,
			);
		});
	};

	const addTile = (id: DashboardViewId) =>
		setTiles((prev) => (prev.includes(id) ? prev : [...prev, id]));
	const removeTile = (id: DashboardViewId) =>
		setTiles((prev) => prev.filter((t) => t !== id));

	const onDrop = (target: number) => {
		setTiles((prev) => {
			if (dragIndex === null || dragIndex === target) return prev;
			const next = [...prev];
			const [moved] = next.splice(dragIndex, 1);
			next.splice(target, 0, moved);
			return next;
		});
		setDragIndex(null);
	};

	const dashboardPanels: Record<DashboardViewId, JSX.Element> = {
		qc: <QCCharts />,
		tsne: (
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<TSNEChart />
				<MutationTSNE />
				<GeneExpressionTSNE />
				<AberrationsTSNE />
			</div>
		),
		knn: (
			<div className="grid grid-cols-1 gap-4">
				<TSNEKNNChart />
				<KNNReport />
				<KNNReportAberrations />
				<KNNReportMutation />
				<KNNReportExpression />
			</div>
		),
		dysregulation: <SampleDysregulationPanel />,
		deconvolution: <DeconvolutionChart />,
		drug: (
			<>
				<p className="text-red-600 dark:text-red-500 font-medium text-center my-4">
					Please be aware that these are based on{" "}
					<span className="italic">ex-vivo</span> drug responses and not
					recommendations.
				</p>
				<div className="grid grid-cols-1 gap-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<DrugResponseTSNE />
						<ClusterAssociationCard />
					</div>
					<DrugResponseHeatmap />
					<DrugEffectivenessReport />
				</div>
			</>
		),
		cnv: <CNVChart />,
		hamlet: <HamletDashboard />,
		"molecular-prediction": <MolecularPredictionPanel />,
		"ask-ai": <AIAMLReport />,
	};

	if (!user) return <Navigate to="/login" replace />;

	return (
		<div className="space-y-5 h-full w-full">
			<Navbar />

			{/* Context bar — the live selection summary + editor */}
			<section className="space-y-3">
				<Card className="border-border/70 bg-card/60 shadow-sm">
					<CardContent className="p-4 space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex flex-wrap items-center gap-2 text-sm">
								<Badge variant="secondary" className="gap-1">
									<FlaskConical className="h-3 w-3" /> {cohortLabel}
								</Badge>
								<span className="text-muted-foreground">·</span>
								<Badge variant="outline">Bulk RNA-seq</Badge>
								<span className="text-muted-foreground">·</span>
								<Badge
									variant={mode === "explore" ? "secondary" : "default"}
									className="gap-1"
								>
									{mode === "explore" ? (
										<Compass className="h-3 w-3" />
									) : (
										<FlaskConical className="h-3 w-3" />
									)}
									{mode === "explore" ? "Explore reference" : "Analyze samples"}
								</Badge>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="gap-1.5"
								onClick={() => setEditOpen((p) => !p)}
							>
								<Pencil className="h-3.5 w-3.5" />
								{editOpen ? "Done" : "Edit selection"}
							</Button>
						</div>

						{editOpen && (
							<div className="space-y-4 rounded-lg border border-border/60 bg-background/50 p-4">
								<div className="grid gap-4 md:grid-cols-3">
									{/* Modality */}
									<div className="space-y-1.5">
										<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											Data type
										</div>
										<div className="flex flex-col gap-1.5">
											{(catalog.modalities ?? []).map((m) => {
												const available = m.status === "available";
												return (
													<button
														key={m.id}
														type="button"
														disabled={!available}
														className={cn(
															"flex items-center justify-between rounded-md border px-3 py-1.5 text-sm",
															m.id === ACTIVE_MODALITY
																? "border-primary bg-primary/10 text-primary"
																: "border-border/70",
															!available && "opacity-50 cursor-not-allowed",
														)}
													>
														<span>{m.label}</span>
														{!available && (
															<span className="text-[10px] uppercase">soon</span>
														)}
													</button>
												);
											})}
										</div>
									</div>

									{/* Cohorts */}
									<div className="space-y-1.5">
										<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											Reference cohorts
										</div>
										<div className="flex flex-col gap-1.5">
											{REFERENCE_COHORTS.map((o) => {
												const checked = cohorts.includes(o.value);
												return (
													<button
														key={o.value}
														type="button"
														onClick={() => toggleCohort(o.value)}
														className={cn(
															"flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
															checked
																? "border-primary bg-primary/10 text-primary"
																: "border-border/70 hover:bg-muted",
														)}
													>
														<span
															className={cn(
																"flex h-4 w-4 items-center justify-center rounded border",
																checked
																	? "border-primary bg-primary text-primary-foreground"
																	: "border-border",
															)}
														>
															{checked && <span className="text-[10px]">✓</span>}
														</span>
														{o.label}
													</button>
												);
											})}
										</div>
									</div>

									{/* Mode */}
									<div className="space-y-1.5">
										<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											Mode
										</div>
										<div className="flex flex-col gap-1.5">
											<button
												type="button"
												onClick={() => setMode("explore")}
												className={cn(
													"flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-left",
													mode === "explore"
														? "border-primary bg-primary/10 text-primary"
														: "border-border/70 hover:bg-muted",
												)}
											>
												<Compass className="h-4 w-4 shrink-0" />
												<span>
													Explore reference
													<span className="block text-[11px] text-muted-foreground">
														No upload needed
													</span>
												</span>
											</button>
											<button
												type="button"
												onClick={() => setMode("analyze")}
												className={cn(
													"flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-left",
													mode === "analyze"
														? "border-primary bg-primary/10 text-primary"
														: "border-border/70 hover:bg-muted",
												)}
											>
												<FlaskConical className="h-4 w-4 shrink-0" />
												<span>
													Analyze my samples
													<span className="block text-[11px] text-muted-foreground">
														Upload &amp; harmonize
													</span>
												</span>
											</button>
										</div>
									</div>
								</div>

								{mode === "analyze" && (
									<div className="grid grid-cols-1 gap-4 2xl:grid-cols-2 items-start border-t border-border/50 pt-4">
										<DataUpload
											embedded
											onDataChanged={() => void refreshSetupStatus()}
										/>
										<HarmonizeData
											embedded
											diseases={cohorts}
											onDiseasesChange={setCohorts}
											onDataChanged={() => void refreshSetupStatus()}
										/>
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>
			</section>

			{/* Builder toolbar */}
			<section className="flex items-center justify-between gap-3">
				<div className="text-sm text-muted-foreground">
					{tiles.length} {tiles.length === 1 ? "analysis" : "analyses"} on your
					workspace
				</div>
				<Button
					type="button"
					size="sm"
					className="gap-1.5"
					onClick={() => setAddOpen(true)}
				>
					<Plus className="h-4 w-4" />
					Add analysis
				</Button>
			</section>

			{/* Tiles */}
			{tiles.length === 0 ? (
				<Card className="border-dashed border-border/70 bg-muted/10">
					<CardContent className="py-16 text-center space-y-3">
						<p className="text-sm text-muted-foreground">
							Your workspace is empty. Add an analysis to start exploring the{" "}
							{cohortLabel} reference.
						</p>
						<Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
							<Plus className="mr-1.5 h-4 w-4" /> Add analysis
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{tiles.map((id, index) => {
						const entry = DASHBOARD_VIEW_REGISTRY[id];
						const avail = viewAvail(id);
						const Icon = entry.icon;
						return (
							<Card
								key={`${id}-${cohortsKey}`}
								draggable
								onDragStart={() => setDragIndex(index)}
								onDragOver={(e) => e.preventDefault()}
								onDrop={() => onDrop(index)}
								className="border-border/70 shadow-sm"
							>
								<CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
									<CardTitle className="flex items-center gap-2 text-base">
										<Icon className="h-4 w-4" />
										{entry.label}
										{avail.locked && (
											<Badge variant="outline" className="gap-1 text-[10px]">
												<Lock className="h-3 w-3" /> locked
											</Badge>
										)}
									</CardTitle>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-muted-foreground"
										onClick={() => removeTile(id)}
										title="Remove from workspace"
									>
										<X className="h-4 w-4" />
									</Button>
								</CardHeader>
								<CardContent>
									{avail.locked ? (
										<div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground space-y-3">
											<p>
												{avail.reason ??
													"This analysis runs on your uploaded samples."}
											</p>
											{mode === "explore" && (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => {
														setMode("analyze");
														setEditOpen(true);
													}}
												>
													Switch to Analyze &amp; upload samples
												</Button>
											)}
										</div>
									) : (
										dashboardPanels[id]
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			{/* Add-analysis palette */}
			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Add analysis</DialogTitle>
						<DialogDescription>
							Pick analyses for {cohortLabel} (Bulk RNA-seq). Locked ones need
							uploaded &amp; harmonized samples.
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
						{DASHBOARD_SECTIONS.map((section) => {
							const items = section.viewIds
								.map((id) => ({ id, avail: viewAvail(id) }))
								.filter((x) => x.avail.available);
							if (!items.length) return null;
							return (
								<div key={section.title} className="space-y-1.5">
									<div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
										{section.title}
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
										{items.map(({ id, avail }) => {
											const entry = DASHBOARD_VIEW_REGISTRY[id];
											const Icon = entry.icon;
											const added = tiles.includes(id);
											return (
												<button
													key={id}
													type="button"
													onClick={() => (added ? removeTile(id) : addTile(id))}
													className={cn(
														"flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm text-left transition-colors",
														added
															? "border-primary bg-primary/10"
															: "border-border/70 hover:bg-muted",
													)}
												>
													<span className="flex items-center gap-2">
														<Icon className="h-4 w-4 shrink-0" />
														<span>
															{entry.label}
															{avail.locked && (
																<span className="ml-1 inline-flex items-center text-[10px] text-muted-foreground">
																	<Lock className="mr-0.5 h-3 w-3" />
																	needs samples
																</span>
															)}
														</span>
													</span>
													{added ? (
														<span className="text-xs text-primary">Added ✓</span>
													) : (
														<Plus className="h-4 w-4 text-muted-foreground" />
													)}
												</button>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
