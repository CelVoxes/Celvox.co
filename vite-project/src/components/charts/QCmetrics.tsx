import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Chart, ScriptableContext, TooltipItem } from "chart.js/auto";
import { interpolateViridis } from "d3-scale-chromatic";
import "chartjs-chart-matrix";
import {
	BoxPlotController,
	BoxAndWiskers,
} from "@sgratzl/chartjs-chart-boxplot";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";
import { fetchQCMetrics } from "@/utils/api";

// Register all required components
Chart.register(
	BoxPlotController,
	BoxAndWiskers,
	MatrixController,
	MatrixElement
);

interface SampleStats {
	sample_id: string;
	lib_size: number;
	detected_genes: number;
	median_expression: number;
	mean_expression: number;
}

interface QCMetrics {
	sample_stats: SampleStats[];
	correlation_matrix: number[][];
	expression_quantiles: number[][]; // Changed from expression_stats
}

const toFiniteNumber = (value: unknown): number | null => {
	const num = typeof value === "number" ? value : Number(value);
	return Number.isFinite(num) ? num : null;
};

// Returns leaf ordering via UPGMA hierarchical clustering on correlation matrix
function clusterOrder(corr: number[][]): number[] {
	const n = corr.length;
	if (n <= 1) return [0];

	type Cluster = { indices: number[]; size: number };
	let clusters: Cluster[] = Array.from({ length: n }, (_, i) => ({ indices: [i], size: 1 }));
	// distance = 1 - correlation
	let d: number[][] = corr.map((row, i) => row.map((v, j) => (i === j ? 0 : 1 - v)));

	while (clusters.length > 1) {
		const m = clusters.length;
		let minD = Infinity, minI = 0, minJ = 1;
		for (let i = 0; i < m; i++)
			for (let j = i + 1; j < m; j++)
				if (d[i][j] < minD) { minD = d[i][j]; minI = i; minJ = j; }

		const merged: Cluster = {
			indices: [...clusters[minI].indices, ...clusters[minJ].indices],
			size: clusters[minI].size + clusters[minJ].size,
		};
		const ni = clusters[minI].size, nj = clusters[minJ].size;
		const remaining: number[] = [];
		for (let k = 0; k < m; k++) if (k !== minI && k !== minJ) remaining.push(k);

		const newDists = remaining.map(k => (ni * d[minI][k] + nj * d[minJ][k]) / (ni + nj));
		const newClusters = [...remaining.map(k => clusters[k]), merged];
		const nm = newClusters.length;
		const newD: number[][] = Array.from({ length: nm }, () => Array(nm).fill(0));
		for (let i = 0; i < remaining.length; i++)
			for (let j = 0; j < remaining.length; j++)
				newD[i][j] = d[remaining[i]][remaining[j]];
		for (let i = 0; i < remaining.length; i++) {
			newD[i][nm - 1] = newDists[i];
			newD[nm - 1][i] = newDists[i];
		}
		clusters = newClusters;
		d = newD;
	}
	return clusters[0].indices;
}

const normalizeCorrelationMatrix = (raw: unknown, size: number): number[][] => {
	const rows = Array.isArray(raw)
		? raw
		: raw && typeof raw === "object"
			? Object.values(raw as Record<string, unknown>)
			: [];

	const matrix: number[][] = [];
	for (let i = 0; i < size; i += 1) {
		const sourceRow = Array.isArray(rows[i]) ? (rows[i] as unknown[]) : [];
		const row: number[] = [];
		for (let j = 0; j < size; j += 1) {
			const parsed = toFiniteNumber(sourceRow[j]);
			const safe =
				parsed === null ? (i === j ? 1 : 0) : Math.max(-1, Math.min(1, parsed));
			row.push(safe);
		}
		matrix.push(row);
	}
	return matrix;
};

export function QCCharts() {
	const [qcData, setQCData] = useState<QCMetrics | null>(null);

	// Store chart instances
	const libSizeChartRef = useRef<Chart | null>(null);
	const boxplotChartRef = useRef<Chart | null>(null);
	const heatmapChartRef = useRef<Chart | null>(null);
	const genesDetectedChartRef = useRef<Chart | null>(null);

	// Store canvas refs
	const libSizeCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const boxplotCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const genesDetectedCanvasRef = useRef<HTMLCanvasElement | null>(null);

	// Cleanup function for charts
	const destroyCharts = () => {
		if (libSizeChartRef.current) {
			libSizeChartRef.current.destroy();
			libSizeChartRef.current = null;
		}
		if (boxplotChartRef.current) {
			boxplotChartRef.current.destroy();
			boxplotChartRef.current = null;
		}
		if (heatmapChartRef.current) {
			heatmapChartRef.current.destroy();
			heatmapChartRef.current = null;
		}
		if (genesDetectedChartRef.current) {
			genesDetectedChartRef.current.destroy();
			genesDetectedChartRef.current = null;
		}
	};

	// Fetch data
	useEffect(() => {
		const fetchData = async () => {
			try {
				const data = await fetchQCMetrics();
				if (!data.expression_quantiles) {
					console.error("Missing expression_quantiles in QC data");
					return;
				}
				setQCData(data);
			} catch (error) {
				console.error("Error fetching QC data:", error);
			}
		};
		fetchData();

		// Cleanup on unmount
		return () => {
			destroyCharts();
		};
	}, []);

	// Create charts
	useEffect(() => {
		if (!qcData) return;

		// Clean up existing charts
		destroyCharts();

		// Library Size Distribution
		if (libSizeCanvasRef.current) {
			const ctx = libSizeCanvasRef.current.getContext("2d");
			if (ctx) {
				libSizeChartRef.current = new Chart(ctx, {
					type: "bar",
					data: {
						labels: qcData.sample_stats.map((s) => s.sample_id),
						datasets: [
							{
								label: "Library Size",
								data: qcData.sample_stats.map((s) => s.lib_size),
								backgroundColor: "rgba(75, 192, 192, 0.6)",
							},
						],
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							title: {
								display: false,
								text: "Library Size Distribution",
							},
							legend: {
								display: false,
							},
						},
						scales: {
							y: {
								beginAtZero: true,
								title: {
									display: true,
									text: "Number of Reads",
								},
							},
						},
					},
				});
			}
		}

		// Expression Distribution (Box Plot)
		if (boxplotCanvasRef.current) {
			const ctx = boxplotCanvasRef.current.getContext("2d");
			if (ctx) {
				boxplotChartRef.current = new Chart(ctx, {
					type: "boxplot",
					data: {
						labels: qcData.sample_stats.map((s) => s.sample_id),
						datasets: [
							{
								label: "Expression Distribution",
								data: Array.from(
									{ length: qcData.expression_quantiles[0].length },
									(_, sampleIndex) => {
										const boxData = {
											min: qcData.expression_quantiles[0][sampleIndex],
											q1: qcData.expression_quantiles[1][sampleIndex],
											median: qcData.expression_quantiles[2][sampleIndex],
											q3: qcData.expression_quantiles[3][sampleIndex],
											max: qcData.expression_quantiles[4][sampleIndex],
										};
										return boxData;
									}
								),
								backgroundColor: "rgba(75, 192, 192, 0.6)",
								borderColor: "rgba(75, 192, 192, 1)",
								borderWidth: 1,
								outlierRadius: 0,
							},
						],
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						scales: {
							y: {
								type: "logarithmic",
								title: {
									display: true,
									text: "Expression Level (log scale)",
								},
								min: 1,
								ticks: {
									callback: function (tickValue: string | number) {
										const value = Number(tickValue);
										if (
											[0.1, 1, 10, 100, 1000, 10000, 100000].includes(value)
										) {
											return value.toLocaleString();
										}
										return null;
									},
								},
							},
						},
						plugins: {
							tooltip: {
								callbacks: {
									title: (tooltipItems: TooltipItem<"boxplot">[]) => {
										return qcData.sample_stats[tooltipItems[0].dataIndex]
											.sample_id;
									},
									label: (context: TooltipItem<"boxplot">) => {
										const stats = context.raw as {
											min: number;
											q1: number;
											median: number;
											q3: number;
											max: number;
										};
										return [
											`Max: ${stats.max.toLocaleString()}`,
											`Q3: ${stats.q3.toLocaleString()}`,
											`Median: ${stats.median.toLocaleString()}`,
											`Q1: ${stats.q1.toLocaleString()}`,
											`Min: ${stats.min.toLocaleString()}`,
										];
									},
								},
							},
							legend: {
								display: false,
							},
						},
					},
				});
			}
		}

			// Correlation Heatmap
			if (heatmapCanvasRef.current) {
				const ctx = heatmapCanvasRef.current.getContext("2d");
				if (ctx) {
					const rawLabels = qcData.sample_stats.map((s) => s.sample_id);
					const correlationMatrix = normalizeCorrelationMatrix(
						qcData.correlation_matrix,
						rawLabels.length,
					);
					const order = clusterOrder(correlationMatrix);
					const labels = order.map(i => rawLabels[i]);
					const clusteredMatrix = order.map(i => order.map(j => correlationMatrix[i][j]));
					const n = labels.length;
					const tickFontSize = n <= 10 ? 11 : n <= 20 ? 9 : n <= 35 ? 8 : n <= 50 ? 7 : 6;
					const maxLabelLen = n <= 10 ? 20 : n <= 20 ? 14 : n <= 35 ? 10 : 7;
					const trimLabel = (s: string) => s.length > maxLabelLen ? s.slice(0, maxLabelLen - 1) + "…" : s;

					// Ensure tick labels are unique — duplicate truncations cause Chart.js to drop entries
					const seen = new Map<string, number>();
					const tickLabels = labels.map((s) => {
						const t = trimLabel(s);
						const count = seen.get(t) ?? 0;
						seen.set(t, count + 1);
						return count === 0 ? t : `${t}(${count + 1})`;
					});

					heatmapChartRef.current = (new Chart(ctx, {
						type: "matrix",
						data: {
							datasets: [
								{
									data: clusteredMatrix.flatMap((row, i) =>
										row.map((value, j) => ({
											x: tickLabels[j],
											y: tickLabels[i],
											v: value,
											xFull: labels[j],
											yFull: labels[i],
										}))
									),
									backgroundColor: (context: ScriptableContext<"matrix">) => {
										const value = (context.raw as { v: number })?.v ?? 0;
										return interpolateViridis((value + 1) / 2);
									},
									width: ({ chart }) => {
										if (!chart.chartArea) return 0;
										return Math.max(4, chart.chartArea.width / n - 1);
									},
									height: ({ chart }) => {
										if (!chart.chartArea) return 0;
										return Math.max(4, chart.chartArea.height / n - 1);
									},
								},
							],
						},
						options: {
							responsive: true,
							maintainAspectRatio: false,
							plugins: {
								legend: {
									display: true,
									position: "top",
									labels: {
										generateLabels: () =>
											[-1, -0.5, 0, 0.5, 1].map((v) => ({
												text: v.toFixed(2),
												fillStyle: interpolateViridis((v + 1) / 2),
												strokeStyle: interpolateViridis((v + 1) / 2),
												lineWidth: 0,
											})),
									},
								},
								tooltip: {
									callbacks: {
										label: (context: TooltipItem<"matrix">) => {
											const raw = context.raw as { xFull: string; yFull: string; v: number };
											return `${raw.yFull} vs ${raw.xFull}: ${raw.v.toFixed(2)}`;
										},
									},
								},
							},
							scales: {
								x: {
									type: "category",
									labels: tickLabels,
									ticks: {
										autoSkip: false,
										maxRotation: 90,
										minRotation: 90,
										font: { size: tickFontSize },
									},
									grid: { display: false },
								},
								y: {
									type: "category",
									labels: tickLabels,
									offset: true,
									reverse: true,
									ticks: {
										autoSkip: false,
										font: { size: tickFontSize },
									},
									grid: { display: false },
								},
							},
						},
					})) as unknown as Chart;
			}
		}

		// Genes Detected Per Sample
		if (genesDetectedCanvasRef.current) {
			const ctx = genesDetectedCanvasRef.current.getContext("2d");
			if (ctx) {
				genesDetectedChartRef.current = new Chart(ctx, {
					type: "bar",
					data: {
						labels: qcData.sample_stats.map((s) => s.sample_id),
						datasets: [
							{
								label: "Detected Genes",
								data: qcData.sample_stats.map((s) => s.detected_genes),
								backgroundColor: "rgba(153, 102, 255, 0.6)",
							},
						],
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: { display: false },
						},
						scales: {
							y: {
								beginAtZero: true,
								title: { display: true, text: "Number of Genes" },
							},
						},
					},
				});
			}
		}
	}, [qcData]);

	// Add loading state check in render
	if (!qcData || qcData.sample_stats.length === 0) {
		return (
			<div className="flex items-center justify-center h-[400px]">
				<p className="text-muted-foreground">
					No data available. Please upload data to view QC metrics.
				</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			<Card className="h-[400px]">
				<CardHeader>
					<CardTitle>Number of Reads</CardTitle>
				</CardHeader>
				<CardContent className="h-[calc(100%-4rem)]">
					<canvas ref={libSizeCanvasRef} />
				</CardContent>
			</Card>

			<Card className="h-[400px]">
				<CardHeader>
					<CardTitle>Genes Detected Per Sample</CardTitle>
				</CardHeader>
				<CardContent className="h-[calc(100%-4rem)]">
					<canvas ref={genesDetectedCanvasRef} />
				</CardContent>
			</Card>

			<Card className="h-[400px]">
				<CardHeader>
					<CardTitle>Gene Expression Distribution</CardTitle>
				</CardHeader>
				<CardContent className="h-[calc(100%-4rem)]">
					<canvas ref={boxplotCanvasRef} />
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Sample Correlation Heatmap</CardTitle>
				</CardHeader>
				<CardContent>
					<div
						className="relative w-full"
						style={{ height: Math.max(320, qcData.sample_stats.length * 18 + 120) + "px" }}
					>
						<canvas ref={heatmapCanvasRef} className="absolute inset-0 w-full h-full" />
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default QCCharts;
