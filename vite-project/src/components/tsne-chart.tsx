import { useState, useEffect, useRef } from "react";
import { fetchTSNEData } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import Chart, {
	ChartItem,
	ChartType,
	TooltipItem,
	ChartDataset,
	ChartConfiguration,
} from "chart.js/auto";
import { Slider } from "@/components/ui/slider";
import { scaleLinear } from "d3-scale";
import { interpolateViridis } from "d3-scale-chromatic";
import zoomPlugin from "chartjs-plugin-zoom"; // Add this import

// Register the zoom plugin
Chart.register(zoomPlugin);

// Add this interface at the top of the file
interface TSNEDataItem {
	X1: number;
	X2: number;
	sample_id: string;
	[key: string]: unknown;
}

export function TSNEChart() {
	const [tsneData, setTsneData] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedAttribute, setSelectedAttribute] = useState("sex");
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const chartInstance = useRef<Chart | null>(null);
	const [pointRadius, setPointRadius] = useState(4);
	const [showSettings, setShowSettings] = useState(false);

	const handleRunTSNE = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await fetchTSNEData();
			setTsneData(data);
		} catch (error) {
			console.error("Failed to load TSNE data:", error);
			setError("Failed to load TSNE data. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (tsneData.length > 0 && chartRef.current) {
			const ctx = chartRef.current.getContext("2d");

			const isNumeric =
				selectedAttribute === "blasts" || selectedAttribute === "age";
			let colorMap: Record<string, string>;
			let datasets: ChartDataset<"scatter", unknown[]>[];

			if (isNumeric) {
				const values = tsneData
					.map((item) => {
						const value = parseFloat(item[selectedAttribute] as string);
						return isNaN(value) ? null : value;
					})
					.filter((value): value is number => value !== null);

				const colorScale = scaleLinear()
					.domain([Math.min(...values), Math.max(...values)])
					.range([0, 1]);

				datasets = [
					{
						label: selectedAttribute,
						data: tsneData.map((item: TSNEDataItem) => {
							const value = parseFloat(item[selectedAttribute] as string);
							return {
								x: item.X1,
								y: item.X2,
								sample: item.sample_id,
								[selectedAttribute]: isNaN(value) ? null : value,
							};
						}),
						backgroundColor: tsneData.map((item) => {
							const value = parseFloat(item[selectedAttribute] as string);
							return isNaN(value)
								? "rgba(0,0,0,0.1)"
								: interpolateViridis(colorScale(value));
						}),
					},
				];
			} else {
				const uniqueValues = [
					...new Set(tsneData.map((item) => item[selectedAttribute])),
				];
				colorMap = generateColorMap(uniqueValues);

				datasets = uniqueValues.flatMap((value) => {
					const normalData = tsneData.filter(
						(item) =>
							item[selectedAttribute as keyof typeof item] === value &&
							item["data_source"] !== "uploaded"
					);
					const uploadedData = tsneData.filter(
						(item) =>
							item[selectedAttribute as keyof typeof item] === value &&
							item["data_source"] === "uploaded"
					);

					return [
						{
							label: value,
							data: normalData.map((item: TSNEDataItem) => ({
								x: item.X1,
								y: item.X2,
								sample: item.sample_id,
								[selectedAttribute]: item[selectedAttribute],
							})),
							backgroundColor: colorMap[value],
							z: 0, // Lower z value for normal data
						},
						{
							label: `Uploaded`,
							data: uploadedData.map((item: TSNEDataItem) => ({
								x: item.X1,
								y: item.X2,
								sample: item.sample_id,
								[selectedAttribute]: item[selectedAttribute],
							})),
							backgroundColor: colorMap[value],
							borderColor: "black",
							borderWidth: 1,
							z: 1000, // Higher z value for uploaded data
							pointRadius: pointRadius + 2,
						},
					];
				});

				// Filter out empty datasets
				datasets = datasets.filter((dataset) => dataset.data.length > 0);
			}

			if (chartInstance.current) {
				chartInstance.current.destroy();
			}

			chartInstance.current = new Chart(
				ctx as ChartItem,
				{
					type: "scatter",
					data: { datasets },
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: {
								position: "right",
								align: "start",
								labels: {
									boxWidth: 10,
									padding: 10,
									generateLabels: (chart: Chart) => {
										if (isNumeric) {
											// Create a color scale legend for numeric attributes
											const values = tsneData
												.map((item) => {
													const value = parseFloat(
														item[selectedAttribute] as string
													);
													return isNaN(value) ? null : value;
												})
												.filter((value): value is number => value !== null);

											const min = Math.min(...values);
											const max = Math.max(...values);
											return [
												{
													text: `${min.toFixed(2)}`,
													fillStyle: interpolateViridis(0),
												},
												{ text: "", fillStyle: interpolateViridis(0.25) },
												{ text: "", fillStyle: interpolateViridis(0.5) },
												{ text: "", fillStyle: interpolateViridis(0.75) },
												{
													text: `${max.toFixed(2)}`,
													fillStyle: interpolateViridis(1),
												},
											];
										} else {
											// Use default legend for categorical attributes
											return Chart.defaults.plugins.legend.labels.generateLabels(
												chart
											);
										}
									},
								},
								maxHeight: 200,
							},
							tooltip: {
								callbacks: {
									label: (context: TooltipItem<ChartType>) => {
										const point = context.raw as {
											x: number;
											y: number;
											sample: string;
											[key: string]: unknown;
										};
										const value = point[selectedAttribute];
										return [
											`Sample: ${point.sample}`,
											`${selectedAttribute}: ${
												value === null || value === undefined
													? "N/A"
													: isNumeric
													? typeof value === "number"
														? value.toFixed(2)
														: value
													: value
											}`,
										];
									},
								},
							},
							zoom: {
								zoom: {
									wheel: {
										enabled: true,
									},
									pinch: {
										enabled: true,
									},
									mode: "xy",
								},
								pan: {
									enabled: true,
									mode: "xy",
								},
							},
						},
						scales: {
							x: {
								type: "linear",
								position: "bottom",
								title: {
									display: true,
									text: "t-SNE 1",
								},
								grid: {
									display: false,
								},
							},
							y: {
								type: "linear",
								position: "left",
								title: {
									display: true,
									text: "t-SNE 2",
								},
								grid: {
									display: false,
								},
							},
						},
						elements: {
							point: {
								radius: pointRadius,
							},
						},
					},
				} as ChartConfiguration<"scatter", { x: number; y: number }[], unknown>
			);
		}
	}, [tsneData, selectedAttribute, pointRadius]);

	return (
		<Card className="w-full h-full">
			<CardHeader>
				<CardTitle>Meta t-SNE Visualization</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col h-[calc(100%-4rem)]">
				{error && <p className="text-red-500 mt-2">{error}</p>}
				<div className="flex-grow relative">
					<div className="h-[500px]">
						{tsneData.length > 0 ? (
							<canvas ref={chartRef} className="w-full h-full"></canvas>
						) : (
							<div className="w-full h-full flex items-center justify-center text-gray-500">
								<p>Click "Run TSNE" to generate the plot</p>
							</div>
						)}
					</div>
				</div>
				<div className="flex flex-wrap gap-4 mt-4 items-center justify-between">
					<Select
						value={selectedAttribute}
						onValueChange={setSelectedAttribute}
					>
						<SelectTrigger className="w-[180px]">
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
								"blasts",
								"age",
							].map((attr) => (
								<SelectItem key={attr} value={attr}>
									{attr}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex gap-2">
						<Button onClick={handleRunTSNE} disabled={isLoading}>
							{isLoading ? "Loading..." : "Run TSNE"}
						</Button>
						<Button
							variant="ghost"
							onClick={() => setShowSettings(!showSettings)}
						>
							⚙️
						</Button>
					</div>
					<Button
						onClick={() => chartInstance.current?.resetZoom()}
						disabled={!chartInstance.current}
					>
						Reset Zoom
					</Button>
				</div>
				{showSettings && (
					<div className="flex items-center space-x-2 mt-2">
						<span>Point Size:</span>
						<Slider
							value={[pointRadius]}
							onValueChange={(value) => setPointRadius(value[0])}
							min={1}
							max={10}
							step={1}
							className="w-[100px]"
						/>
						<span>{pointRadius}</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function generateColorMap(uniqueValues: string[]) {
	const colors = [
		"#8884d8",
		"#82ca9d",
		"#ffc658",
		"#ff7300",
		"#a4de6c",
		"#ff6347",
		"#9932cc",
		"#8b0000",
		"#e32636",
		"#3cb371",
		"#ffa500",
		"#800080",
		"#ffc0cb",
		"#808000",
		"#00ff00",
		"#ffb6c1",
		"#ffa07a",
		"#ffd700",
		"#ff6347",
	];
	return Object.fromEntries(
		uniqueValues.map((value, index) => [value, colors[index % colors.length]])
	);
}

export default TSNEChart;
