import { useState, useEffect, useRef } from "react";
import {
	fetchDrugResponseData,
	fetchTSNEData,
	fetchKNNData,
} from "@/utils/api";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

import Chart from "chart.js/auto";

interface DrugResponseData {
	sample_id: string;
	inhibitor: string;
	auc: number;
}

interface TSNEDataItem {
	sample_id: string;
	data_source: string;
}

interface KNNDataItem {
	sample_id: string;
	knn_indices: number[];
}

interface DrugEffectiveness {
	averageAUC: number;
	sampleCount: number;
}

export function DrugEffectivenessReport() {
	const [, setDrugResponseData] = useState<DrugResponseData[]>([]);
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [, setKnnData] = useState<KNNDataItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [kValue, setKValue] = useState(50);
	const [report, setReport] = useState<
		Record<string, Record<string, DrugEffectiveness>>
	>({});
	const [selectedSample, setSelectedSample] = useState<string | null>(null);
	const [, setAvailableDrugs] = useState<string[]>([]);
	const [graphData, setGraphData] = useState<
		Record<string, Record<string, number[]>>
	>({});
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const chartInstance = useRef<Chart | null>(null);

	const handleRunReport = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const [drugResponse, tsne, knn] = await Promise.all([
				fetchDrugResponseData(),
				fetchTSNEData(),
				fetchKNNData(kValue),
			]);

			// Transform drug response data
			const transformedDrugData = Object.keys(drugResponse.sample_id).map(
				(index) => ({
					sample_id: drugResponse.sample_id[index],
					inhibitor: drugResponse.inhibitor[index],
					auc: drugResponse.auc[index],
				})
			);

			setDrugResponseData(transformedDrugData);
			setTsneData(tsne);
			setKnnData(knn);

			const drugs = Array.from(
				new Set(transformedDrugData.map((item) => item.inhibitor))
			);
			setAvailableDrugs(drugs);

			generateReport(transformedDrugData, tsne, knn, kValue);

			// Select the first uploaded sample after generating the report
			const firstUploadedSample = tsne.find(
				(d: TSNEDataItem) => d.data_source === "uploaded"
			);
			if (firstUploadedSample) {
				setSelectedSample(firstUploadedSample.sample_id);
			}
		} catch (error) {
			console.error("Failed to load data:", error);
			setError("Failed to load data. Please try again.");
			setSelectedSample(null);
		} finally {
			setIsLoading(false);
		}
	};

	const generateReport = (
		drugData: DrugResponseData[],
		tsneData: TSNEDataItem[],
		knnData: KNNDataItem[],
		k: number
	) => {
		const uploadedSamples = tsneData.filter(
			(d) => d.data_source === "uploaded"
		);
		const newReport: Record<string, Record<string, DrugEffectiveness>> = {};
		const newGraphData: Record<string, Record<string, number[]>> = {};

		uploadedSamples.forEach((sample) => {
			const knnItem = knnData.find(
				(item) => item.sample_id === sample.sample_id
			);

			if (knnItem) {
				const neighbors = knnItem.knn_indices
					.slice(0, k)
					.map((index) => tsneData[index - 1].sample_id);

				const drugEffectiveness: Record<string, number[]> = {};

				neighbors.forEach((neighborId) => {
					drugData.forEach((drugItem) => {
						if (drugItem.sample_id === neighborId) {
							if (!drugEffectiveness[drugItem.inhibitor]) {
								drugEffectiveness[drugItem.inhibitor] = [];
							}
							drugEffectiveness[drugItem.inhibitor].push(drugItem.auc);
						}
					});
				});

				// Get the first 20 neighbors with available data for each drug
				const first20Neighbors: Record<string, number[]> = {};
				Object.entries(drugEffectiveness).forEach(([drug, aucs]) => {
					first20Neighbors[drug] = aucs
						.filter((auc) => auc !== undefined)
						.slice(0, 20);
				});

				const averageEffectiveness: Record<string, DrugEffectiveness> = {};
				Object.entries(first20Neighbors).forEach(([drug, aucs]) => {
					averageEffectiveness[drug] = {
						averageAUC: aucs.reduce((sum, auc) => sum + auc, 0) / aucs.length,
						sampleCount: aucs.length,
					};
				});

				newReport[sample.sample_id] = averageEffectiveness;
				newGraphData[sample.sample_id] = first20Neighbors;
			}
		});

		setReport(newReport);
		setGraphData(newGraphData);
	};

	useEffect(() => {
		if (selectedSample && graphData[selectedSample] && chartRef.current) {
			if (chartInstance.current) {
				chartInstance.current.destroy();
			}

			const ctx = chartRef.current.getContext("2d");
			if (ctx) {
				const drugAverages = Object.entries(report[selectedSample]).map(
					([drug, data]) => ({
						drug,
						averageAUC: data.averageAUC,
					})
				);
				const minAUCDrug = drugAverages.reduce((min, curr) =>
					curr.averageAUC < min.averageAUC ? curr : min
				);

				const datasets = Object.entries(graphData[selectedSample]).map(
					([drug, aucs], index) => ({
						label: drug,
						data: aucs,
						borderColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
						backgroundColor: `hsla(${(index * 137.5) % 360}, 70%, 50%, 0.1)`,
						fill: false,
						tension: 0,
						pointRadius: drug === minAUCDrug.drug ? 4 : 2,
						pointHoverRadius: 6,
						borderWidth: drug === minAUCDrug.drug ? 3 : 1,
						borderDash: drug === minAUCDrug.drug ? [] : [5, 5],
						order: drug === minAUCDrug.drug ? 1 : 2,
					})
				);

				chartInstance.current = new Chart(ctx, {
					type: "line",
					data: {
						labels: Array.from({ length: 20 }, (_, i) => i + 1),
						datasets: datasets,
					},
					options: {
						responsive: true,
						plugins: {
							legend: {
								display: false,
							},
							tooltip: {
								mode: "index",
								intersect: false,
								callbacks: {
									title: (tooltipItems) => {
										return `Neighbor Rank: ${tooltipItems[0].label}`;
									},
									label: (context) => {
										const drug = context.dataset.label;
										const isMinAUC = drug === minAUCDrug.drug;
										return `${drug}${
											isMinAUC ? " (Min AUC)" : ""
										}: ${context.parsed.y.toFixed(4)}`;
									},
								},
							},
						},
						scales: {
							x: {
								title: {
									display: true,
									text: "Neighbor Rank (Closest to Farthest)",
								},
							},
							y: {
								title: {
									display: true,
									text: "AUC Value",
								},
							},
						},
					},
				});
			}
		}
	}, [selectedSample, graphData, report]);

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>
					Drug Effectiveness Report for Uploaded Samples
					<p className="text-sm text-blue-600 pt-2">(Developmental)</p>
				</CardTitle>
				<CardDescription>
					This report shows the average drug effectiveness (AUC values) for
					uploaded samples based on their K nearest neighbors.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col space-y-4 mb-6">
					<div className="flex items-center space-x-4">
						<span className="w-24">K Value:</span>
						<Slider
							value={[kValue]}
							onValueChange={(value) => setKValue(value[0])}
							min={1}
							max={50}
							step={1}
							className="w-full"
						/>
						<span>{kValue}</span>
					</div>
					<div className="flex items-center space-x-4">
						<span className="w-24">Sample:</span>
						<Select
							onValueChange={setSelectedSample}
							value={selectedSample || undefined}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select a sample" />
							</SelectTrigger>
							<SelectContent>
								{tsneData
									.filter((d) => d.data_source === "uploaded")
									.map((sample) => (
										<SelectItem key={sample.sample_id} value={sample.sample_id}>
											{sample.sample_id}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex justify-center">
						<Button
							onClick={handleRunReport}
							disabled={isLoading}
							className="w-[200px]"
						>
							{isLoading ? "Generating..." : "Generate Report"}
						</Button>
					</div>
				</div>
				{error && <p className="text-red-500 mb-4">{error}</p>}
				{selectedSample && report[selectedSample] && (
					<>
						<Card className="mb-6">
							<CardHeader>
								<CardTitle>Drug AUC Values for K Nearest Neighbors</CardTitle>
								<CardDescription>
									The highlighted line represents the drug with the minimum
									average AUC.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div style={{ height: "400px" }}>
									<canvas ref={chartRef}></canvas>
								</div>
							</CardContent>
						</Card>
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default DrugEffectivenessReport;
