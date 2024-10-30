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
				const labels = qcData.sample_stats.map((s) => s.sample_id);
				heatmapChartRef.current = new Chart(ctx, {
					type: "matrix",
					data: {
						labels: labels,
						datasets: [
							{
								data: qcData.correlation_matrix.flatMap((row, i) =>
									row.map((value, j) => ({
										x: j,
										y: i,
										v: value,
									}))
								),
								backgroundColor: (context: ScriptableContext<"matrix">) => {
									const value = (context.raw as { v: number })?.v ?? 0;
									return interpolateViridis(value);
								},
								width: ({ chart }) =>
									(chart.chartArea || {}).width / labels.length - 1,
								height: ({ chart }) =>
									(chart.chartArea || {}).height / labels.length - 1,
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
									generateLabels: () => {
										const values = [0, 0.25, 0.5, 0.75, 1];
										return values.map((value) => ({
											text: value.toFixed(2),
											fillStyle: interpolateViridis(value),
											strokeStyle: interpolateViridis(value),
											lineWidth: 0,
										}));
									},
								},
							},
							tooltip: {
								callbacks: {
									label: (context: TooltipItem<"matrix">) => {
										const raw = context.raw as {
											x: number;
											y: number;
											v: number;
										};
										const i = raw.y;
										const j = raw.x;
										return `${labels[i]} vs ${labels[j]}: ${raw.v.toFixed(2)}`;
									},
								},
							},
						},
						scales: {
							x: {
								ticks: {
									display: true,
									autoSkip: false,
									maxRotation: 90,
									minRotation: 90,
								},
								title: {
									display: true,
									text: "Sample ID",
								},
							},
							y: {
								ticks: {
									display: true,
									autoSkip: false,
								},
								title: {
									display: true,
									text: "Sample ID",
								},
								offset: true,
							},
						},
					},
				});
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

			<Card className="h-[400px]">
				<CardHeader>
					<CardTitle>Sample Correlation Heatmap</CardTitle>
				</CardHeader>
				<CardContent className="h-[calc(100%-4rem)]">
					<canvas ref={heatmapCanvasRef} />
				</CardContent>
			</Card>
		</div>
	);
}

export default QCCharts;
