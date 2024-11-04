import { useState, useEffect, useRef, useCallback } from "react";
import { fetchTSNEData, fetchKNNData } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Chart, { ChartItem, TooltipItem } from "chart.js/auto";
import { Slider } from "@/components/ui/slider";
import zoomPlugin from "chartjs-plugin-zoom";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

Chart.register(zoomPlugin);

// Add these color constants at the top of your file
const COLORS = {
	NORMAL: "rgba(70, 130, 180, 0.5)", // Steel Blue
	UPLOADED: "rgba(255, 99, 71, 1)", // Tomato Red
	NEIGHBORS: "rgba(50, 205, 50, 0.5)", // Lime Green
	BORDER: "rgba(0, 0, 0, 0.5)", // Black (for borders)
};

interface KNNDataItem {
	sample_id: string;
	knn_indices: number[];
	knn_distances: number[];
}

interface TSNEDataItem {
	sample_id: string;
	X1: number;
	X2: number;
	data_source: string;
}

export function TSNEKNNChart() {
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [knnData, setKnnData] = useState<KNNDataItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [kValue, setKValue] = useState(20);
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const chartInstance = useRef<Chart | null>(null);
	const [pointRadius, setPointRadius] = useState(4);
	const [hoveredSample, setHoveredSample] = useState<string | null>(null);
	const [selectedAttribute, setSelectedAttribute] = useState("sex");
	const [showSettings, setShowSettings] = useState(false);

	const handleRunTSNEKNN = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const tsneResult = await fetchTSNEData();
			const knnResult = await fetchKNNData(kValue);
			setTsneData(tsneResult);
			setKnnData(knnResult);
		} catch (error) {
			console.error("Failed to load TSNE and KNN data:", error);
			setError("Failed to load TSNE and KNN data. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (tsneData.length > 0 && knnData.length > 0 && chartRef.current) {
			const ctx = chartRef.current.getContext("2d");

			const normalData = tsneData.filter((d) => d.data_source !== "uploaded");
			const uploadedData = tsneData.filter((d) => d.data_source === "uploaded");

			const baseDataset = {
				label: "Normal Data",
				data: normalData.map((d) => ({
					x: d.X1,
					y: d.X2,
					sample: d.sample_id,
				})),
				backgroundColor: COLORS.NORMAL,
				pointRadius: pointRadius,
				pointHoverRadius: pointRadius + 2,
			};

			const uploadedDataset = {
				label: "Uploaded Data",
				data: uploadedData.map((d) => ({
					x: d.X1,
					y: d.X2,
					sample: d.sample_id,
				})),
				backgroundColor: COLORS.UPLOADED,
				pointRadius: pointRadius + 2,
				pointHoverRadius: pointRadius + 4,
				borderColor: COLORS.BORDER,
				borderWidth: 1,
				z: 1000,
			};

			const neighborDataset = {
				label: "Neighbors",
				data: [],
				backgroundColor: COLORS.NEIGHBORS,
				pointRadius: pointRadius + 2,
				pointHoverRadius: pointRadius + 4,
			};

			if (chartInstance.current) {
				chartInstance.current.destroy();
			}

			// Replace the debounced render with requestAnimationFrame
			let animationFrameId: number;
			const smoothRender = () => {
				if (chartInstance.current) {
					animationFrameId = requestAnimationFrame(() => {
						chartInstance.current?.render();
					});
				}
			};

			// Update zoom and pan options
			chartInstance.current = new Chart(ctx as ChartItem, {
				type: "scatter",
				data: {
					datasets: [baseDataset, uploadedDataset, neighborDataset],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: "right",
							align: "start",
							labels: {
								usePointStyle: true,
								pointStyle: "rect",
								boxWidth: 30,
								boxHeight: 15,
								padding: 20,
							},
						},
						zoom: {
							zoom: {
								wheel: {
									enabled: true,
									speed: 0.05, // Reduce zoom speed further
								},
								pinch: { enabled: true },
								mode: "xy",
								onZoom: smoothRender,
							},
							pan: {
								enabled: true,
								mode: "xy",
								onPan: smoothRender,
							},
						},
						tooltip: {
							callbacks: {
								label: (context: TooltipItem<"scatter">) => {
									const point = context.raw as {
										x: number;
										y: number;
										sample: string;
									};
									// Find the corresponding data point in tsneData
									const dataPoint = tsneData.find(
										(d) => d.sample_id === point.sample
									);
									const originalValue = dataPoint
										? dataPoint[selectedAttribute as keyof TSNEDataItem]
										: "N/A";
									const predictedValue = predictMetadata(point.sample);
									return [
										`Sample: ${point.sample}`,
										`${selectedAttribute} (Original): ${
											originalValue ?? "N/A"
										}`,
										`${selectedAttribute} (Predicted): ${
											predictedValue ?? "N/A"
										}`,
									];
								},
							},
						},
					},
					scales: {
						x: {
							type: "linear",
							position: "bottom",
							title: { display: true, text: "t-SNE 1" },
							grid: { display: false },
						},
						y: {
							type: "linear",
							position: "left",
							title: { display: true, text: "t-SNE 2" },
							grid: { display: false },
						},
					},
					onHover: (_, activeElements) => {
						if (activeElements.length > 0) {
							const hoveredPoint = activeElements[0];
							const datasetIndex = hoveredPoint.datasetIndex;
							const index = hoveredPoint.index;
							const dataPoint =
								chartInstance.current?.data.datasets[datasetIndex].data[index];
							const sample =
								dataPoint &&
								typeof dataPoint === "object" &&
								"sample" in dataPoint
									? (dataPoint as { sample: string }).sample
									: null;
							setHoveredSample(sample || null);
						} else {
							setHoveredSample(null);
						}
					},
					animation: {
						duration: 0, // Disable animations for better performance
					},
				},
			});

			// Cleanup animation frame on unmount
			return () => {
				if (animationFrameId) {
					cancelAnimationFrame(animationFrameId);
				}
			};
		}
	}, [tsneData, knnData, pointRadius, selectedAttribute]);

	useEffect(() => {
		if (chartInstance.current && hoveredSample) {
			const knnItem = knnData.find((item) => item.sample_id === hoveredSample);
			if (knnItem) {
				const neighborPoints = knnItem.knn_indices
					.slice(0, kValue)
					.map((index) => {
						// Subtract 1 from the index to convert to 0-based indexing
						const neighborKNN = knnData[index - 1];
						const neighborTSNE = tsneData.find(
							(d) => d.sample_id === neighborKNN.sample_id
						);
						return neighborTSNE
							? {
									x: neighborTSNE.X1,
									y: neighborTSNE.X2,
									sample: neighborTSNE.sample_id,
							  }
							: null;
					})
					.filter(
						(point): point is { x: number; y: number; sample: string } =>
							point !== null
					);

				chartInstance.current.data.datasets[2].data = neighborPoints;
			} else {
				chartInstance.current.data.datasets[2].data = [];
			}
			chartInstance.current.update();
		} else if (chartInstance.current) {
			chartInstance.current.data.datasets[2].data = [];
			chartInstance.current.update();
		}
	}, [hoveredSample, tsneData, knnData, kValue]);

	const predictMetadata = useCallback(
		(sample: string | null) => {
			if (!sample) return null;
			const knnItem = knnData.find((item) => item.sample_id === sample);
			if (!knnItem) return null;

			const neighbors = knnItem.knn_indices
				.slice(0, kValue)
				.map((index) =>
					tsneData.find((d) => d.sample_id === knnData[index - 1].sample_id)
				)
				.filter(Boolean);

			const valueCount = neighbors.reduce((acc, neighbor) => {
				const value = neighbor
					? neighbor[selectedAttribute as keyof typeof neighbor]
					: null;
				if (value !== null) {
					acc[value] = (acc[value] || 0) + 1;
				}
				return acc;
			}, {} as Record<string, number>);

			const [predictedValue] = Object.entries(valueCount).reduce((a, b) =>
				a[1] > b[1] ? a : b
			);
			return predictedValue;
		},
		[knnData, tsneData, kValue, selectedAttribute]
	);

	return (
		<Card className="w-full h-full">
			<CardHeader>
				<CardTitle>t-SNE Visualization with KNN</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col h-[calc(100%-4rem)]">
				{error && <p className="text-red-500 mt-2">{error}</p>}
				<div className="flex-grow relative">
					<div className="h-[500px]">
						{tsneData.length > 0 && knnData.length > 0 ? (
							<canvas ref={chartRef} className="w-full h-full"></canvas>
						) : (
							<div className="w-full h-full flex items-center justify-center text-gray-500">
								<p>Click "Run kNN-tsne" to generate the plot</p>
							</div>
						)}
					</div>
				</div>
				<div className="flex flex-col gap-4 mt-4">
					<div className="flex flex-col lg:flex-row gap-4">
						<Select
							value={selectedAttribute}
							onValueChange={setSelectedAttribute}
						>
							<SelectTrigger className="w-full lg:w-[180px]">
								<SelectValue placeholder="Select attribute" />
							</SelectTrigger>
							<SelectContent>
								{[
									"sex",
									"tissue",
									"prim_rec",
									"FAB",
									"WHO_2022",
									"ICC_2022",
									"KMT2A_diagnosis",
									"rare_diagnosis",
									"clusters",
									"study",
								].map((attr) => (
									<SelectItem key={attr} value={attr}>
										{attr}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<div className="flex flex-wrap gap-2">
							<Button
								onClick={handleRunTSNEKNN}
								disabled={isLoading}
								className="flex-1 lg:flex-none min-w-[100px]"
							>
								{isLoading ? "Loading..." : "Run kNN-tsne"}
							</Button>
							<Button
								variant="ghost"
								onClick={() => setShowSettings(!showSettings)}
								className="flex-none"
							>
								⚙️
							</Button>
							<Button
								onClick={() => chartInstance.current?.resetZoom()}
								disabled={!chartInstance.current}
								className="flex-1 lg:flex-none min-w-[100px]"
							>
								Reset Zoom
							</Button>
						</div>
					</div>

					{/* Settings section */}
					{showSettings && (
						<div className="flex flex-col lg:flex-row items-start lg:items-center gap-2">
							<span>Point Size:</span>
							<div className="flex items-center gap-2 w-full lg:w-auto">
								<Slider
									value={[pointRadius]}
									onValueChange={(value) => setPointRadius(value[0])}
									min={1}
									max={10}
									step={1}
									className="w-full lg:w-[100px]"
								/>
								<span className="min-w-[20px] text-center">{pointRadius}</span>
							</div>
							<span className="ml-4">K Value:</span>
							<div className="flex items-center gap-2 w-full lg:w-auto">
								<Slider
									value={[kValue]}
									onValueChange={(value) => setKValue(value[0])}
									min={1}
									max={50}
									step={1}
									className="w-full lg:w-[100px]"
								/>
								<span className="min-w-[20px] text-center">{kValue}</span>
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default TSNEKNNChart;
