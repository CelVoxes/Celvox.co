"use client";

import { useCallback, useEffect, useState } from "react";
import { SeamlessHeader } from "@/components/charts/SeamlessHeader";
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
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	Activity,
	BrainCircuit,
	Dna,
	FileSearch,
	FlaskConical,
	HelpCircle,
	Network,
	ShieldPlus,
	Sparkles,
	type LucideIcon,
} from "lucide-react";
export const description = "A collection of AML samples.";

const REFERENCE_DISEASE_OPTIONS: { value: ReferenceDiseaseId; label: string }[] = [
	{ value: "aml", label: "AML" },
	{ value: "ball", label: "B-ALL" },
	{ value: "tall", label: "T-ALL" },
];

type DashboardTab = {
	value: string;
	label: string;
	mobileLabel?: string;
	description: string;
	icon: LucideIcon;
};

type DashboardSection = {
	title: string;
	description: string;
	tabs: DashboardTab[];
};

type SetupStatus = {
	uploadedCount: number;
	harmonizedUploadedCount: number;
	totalHarmonizedColumns: number;
	isLoading: boolean;
};

export function Dashboard({ user }: { user: User | null }) {
	const [activeTab, setActiveTab] = useState("qc");
	const [selectedDiseases, setSelectedDiseases] = useState<ReferenceDiseaseId[]>([
		"aml",
	]);
	const [showOverview, setShowOverview] = useState(false);
	const [isSetupCollapsed, setIsSetupCollapsed] = useState(false);
	const [hasAutoCollapsedSetup, setHasAutoCollapsedSetup] = useState(false);
	const [setupStatus, setSetupStatus] = useState<SetupStatus>({
		uploadedCount: 0,
		harmonizedUploadedCount: 0,
		totalHarmonizedColumns: 0,
		isLoading: true,
	});
	const dashboardSections: DashboardSection[] = [
		{
			title: "Exploration",
			description:
				"Quality control and exploratory views for uploaded samples.",
			tabs: [
				{
					value: "qc",
					label: "QC Metrics",
					mobileLabel: "QC",
					description:
						"Read and expression quality checks for uploaded samples.",
					icon: Activity,
				},
				{
					value: "tsne",
					label: "t-SNE",
					mobileLabel: "t-SNE",
					description:
						"Projection views across mutation, expression and aberrations.",
					icon: Network,
				},
				{
					value: "knn",
					label: "KNN Report",
					mobileLabel: "KNN",
					description:
						"Nearest-neighbor reports across clinical and molecular signals.",
					icon: FileSearch,
				},
				{
					value: "deconvolution",
					label: "Deconvolution",
					mobileLabel: "Deconv",
					description:
						"Cell-state composition estimates from the uploaded RNA matrix.",
					icon: FlaskConical,
				},
			],
		},
		{
			title: "Reporting",
			description:
				"Evidence views for treatment context and summary workflows.",
			tabs: [
				{
					value: "drug",
					label: "Drug Response",
					mobileLabel: "Drug",
					description: "Ex-vivo response reference comparisons and heatmaps.",
					icon: ShieldPlus,
				},
			],
		},
		{
			title: "Diagnostics",
			description:
				"Clinical interpretation views and subtype-oriented diagnostics.",
			tabs: [
				{
					value: "cnv",
					label: "CNV",
					mobileLabel: "CNV",
					description: "Genome-wide copy-number style expression signal view.",
					icon: Dna,
				},
				{
					value: "hamlet",
					label: "HAMLET",
					mobileLabel: "HAMLET",
					description: "Acute leukemia diagnostic panels and subtype outputs.",
					icon: Sparkles,
				},
				{
					value: "molecular-prediction",
					label: "Molecular Prediction",
					mobileLabel: "Molecular",
					description:
						"Bridge-based molecular class prediction from raw RNA counts.",
					icon: BrainCircuit,
				},
			],
		},
		{
			title: "Intelligence",
			description: "LLM-assisted interpretation and report generation.",
			tabs: [
				{
					value: "ask-ai",
					label: "Artificial Intelligence",
					mobileLabel: "AI",
					description: "AI-generated summaries and follow-up analysis support.",
					icon: BrainCircuit,
				},
			],
		},
	];
	const handleSelectTab = (tabValue: string) => {
		setActiveTab(tabValue);
	};
	const selectedDiseaseLabel =
		selectedDiseases.length === 3
			? "Pan-Leukemia"
			: selectedDiseases
					.map(
						(d) =>
							REFERENCE_DISEASE_OPTIONS.find((option) => option.value === d)
								?.label ?? d.toUpperCase(),
					)
					.join(" + ");
	const navSectionsForDisplay = dashboardSections;
	const activeSection =
		dashboardSections.find((section) =>
			section.tabs.some((tab) => tab.value === activeTab),
		) ?? dashboardSections[0];
	const mobileQuickTabs = activeSection.tabs;
	const setupReady = setupStatus.uploadedCount > 0;
	const harmonizeComplete =
		setupReady &&
		setupStatus.harmonizedUploadedCount >= setupStatus.uploadedCount;

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
		setSelectedDiseases(getSelectedReferenceDiseases());

		const savedOverview = window.localStorage.getItem(
			"dashboard-overview-hidden",
		);
		if (savedOverview === "0") setShowOverview(true);
		if (savedOverview === "1") setShowOverview(false);
		const savedSetupCollapsed = window.localStorage.getItem(
			"dashboard-setup-collapsed",
		);
		if (savedSetupCollapsed === "1") setIsSetupCollapsed(true);
	}, []);

	useEffect(() => {
		window.localStorage.setItem(
			DASHBOARD_DISEASE_STORAGE_KEY,
			JSON.stringify(selectedDiseases),
		);
	}, [selectedDiseases]);

	useEffect(() => {
		window.localStorage.setItem(
			"dashboard-overview-hidden",
			showOverview ? "0" : "1",
		);
	}, [showOverview]);

	useEffect(() => {
		window.localStorage.setItem(
			"dashboard-setup-collapsed",
			isSetupCollapsed ? "1" : "0",
		);
	}, [isSetupCollapsed]);

	useEffect(() => {
		if (harmonizeComplete && !hasAutoCollapsedSetup) {
			setIsSetupCollapsed(true);
			setHasAutoCollapsedSetup(true);
		}
	}, [harmonizeComplete, hasAutoCollapsedSetup]);

	useEffect(() => {
		const onFocus = () => {
			void refreshSetupStatus();
		};
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [refreshSetupStatus]);

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return (
		<>
			{user && (
				<div className="space-y-6 h-full w-full">
					<Navbar />
					<section className="space-y-3">
						<div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="outline" className="font-medium">
										Help / Overview
									</Badge>
									<p className="text-sm text-muted-foreground">
										Quick guidance for new users and a summary of dashboard
										capabilities.
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setShowOverview((prev) => !prev)}
									className="gap-1.5"
								>
									<HelpCircle className="h-4 w-4" />
									{showOverview ? "Hide Overview" : "Show Overview"}
								</Button>
							</div>
						</div>
						{showOverview && <SeamlessHeader />}
					</section>
					<section className="space-y-3">
						<div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="outline" className="font-medium">
											Step 1
										</Badge>
										<h2 className="text-base font-semibold leading-tight">
											Prepare Your Data
										</h2>
									</div>
									<p className="mt-2 text-sm text-muted-foreground">
										Start by uploading raw counts, then harmonize selected
										samples before moving into diagnostics and downstream
										reports.
									</p>
									<div className="mt-3 flex flex-wrap gap-2">
										<Badge variant="outline" className="font-medium">
											{setupStatus.isLoading
												? "Checking setup status..."
												: !setupReady
													? "No uploaded samples yet"
													: harmonizeComplete
														? `Ready: ${setupStatus.uploadedCount} uploaded, all harmonized`
														: `Setup in progress: ${setupStatus.harmonizedUploadedCount}/${setupStatus.uploadedCount} harmonized`}
										</Badge>
									</div>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setIsSetupCollapsed((prev) => !prev)}
								>
									{isSetupCollapsed ? "Expand Setup" : "Collapse Setup"}
								</Button>
							</div>
							{setupStatus.totalHarmonizedColumns > 0 && (
								<div className="mt-2 text-xs text-muted-foreground">
									Harmonized cache contains {setupStatus.totalHarmonizedColumns}{" "}
									column{setupStatus.totalHarmonizedColumns === 1 ? "" : "s"}.
								</div>
							)}
						</div>
						{!isSetupCollapsed && (
							<div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
								<div className="min-w-0">
									<DataUpload
										embedded
										onDataChanged={() => void refreshSetupStatus()}
									/>
								</div>
								<div className="min-w-0">
									{setupReady ? (
										<HarmonizeData
											embedded
											diseases={selectedDiseases}
											onDiseasesChange={setSelectedDiseases}
											onDataChanged={() => void refreshSetupStatus()}
										/>
									) : (
										<Card className="border-border/60 shadow-none bg-background/70">
											<CardHeader>
												<CardTitle className="text-base">
													Harmonize Data
												</CardTitle>
												<CardDescription>
													Upload sample data first. This step becomes available
													after a count matrix is uploaded.
												</CardDescription>
											</CardHeader>
											<CardContent>
												<div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
													Waiting for uploaded samples.
												</div>
											</CardContent>
										</Card>
									)}
								</div>
							</div>
						)}
					</section>

					<section className="space-y-2">
						<div className="px-1 text-xs text-muted-foreground">
							Step 2: Analysis views ({selectedDiseaseLabel} context)
						</div>

					<div className="space-y-2">
						<Card className="lg:hidden border-border/70 shadow-sm">
							<CardContent className="p-3 space-y-3">
								<div className="space-y-1">
									<div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
										Navigate Analysis Views
									</div>
									<Select value={activeTab} onValueChange={handleSelectTab}>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Select dashboard view" />
											</SelectTrigger>
											<SelectContent>
											{navSectionsForDisplay.map((section) => (
													<div key={section.title}>
														<div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
															{section.title}
														</div>
													{section.tabs.map((tab) => (
														<SelectItem key={tab.value} value={tab.value}>
															{tab.label}
														</SelectItem>
													))}
												</div>
											))}
										</SelectContent>
									</Select>
								</div>
									<div className="flex flex-wrap gap-2">
										{mobileQuickTabs.map((tab) => (
											<button
												key={tab.value}
												type="button"
												onClick={() => handleSelectTab(tab.value)}
												className={cn(
													"rounded-full border px-3 py-1.5 text-xs font-medium leading-tight transition-colors",
													activeTab === tab.value
														? "bg-primary text-primary-foreground border-primary"
														: "bg-background text-foreground border-border/70 hover:bg-muted",
												)}
											>
												{tab.mobileLabel ?? tab.label}
											</button>
										))}
									</div>
							</CardContent>
						</Card>

						<Card className="hidden lg:block border-border/70 shadow-sm">
							<CardContent className="p-1.5">
								<nav className="space-y-1.5" aria-label="Dashboard sections">
									{navSectionsForDisplay.map((section) => {
										return (
											<div
												key={section.title}
												className="rounded-md border border-border/60 bg-background/40 px-2 py-1"
											>
												<div className="flex items-center gap-1.5">
													<div className="w-16 shrink-0 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
														{section.title}
													</div>
													<div className="flex flex-wrap gap-1">
														{section.tabs.map((tab) => {
															const Icon = tab.icon;
															const isActive = activeTab === tab.value;
															return (
																<button
																	key={tab.value}
																	type="button"
																	aria-current={isActive ? "page" : undefined}
																	onClick={() => handleSelectTab(tab.value)}
																	className={cn(
																		"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
																		isActive
																			? "border-primary bg-primary/10 text-primary"
																			: "border-border/70 bg-background hover:bg-muted",
																	)}
																>
																	<Icon className="h-2.5 w-2.5" />
																	<span>{tab.label}</span>
																</button>
															);
														})}
													</div>
												</div>
											</div>
										);
										})}
									</nav>
								</CardContent>
							</Card>
							<div className="min-w-0">
								<div className={activeTab === "qc" ? "" : "hidden"}>
									<QCCharts />
								</div>
								<div className={activeTab === "tsne" ? "" : "hidden"}>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<TSNEChart />
										<MutationTSNE />
										<GeneExpressionTSNE />
										<AberrationsTSNE />
									</div>
								</div>
								<div className={activeTab === "knn" ? "" : "hidden"}>
									<div className="grid grid-cols-1 md:grid-cols-1 gap-4">
										<TSNEKNNChart />
										<KNNReport />
										<KNNReportAberrations />
										<KNNReportMutation />
										<KNNReportExpression />
									</div>
								</div>

								<div className={activeTab === "deconvolution" ? "" : "hidden"}>
									<DeconvolutionChart />
								</div>
								<div className={activeTab === "drug" ? "" : "hidden"}>
									<p className="text-red-600 dark:text-red-500 font-medium text-center my-4 text-bold">
										Please be aware that these are based on{" "}
										<span className="italic">ex-vivo</span> drug responses and
										not recommendations.
									</p>
									<div className="grid grid-cols-1 gap-4">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<DrugResponseTSNE />
											<ClusterAssociationCard />
										</div>
										<DrugResponseHeatmap />
										<DrugEffectivenessReport />
									</div>
								</div>
								<div className={activeTab === "hamlet" ? "" : "hidden"}>
									<HamletDashboard />
								</div>
								<div className={activeTab === "cnv" ? "" : "hidden"}>
									<CNVChart />
								</div>
								<div
									className={
										activeTab === "molecular-prediction" ? "" : "hidden"
									}
								>
									<MolecularPredictionPanel />
								</div>
								<div className={activeTab === "ask-ai" ? "" : "hidden"}>
									<AIAMLReport />
								</div>
							</div>
						</div>
					</section>
				</div>
			)}
		</>
	);
}
