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
import { DownloadIcon } from "@radix-ui/react-icons";

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

interface BoxPlotData {
	min: number;
	q1: number;
	median: number;
	q3: number;
	max: number;
	outliers: number[];
}

interface DrugStats {
	drug: string;
	avgAUC: number;
	medianAUC: number;
	stdAUC: number;
	minAUC: number;
	maxAUC: number;
	sampleCount: number;
	rawValues: number[];
	boxPlotData?: BoxPlotData;
}

const MIN_SAMPLES = 5;

export function DrugEffectivenessReport() {
	const [, setDrugResponseData] = useState<DrugResponseData[]>([]);
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [, setKnnData] = useState<KNNDataItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [kValue, setKValue] = useState(20);
	const [report, setReport] = useState<
		Record<string, Record<string, DrugStats>>
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

	function calculateStats(values: number[]) {
		if (!values.length) {
			return {
				mean: 0,
				median: 0,
				std: 0,
				min: 0,
				max: 0,
			};
		}

		const sorted = [...values].sort((a, b) => a - b);
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const median =
			sorted.length % 2 === 0
				? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
				: sorted[Math.floor(sorted.length / 2)];

		const variance =
			values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
			values.length;
		const std = Math.sqrt(variance);

		return {
			mean: Number(mean) || 0,
			median: Number(median) || 0,
			std: Number(std) || 0,
			min: Number(sorted[0]) || 0,
			max: Number(sorted[sorted.length - 1]) || 0,
		};
	}

	function calculateBoxPlotData(values: number[]): BoxPlotData {
		if (!values.length) {
			return {
				min: 0,
				q1: 0,
				median: 0,
				q3: 0,
				max: 0,
				outliers: [],
			};
		}

		const sorted = [...values].sort((a, b) => a - b);
		const q1Index = Math.floor(sorted.length * 0.25);
		const q3Index = Math.floor(sorted.length * 0.75);

		const q1 = Number(sorted[q1Index]) || 0;
		const q3 = Number(sorted[q3Index]) || 0;
		const iqr = q3 - q1;

		const lowerFence = q1 - 1.5 * iqr;
		const upperFence = q3 + 1.5 * iqr;

		const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
		const nonOutliers = sorted.filter(
			(v) => v >= lowerFence && v <= upperFence
		);

		if (!nonOutliers.length) {
			return {
				min: sorted[0],
				q1,
				median: sorted[Math.floor(sorted.length * 0.5)],
				q3,
				max: sorted[sorted.length - 1],
				outliers: [],
			};
		}

		return {
			min: Number(nonOutliers[0]) || 0,
			q1,
			median: Number(sorted[Math.floor(sorted.length * 0.5)]) || 0,
			q3,
			max: Number(nonOutliers[nonOutliers.length - 1]) || 0,
			outliers: outliers.map((v) => Number(v) || 0),
		};
	}

	const generateReport = (
		drugData: DrugResponseData[],
		tsneData: TSNEDataItem[],
		knnData: KNNDataItem[],
		k: number
	) => {
		const uploadedSamples = tsneData.filter(
			(d) => d.data_source === "uploaded"
		);
		const newReport: Record<string, Record<string, DrugStats>> = {};
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

				// Filter and sort drugs
				const drugStats: Record<string, DrugStats> = {};
				Object.entries(drugEffectiveness)
					.filter(
						([drug, aucs]) =>
							// Filter out null and ensure minimum sample size
							drug !== "null" && aucs.length >= MIN_SAMPLES
					)
					.forEach(([drug, aucs]) => {
						const stats = calculateStats(aucs);
						drugStats[drug] = {
							drug,
							avgAUC: stats.mean,
							medianAUC: stats.median,
							stdAUC: stats.std,
							minAUC: stats.min,
							maxAUC: stats.max,
							sampleCount: aucs.length,
							rawValues: aucs,
							boxPlotData: calculateBoxPlotData(aucs),
						};
					});

				// Only include the sample if it has any valid drugs
				if (Object.keys(drugStats).length > 0) {
					newReport[sample.sample_id] = drugStats;
					newGraphData[sample.sample_id] = drugEffectiveness;
				}
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
				const drugs = Object.values(report[selectedSample]).sort(
					(a, b) => a.avgAUC - b.avgAUC
				);

				const data = {
					labels: drugs.map((d) => d.drug.split("_").join(" ")),
					datasets: [
						{
							label: "Drug Response (AUC)",
							backgroundColor: "rgba(54, 162, 235, 0.5)",
							borderColor: "rgb(54, 162, 235)",
							borderWidth: 1,
							outlierColor: "#999999",
							padding: 10,
							itemRadius: 2,
							data: drugs.map((d) => ({
								min: d.boxPlotData!.min,
								q1: d.boxPlotData!.q1,
								median: d.boxPlotData!.median,
								q3: d.boxPlotData!.q3,
								max: d.boxPlotData!.max,
								outliers: d.boxPlotData!.outliers,
							})),
						},
					],
				};

				chartInstance.current = new Chart(ctx, {
					type: "boxplot",
					data,
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: {
								display: false,
							},
							title: {
								display: true,
								text: "Drug Response Distribution",
							},
						},
						scales: {
							y: {
								title: {
									display: true,
									text: "AUC",
								},
							},
							x: {
								ticks: {
									maxRotation: 45,
									minRotation: 45,
								},
							},
						},
					},
				});
			}
		}
	}, [selectedSample, graphData, report]);

	function generateReportText(sampleId: string, drugs: DrugStats[]): string {
		const timestamp = new Date().toISOString().split("T")[0];
		const lines = [
			`Drug Response Report for Sample ${sampleId}`,
			`Generated on ${timestamp}`,
			"",
			"Drug Response Summary (sorted by median AUC, lower is better)",
			"--------------------------------------------------------",
			"",
		];

		drugs
			.sort((a, b) => a.medianAUC - b.medianAUC)
			.forEach((drug, index) => {
				lines.push(`${index + 1}. ${drug.drug.split("_").join(" ")}`);
				lines.push(`   Mean AUC: ${drug.avgAUC.toFixed(3)}`);
				lines.push(`   Median AUC: ${drug.medianAUC.toFixed(3)}`);
				lines.push(`   Standard Deviation: ±${drug.stdAUC.toFixed(3)}`);
				lines.push(
					`   Range: ${drug.minAUC.toFixed(3)} - ${drug.maxAUC.toFixed(3)}`
				);
				lines.push(`   Sample Size: ${drug.sampleCount}`);
				lines.push("");
			});

		return lines.join("\n");
	}

	function downloadReport(sampleId: string, drugs: DrugStats[]) {
		const report = generateReportText(sampleId, drugs);
		const blob = new Blob([report], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `drug-response-sample-${sampleId
			.toLowerCase()
			.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	return (
		<Card className="w-full">
			<CardHeader className="p-4 sm:p-6">
				<CardTitle>
					Drug Effectiveness Report for Uploaded Samples
					<p className="text-sm text-blue-600 pt-2">(Developmental)</p>
				</CardTitle>
				<CardDescription className="">
					This report shows the average drug effectiveness (AUC values) for
					uploaded samples based on their K nearest neighbors. Lower AUC values
					indicate better response to treatment. Only drugs with {MIN_SAMPLES}{" "}
					or more samples are shown.
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
								<div className="flex justify-between items-start gap-4">
									<div className="flex-1">
										<CardTitle>Drug Response Summary</CardTitle>
										<CardDescription>
											Drug response distribution based on {kValue} nearest
											neighbors. Lower AUC values indicate better response to
											treatment.
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div style={{ height: "500px", width: "100%" }}>
									<canvas ref={chartRef}></canvas>
								</div>

								{selectedSample && report[selectedSample] && (
									<Button
										variant="outline"
										size="lg"
										className="h-8 shrink-0"
										onClick={() =>
											downloadReport(
												selectedSample,
												Object.values(report[selectedSample])
											)
										}
									>
										<DownloadIcon className="mr-2 h-4 w-4" />
										Download Report
									</Button>
								)}
								<div className="space-y-4 mt-4">
									{Object.values(report[selectedSample])
										.sort((a, b) => a.avgAUC - b.avgAUC)
										.map((drug, index) => (
											<div key={drug.drug} className="flex flex-col gap-1">
												<div className="flex items-center gap-2">
													<span className="font-medium min-w-[24px]">
														{index + 1}.
													</span>
													<span className="font-medium">
														{drug.drug.split("_").join(" ")}
													</span>
												</div>
												<div className="ml-8 text-sm grid gap-x-6 gap-y-1 grid-cols-2">
													<span className="text-muted-foreground">
														Mean AUC: {drug.avgAUC.toFixed(3)}
													</span>
													<span className="text-muted-foreground">
														Median AUC: {drug.medianAUC.toFixed(3)}
													</span>
													<span className="text-muted-foreground">
														Std Dev: ±{drug.stdAUC.toFixed(3)}
													</span>
													<span className="text-muted-foreground">
														Range: {drug.minAUC.toFixed(3)} -{" "}
														{drug.maxAUC.toFixed(3)}
													</span>
													<span className="text-muted-foreground">
														Sample Size: {drug.sampleCount}
													</span>
												</div>
											</div>
										))}
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
