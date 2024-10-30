import { useState, useEffect, useRef } from "react";
import { fetchDrugResponseData } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import Chart, { ChartDataset, ChartItem, TooltipItem } from "chart.js/auto";
import { Slider } from "@/components/ui/slider";
import { scaleLinear } from "d3-scale";
import { interpolateViridis } from "d3-scale-chromatic";
import zoomPlugin from "chartjs-plugin-zoom";

// Register the zoom plugin
Chart.register(zoomPlugin);

interface DrugResponseData {
	sample_id: string;
	inhibitor: string;
	auc: number;
	X1: number;
	X2: number;
	clusters: string;
}

// Add this type definition
type DataPoint = {
	x: number;
	y: number;
	sample: string;
	response: number | null;
};

export function DrugResponseTSNE() {
	const [drugResponseData, setDrugResponseData] = useState<DrugResponseData[]>(
		[]
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedDrug, setSelectedDrug] = useState("");
	const [availableDrugs, setAvailableDrugs] = useState<string[]>([]);
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const chartInstance = useRef<Chart | null>(null);
	const [pointRadius, setPointRadius] = useState(4);
	const [showSettings, setShowSettings] = useState(false);
	const [sortedDrugs, setSortedDrugs] = useState<string[]>([]);

	const handleFetchData = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const rawData = await fetchDrugResponseData();

			// Check if rawData is in the expected format
			if (
				typeof rawData !== "object" ||
				rawData === null ||
				!rawData.sample_id ||
				!Array.isArray(rawData.sample_id)
			) {
				throw new Error("Received data is not in the expected format");
			}

			const transformedData = Array.from(
				{ length: rawData.sample_id.length },
				(_, i) => ({
					sample_id: rawData.sample_id[i],
					inhibitor: rawData.inhibitor[i],
					auc: rawData.auc[i],
					X1: rawData.X1[i],
					X2: rawData.X2[i],
					clusters: rawData["clusters"][i],
				})
			);

			setDrugResponseData(transformedData as unknown as DrugResponseData[]);

			const drugs = Array.from(
				new Set(transformedData.map((item) => item.inhibitor).filter(Boolean))
			);
			setAvailableDrugs(drugs);

			// Sort drugs by effectiveness
			const sortedDrugs = [...drugs].sort(
				(a, b) => calculateDrugEffectiveness(b) - calculateDrugEffectiveness(a)
			);
			setSortedDrugs(sortedDrugs);

			// Select the first drug in the sorted list
			setSelectedDrug(sortedDrugs[0]);
		} catch (error) {
			console.error("Failed to load drug response data:", error);
			setError(
				`Failed to load drug response data: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		} finally {
			setIsLoading(false);
		}
	};

	const calculateDrugEffectiveness = (drug: string) => {
		const drugData = drugResponseData.filter((item) => item.inhibitor === drug);
		const clusterAUCs: { [key: string]: number[] } = {};

		drugData.forEach((item) => {
			const cluster = item["clusters"];
			if (!(cluster in clusterAUCs)) {
				clusterAUCs[cluster] = [];
			}
			clusterAUCs[cluster].push(item.auc);
		});

		const clusterAvgAUCs = Object.values(clusterAUCs).map(
			(aucs) => aucs.reduce((sum, auc) => sum + auc, 0) / aucs.length
		);

		return Math.max(...clusterAvgAUCs) - Math.min(...clusterAvgAUCs);
	};

	useEffect(() => {
		if (drugResponseData.length > 0 && availableDrugs.length > 0) {
			const sortedDrugs = [...availableDrugs].sort(
				(a, b) => calculateDrugEffectiveness(b) - calculateDrugEffectiveness(a)
			);
			setSortedDrugs(sortedDrugs);
			setSelectedDrug(sortedDrugs[0]);
		}
	}, [drugResponseData, availableDrugs]);

	useEffect(() => {
		if (drugResponseData.length > 0 && selectedDrug && chartRef.current) {
			const ctx = chartRef.current.getContext("2d");
			const filteredData = drugResponseData.filter(
				(item) => item.inhibitor === selectedDrug
			);
			const allSamples = [
				...new Set(drugResponseData.map((item) => item.sample_id)),
			];
			const responseValues = filteredData.map((item) => item.auc);
			const minValue = Math.min(...responseValues);
			const maxValue = Math.max(...responseValues);

			const colorScale = scaleLinear()
				.domain([minValue, maxValue])
				.range([0, 1]);

			const datasets: ChartDataset<"scatter", DataPoint[]>[] = [
				{
					label: `${selectedDrug} (without response)`,
					data: allSamples
						.filter(
							(sample) => !filteredData.some((d) => d.sample_id === sample)
						)
						.map((sample) => {
							const baseItem = drugResponseData.find(
								(d) => d.sample_id === sample
							)!;
							return { x: baseItem.X1, y: baseItem.X2, sample, response: null };
						}),
					backgroundColor: "lightgray",
					pointRadius: pointRadius / 1.2,
					order: 2,
				},
				{
					label: `${selectedDrug} (with response)`,
					data: filteredData.map((item) => ({
						x: item.X1,
						y: item.X2,
						sample: item.sample_id,
						response: item.auc,
					})),
					backgroundColor: filteredData.map((item) =>
						interpolateViridis(colorScale(item.auc))
					),
					pointRadius: pointRadius,
					order: 1,
				},
			];

			if (chartInstance.current) {
				chartInstance.current.destroy();
			}

			chartInstance.current = new Chart(ctx as ChartItem, {
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
								boxWidth: 20,
								boxHeight: 20,
								padding: 10,
								usePointStyle: true,
								pointStyle: "rectRounded",
								generateLabels: () => {
									const steps = 5;
									const stepSize = (maxValue - minValue) / (steps - 1);
									return Array.from({ length: steps }, (_, i) => ({
										text: (minValue + i * stepSize).toFixed(2),
										fillStyle: interpolateViridis(i / (steps - 1)),
									}));
								},
							},
						},
						tooltip: {
							callbacks: {
								label: (
									context: TooltipItem<"scatter">
								): string | void | string[] => {
									const point = context.raw as {
										x: number;
										y: number;
										sample: string;
										response: number | null;
									};
									if (point.response === null) return "";
									return [
										`Sample: ${point.sample}`,
										`AUC: ${point.response.toFixed(2)}`,
									];
								},
							},
						},
						zoom: {
							zoom: {
								wheel: { enabled: true },
								pinch: { enabled: true },
								mode: "xy",
							},
							pan: { enabled: true, mode: "xy" },
						},
					},
					scales: {
						x: {
							type: "linear",
							position: "bottom",
							title: { display: true, text: "TSNE 1" },
							grid: { display: false },
						},
						y: {
							type: "linear",
							position: "left",
							title: { display: true, text: "TSNE 2" },
							grid: { display: false },
						},
					},
					elements: { point: { radius: pointRadius } },
				},
			});
		}
	}, [drugResponseData, selectedDrug, pointRadius]);

	return (
		<Card className="h-full w-full">
			<CardHeader>
				<CardTitle>Drug Response t-SNE</CardTitle>
			</CardHeader>
			<CardContent className="flex-grow flex flex-col h-[calc(100%-4rem)] min-h-[400px]">
				{error && <p className="text-red-500 mt-2">{error}</p>}
				<div className="flex-grow relative flex items-center justify-center text-center">
					{drugResponseData.length === 0 && !isLoading && (
						<p className="text-center mt-4 flex justify-center items-center text-gray-500">
							Click "Fetch Data" to visualize the drug response t-SNE.
						</p>
					)}
					{drugResponseData.length > 0 && (
						<div className="flex justify-center items-center w-full h-full">
							<canvas ref={chartRef} className="w-full h-full"></canvas>
						</div>
					)}
				</div>
				<div className="flex flex-col gap-4 mt-4">
					<div className="flex flex-col lg:flex-row gap-4">
						<Select value={selectedDrug} onValueChange={setSelectedDrug}>
							<SelectTrigger className="w-full lg:w-[180px]">
								<SelectValue placeholder="Select drug" />
							</SelectTrigger>
							<SelectContent className="max-h-[200px]">
								{sortedDrugs.map((drug) => (
									<SelectItem key={drug} value={drug}>
										{drug}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<div className="flex flex-wrap gap-2">
							<Button
								onClick={handleFetchData}
								disabled={isLoading}
								className="flex-1 lg:flex-none min-w-[100px]"
							>
								{isLoading ? "Loading..." : "Fetch Data"}
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
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default DrugResponseTSNE;
