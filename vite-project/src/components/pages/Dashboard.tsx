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
import { SampleDysregulationPanel } from "@/components/charts/SampleDysregulation";
import {
	DASHBOARD_SECTIONS,
	DASHBOARD_VIEW_REGISTRY,
	DEFAULT_DASHBOARD_VIEW_ID,
	type DashboardViewId,
} from "@/config/dashboard-tools";
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
import { HelpCircle } from "lucide-react";
export const description = "A collection of AML samples.";

const REFERENCE_DISEASE_OPTIONS: { value: ReferenceDiseaseId; label: string }[] = [
	{ value: "aml", label: "AML" },
	{ value: "ball", label: "B-ALL" },
	{ value: "tall", label: "T-ALL" },
];

type SetupStatus = {
	uploadedCount: number;
	harmonizedUploadedCount: number;
	totalHarmonizedColumns: number;
	isLoading: boolean;
};

const dashboardSections = DASHBOARD_SECTIONS.map((section) => ({
	...section,
	tabs: section.viewIds.map((viewId) => DASHBOARD_VIEW_REGISTRY[viewId]),
}));
const dashboardViewIds = DASHBOARD_SECTIONS.flatMap((section) => section.viewIds);

const isDashboardViewId = (value: string): value is DashboardViewId =>
	value in DASHBOARD_VIEW_REGISTRY;

export function Dashboard({ user }: { user: User | null }) {
	const [activeTab, setActiveTab] = useState<DashboardViewId>(
		DEFAULT_DASHBOARD_VIEW_ID,
	);
	const [selectedDiseases, setSelectedDiseases] = useState<ReferenceDiseaseId[]>([
		"aml",
	]);
	const [showOverview, setShowOverview] = useState(false);
	const [setupStatus, setSetupStatus] = useState<SetupStatus>({
		uploadedCount: 0,
		harmonizedUploadedCount: 0,
		totalHarmonizedColumns: 0,
		isLoading: true,
	});
	const handleSelectTab = (tabValue: string) => {
		if (isDashboardViewId(tabValue)) {
			setActiveTab(tabValue);
		}
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
			section.tabs.some((tab) => tab.id === activeTab),
		) ?? dashboardSections[0];
	const mobileQuickTabs = activeSection.tabs;
	const setupReady = setupStatus.uploadedCount > 0;

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
		const onFocus = () => {
			void refreshSetupStatus();
		};
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [refreshSetupStatus]);

	const dashboardPanels = {
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
			<div className="grid grid-cols-1 md:grid-cols-1 gap-4">
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
				<p className="text-red-600 dark:text-red-500 font-medium text-center my-4 text-bold">
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
	} satisfies Record<DashboardViewId, JSX.Element>;

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
						<div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
							<DataUpload
								embedded
								onDataChanged={() => void refreshSetupStatus()}
							/>
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
														<SelectItem key={tab.id} value={tab.id}>
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
												key={tab.id}
												type="button"
												onClick={() => handleSelectTab(tab.id)}
												className={cn(
													"rounded-full border px-3 py-1.5 text-xs font-medium leading-tight transition-colors",
													activeTab === tab.id
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
															const isActive = activeTab === tab.id;
															return (
																<button
																	key={tab.id}
																	type="button"
																	aria-current={isActive ? "page" : undefined}
																	onClick={() => handleSelectTab(tab.id)}
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
								{dashboardViewIds.map((viewId) => (
									<div key={viewId} className={activeTab === viewId ? "" : "hidden"}>
										{dashboardPanels[viewId]}
									</div>
								))}
							</div>
						</div>
					</section>
				</div>
			)}
		</>
	);
}
