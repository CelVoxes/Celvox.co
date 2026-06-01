import { useState, useEffect, useMemo } from "react";
import { fetchDeconvolutionData, fetchSampleDataNames } from "@/utils/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, ExternalLink, Play, Search, Table2, Users } from "lucide-react";
import { DeconvolutionTable } from "@/components/charts/deconvolution-table";
import { DASHBOARD_TOOL_REGISTRY } from "@/config/dashboard-tools";

interface SampleData {
	[cellType: string]: number | string | undefined;
	_row: string;
	_source?: string;
	_subtype?: string;
	_disease?: string;
}

interface DeconvolutionData {
	[sampleId: string]: SampleData;
}

type Estimate = {
	cellType: string;
	percent: number;
	color: string;
};

const METADATA_KEYS = new Set(["_row", "_source", "_subtype", "_disease"]);
const BASE_COLORS = [
	"#2563eb",
	"#dc2626",
	"#16a34a",
	"#9333ea",
	"#ea580c",
	"#0891b2",
	"#ca8a04",
	"#db2777",
	"#4f46e5",
	"#059669",
	"#7c2d12",
	"#0f766e",
	"#a21caf",
	"#65a30d",
	"#be123c",
	"#0369a1",
	"#b45309",
	"#6d28d9",
	"#15803d",
	"#c2410c",
];
const OTHER_COLOR = "#94a3b8";
const DECONVOLUTION_TOOL = DASHBOARD_TOOL_REGISTRY.deconvolution;

function getCellTypes(rows: SampleData[]) {
	const keys = new Set<string>();
	rows.forEach((row) => {
		Object.keys(row).forEach((key) => {
			if (!METADATA_KEYS.has(key) && Number.isFinite(Number(row[key]))) {
				keys.add(key);
			}
		});
	});
	return Array.from(keys);
}

function toPercent(value: number | string | undefined) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed * 100 : 0;
}

function formatPercent(value?: number) {
	return Number.isFinite(value) ? `${value!.toFixed(1)}%` : "-";
}

function CompositionBar({ estimates }: { estimates: Estimate[] }) {
	return (
		<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
			{estimates.map((segment) => (
				<div
					key={segment.cellType}
					className="h-full flex-none"
					style={{
						width: `${Math.max(0, Math.min(100, segment.percent))}%`,
						backgroundColor: segment.color,
					}}
					title={`${segment.cellType}: ${formatPercent(segment.percent)}`}
				/>
			))}
		</div>
	);
}

export function DeconvolutionChart() {
	const [deconvolutionData, setDeconvolutionData] =
		useState<DeconvolutionData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingSamples, setIsLoadingSamples] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sampleOptions, setSampleOptions] = useState<string[]>([]);
	const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
	const [sampleFilter, setSampleFilter] = useState("");
	const [showAllSamples, setShowAllSamples] = useState(false);
	const { toast } = useToast();

	useEffect(() => {
		let cancelled = false;
		const loadSamples = async () => {
			setIsLoadingSamples(true);
			try {
				const names = await fetchSampleDataNames();
				const options = Array.isArray(names) ? names.slice(1).map(String) : [];
				if (!cancelled) {
					setSampleOptions(options);
					setSelectedSamples((prev) => (prev.length > 0 ? prev : options));
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load samples");
				}
			} finally {
				if (!cancelled) setIsLoadingSamples(false);
			}
		};
		void loadSamples();
		return () => {
			cancelled = true;
		};
	}, []);

	const rows = useMemo(
		() => (deconvolutionData ? Object.values(deconvolutionData) : []),
		[deconvolutionData]
	);
	const uploadedRows = useMemo(
		() => rows.filter((sample) => sample._source !== "reference"),
		[rows]
	);
	const cellTypes = useMemo(() => getCellTypes(rows), [rows]);
	const orderedCellTypes = useMemo(() => {
		if (uploadedRows.length === 0) return cellTypes;

		return [...cellTypes].sort((a, b) => {
			const totalA = uploadedRows.reduce(
				(sum, sample) => sum + toPercent(sample[a]),
				0
			);
			const totalB = uploadedRows.reduce(
				(sum, sample) => sum + toPercent(sample[b]),
				0
			);
			return totalB - totalA || a.localeCompare(b);
		});
	}, [cellTypes, uploadedRows]);
	const colorByCellType = useMemo(() => {
		return new Map(
			orderedCellTypes.map((cellType, index) => [
				cellType,
				BASE_COLORS[index % BASE_COLORS.length],
			])
		);
	}, [orderedCellTypes]);
	const selectedSampleSet = useMemo(
		() => new Set(selectedSamples),
		[selectedSamples]
	);
	const visibleSampleOptions = useMemo(() => {
		const query = sampleFilter.trim().toLowerCase();
		if (!query) return sampleOptions;
		return sampleOptions.filter((sample) => sample.toLowerCase().includes(query));
	}, [sampleFilter, sampleOptions]);

	const sampleSummaries = useMemo(() => {
		return uploadedRows.map((sample) => {
			const barEstimates = orderedCellTypes
				.map((cellType) => ({
					cellType,
					percent: toPercent(sample[cellType]),
					color: colorByCellType.get(cellType) ?? OTHER_COLOR,
				}))
				.filter((estimate) => estimate.percent > 0);
			const rankedEstimates = [...barEstimates].sort(
				(a, b) => b.percent - a.percent
			);

			return {
				sample: String(sample._row),
				dominant: rankedEstimates[0],
				barEstimates,
				rankedEstimates,
			};
		});
	}, [colorByCellType, orderedCellTypes, uploadedRows]);

	const displayedSamples = showAllSamples
		? sampleSummaries
		: sampleSummaries.slice(0, 8);
	const canRun =
		!isLoading &&
		!isLoadingSamples &&
		sampleOptions.length > 0 &&
		selectedSamples.length > 0;

	const handleRunDeconvolution = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await fetchDeconvolutionData(selectedSamples, false);
			if (data.error) throw new Error(data.error);

			setDeconvolutionData(data.deconvolution);
			setShowAllSamples(false);
			toast({
				title: "Deconvolution complete",
				description: data.message,
				duration: 5000,
			});
		} catch (error) {
			console.error("Failed to load deconvolution data:", error);
			setError("Failed to load deconvolution data. Please try again.");
			toast({
				title: "Error",
				description: "Failed to load deconvolution data. Please try again.",
				variant: "destructive",
				duration: 5000,
			});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card className="w-full h-full">
			<CardHeader className="space-y-2 p-4 sm:p-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<CardTitle>{DECONVOLUTION_TOOL.shortLabel}</CardTitle>
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							{DECONVOLUTION_TOOL.question}
						</p>
					</div>
					<Button
						onClick={handleRunDeconvolution}
						disabled={!canRun}
						className="w-full sm:w-auto"
					>
						<Play className="mr-2 h-4 w-4" />
						{isLoading ? "Running..." : DECONVOLUTION_TOOL.runLabel}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 p-4 sm:p-6">
				{error && (
					<p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
						{error}
					</p>
				)}

				<div className="rounded-lg border border-border/70 bg-background/70 p-4">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<h3 className="text-sm font-semibold">Samples</h3>
							<p className="mt-1 text-xs text-muted-foreground">
								Choose the uploaded samples to include in the summary.
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setSelectedSamples(sampleOptions)}
								disabled={sampleOptions.length === 0}
							>
								<Users className="mr-2 h-4 w-4" />
								All
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setSelectedSamples([])}
								disabled={selectedSamples.length === 0}
							>
								Clear
							</Button>
						</div>
					</div>

					<div className="mt-3 flex flex-wrap items-center gap-2">
						<Badge variant="secondary" className="font-medium">
							{selectedSamples.length} of {sampleOptions.length} selected
						</Badge>
						{isLoadingSamples && <Badge variant="outline">Loading samples</Badge>}
					</div>

					<div className="mt-3 space-y-3">
						{sampleOptions.length > 6 && (
							<div className="relative">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={sampleFilter}
									onChange={(event) => setSampleFilter(event.target.value)}
									placeholder="Filter uploaded samples"
									className="pl-9"
								/>
							</div>
						)}
						{sampleOptions.length === 0 && !isLoadingSamples ? (
							<div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
								No uploaded samples found. Upload count data before running
								deconvolution.
							</div>
						) : (
							<div className="grid max-h-48 gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
								{visibleSampleOptions.map((sample) => (
									<label
										key={sample}
										className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs"
									>
										<Checkbox
											checked={selectedSampleSet.has(sample)}
											onCheckedChange={(checked) => {
												setSelectedSamples((prev) =>
													checked
														? Array.from(new Set([...prev, sample]))
														: prev.filter((value) => value !== sample)
												);
											}}
										/>
										<span className="min-w-0 truncate">{sample}</span>
									</label>
								))}
							</div>
						)}
					</div>
				</div>

				<div className="rounded-lg border border-border/70 bg-background/70 p-4">
					<div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-md border bg-muted/20 p-3">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<div className="text-sm font-semibold">
									{DECONVOLUTION_TOOL.label}
								</div>
								{DECONVOLUTION_TOOL.repoUrl && (
									<a
										href={DECONVOLUTION_TOOL.repoUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
									>
										GitHub <ExternalLink className="h-3 w-3" />
									</a>
								)}
								{DECONVOLUTION_TOOL.docsUrl && (
									<a
										href={DECONVOLUTION_TOOL.docsUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
									>
										Docs <ExternalLink className="h-3 w-3" />
									</a>
								)}
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								{DECONVOLUTION_TOOL.description}
							</p>
						</div>
						<div className="flex flex-wrap gap-1">
							{DECONVOLUTION_TOOL.badges.map((badge, index) => (
								<Badge
									key={badge}
									variant={index === 0 ? "secondary" : "outline"}
									className="text-[10px]"
								>
									{badge}
								</Badge>
							))}
						</div>
					</div>

					<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<BarChart3 className="h-4 w-4 text-muted-foreground" />
								<h3 className="text-sm font-semibold">Composition summary</h3>
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								Same colors and segment order are used for every sample.
							</p>
						</div>
						{sampleSummaries.length > 8 && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setShowAllSamples((prev) => !prev)}
							>
								{showAllSamples ? "Show fewer" : "Show all samples"}
							</Button>
						)}
					</div>

					{!deconvolutionData ? (
						<div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
							Select samples and run deconvolution to view the composition
							summary.
						</div>
					) : sampleSummaries.length === 0 ? (
						<div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
							No uploaded sample rows were returned.
						</div>
					) : (
						<div className="space-y-5">
							<div className="grid gap-3 md:grid-cols-2">
								<div className="rounded-md border bg-card p-3">
									<div className="text-xs text-muted-foreground">Samples</div>
									<div className="text-2xl font-semibold">
										{sampleSummaries.length}
									</div>
								</div>
								<div className="rounded-md border bg-card p-3">
									<div className="text-xs text-muted-foreground">
										Estimated cell states
									</div>
									<div className="text-2xl font-semibold">
										{cellTypes.length}
									</div>
								</div>
							</div>

							<div className="space-y-2">
								{displayedSamples.map((summary) => (
									<div
										key={summary.sample}
										className="rounded-md border bg-card p-3"
									>
										<div className="grid gap-3 lg:grid-cols-[minmax(11rem,0.35fr)_minmax(0,1fr)] lg:items-center">
											<div className="min-w-0">
												<div className="truncate text-sm font-medium">
													{summary.sample}
												</div>
												<div className="mt-1 text-xs text-muted-foreground">
													{summary.dominant
														? `${summary.dominant.cellType} dominant (${formatPercent(
																summary.dominant.percent
															)})`
														: "No dominant estimate"}
												</div>
											</div>
											<div className="space-y-2">
												<CompositionBar estimates={summary.barEstimates} />
												<div className="flex flex-wrap gap-2">
													{summary.rankedEstimates.slice(0, 3).map((estimate) => (
														<div
															key={estimate.cellType}
															className="flex items-center gap-1.5 text-xs text-muted-foreground"
														>
															<span
																className="h-2.5 w-2.5 rounded-full"
																style={{ backgroundColor: estimate.color }}
															/>
															<span>{estimate.cellType}</span>
															<span>{formatPercent(estimate.percent)}</span>
														</div>
													))}
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{deconvolutionData && (
					<div className="rounded-lg border border-border/70 bg-background/70 p-4">
						<div className="mb-3 flex flex-wrap items-center gap-2">
							<Table2 className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-semibold">Detailed values</h3>
							<Badge variant="outline" className="font-medium">
								Uploaded samples only
							</Badge>
						</div>
						<div className="overflow-x-auto">
							<DeconvolutionTable data={deconvolutionData} />
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default DeconvolutionChart;
