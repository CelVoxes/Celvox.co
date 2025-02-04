import { useState, useEffect } from "react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { fetchDrugResponseData } from "@/utils/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Chart } from "react-chartjs-2";
import { DownloadIcon } from "@radix-ui/react-icons";

interface DrugResponse {
	sample_id: string;
	inhibitor: string;
	auc: number;
	[key: string]: string | number | undefined;
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

interface ClusterDrugData {
	[cluster: string]: {
		totalSamples: number;
		drugs: DrugStats[];
	};
}

interface BoxPlotData {
	min: number;
	q1: number;
	median: number;
	q3: number;
	max: number;
	outliers: number[];
}

const MIN_SAMPLES = 5; // Minimum number of samples required for reliable drug response

function formatMetadataLabel(key: string): string {
	if (!key) return "";
	return key
		.split(/[_\s]|(?=[A-Z])/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
}

function formatGroupValue(value: string): string {
	if (
		!value ||
		value.toLowerCase() === "null" ||
		value.toLowerCase() === "undefined"
	) {
		return "Unknown";
	}

	// Try to parse as number
	const num = Number(value);
	if (!isNaN(num)) {
		// If it's a whole number, return as is
		if (Number.isInteger(num)) {
			return value;
		}
		// Otherwise format with 2 decimal places
		return num.toFixed(2);
	}

	return value.split("_").join(" ");
}

// Helper function to check if a group is categorical
function isCategoricalGroup(values: string[]): boolean {
	// If any value can't be converted to a number, it's categorical
	return values.some((value) => isNaN(Number(value)) && value !== "Unknown");
}

// Update sorting function:
function sortGroups(a: string, b: string): number {
	// Handle "Unknown" specially
	if (a === "Unknown") return 1;
	if (b === "Unknown") return -1;

	// Try parsing as numbers
	const numA = Number(a);
	const numB = Number(b);

	if (!isNaN(numA) && !isNaN(numB)) {
		return numA - numB;
	}

	// Fall back to string comparison
	return a.localeCompare(b);
}

function calculateStats(values: number[]): {
	mean: number;
	median: number;
	std: number;
	min: number;
	max: number;
} {
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
		mean,
		median,
		std,
		min: sorted[0],
		max: sorted[sorted.length - 1],
	};
}

function calculateBoxPlotData(values: number[]): BoxPlotData {
	const sorted = [...values].sort((a, b) => a - b);

	const q1Index = Math.floor(sorted.length * 0.25);
	const q3Index = Math.floor(sorted.length * 0.75);

	const q1 = sorted[q1Index];
	const q3 = sorted[q3Index];
	const iqr = q3 - q1;

	const lowerFence = q1 - 1.5 * iqr;
	const upperFence = q3 + 1.5 * iqr;

	const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
	const nonOutliers = sorted.filter((v) => v >= lowerFence && v <= upperFence);

	return {
		min: nonOutliers[0],
		q1,
		median: sorted[Math.floor(sorted.length * 0.5)],
		q3,
		max: nonOutliers[nonOutliers.length - 1],
		outliers,
	};
}

function DrugBoxPlot({ drugs }: { drugs: DrugStats[] }) {
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

	const options = {
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
		},
	};

	return (
		<div style={{ height: "300px", width: "100%" }}>
			<Chart type="boxplot" data={data} options={options} />
		</div>
	);
}

function generateReport(groupName: string, drugs: DrugStats[]): string {
	const timestamp = new Date().toISOString().split("T")[0];
	const lines = [
		`Drug Response Report for ${groupName}`,
		`Generated on ${timestamp}`,
		"",
		"Drug Response Summary (sorted by mean AUC, lower is better)",
		"--------------------------------------------------------",
		"",
	];

	drugs.forEach((drug, index) => {
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

function downloadReport(groupName: string, drugs: DrugStats[]) {
	const report = generateReport(groupName, drugs);
	const blob = new Blob([report], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `drug-response-${groupName.toLowerCase().replace(/\s+/g, "-")}-${
		new Date().toISOString().split("T")[0]
	}.txt`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export function DrugResponseHeatmap() {
	const [drugResponseData, setDrugResponseData] = useState<DrugResponse[]>([]);
	const [selectedMetadata, setSelectedMetadata] = useState<string>("");
	const [availableMetadata, setAvailableMetadata] = useState<string[]>([]);
	const [clusterDrugData, setClusterDrugData] = useState<ClusterDrugData>({});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleFetchData = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const rawData = await fetchDrugResponseData();

			if (!rawData || !rawData.sample_id || !Array.isArray(rawData.sample_id)) {
				throw new Error("Invalid data format received from API");
			}

			// Transform the data and collect available metadata fields
			const metadataFields = new Set<string>();
			const transformedData = Array.from(
				{ length: rawData.sample_id.length },
				(_, i) => {
					const entry: DrugResponse = {
						sample_id: rawData.sample_id[i],
						inhibitor: rawData.inhibitor[i],
						auc: rawData.auc[i],
					};

					// Add all available metadata fields
					Object.entries(rawData).forEach(([key, values]) => {
						if (
							key !== "sample_id" &&
							key !== "inhibitor" &&
							key !== "auc" &&
							Array.isArray(values) &&
							values[i] !== undefined &&
							values[i] !== null &&
							(typeof values[i] === "string" || typeof values[i] === "number")
						) {
							entry[key] = values[i];
							metadataFields.add(key);
						}
					});

					return entry;
				}
			);

			// Update available metadata options
			const availableFields = Array.from(metadataFields);
			setAvailableMetadata(availableFields);

			// Set default selected metadata if none is selected
			if (!selectedMetadata || !availableFields.includes(selectedMetadata)) {
				setSelectedMetadata(availableFields[0] || "");
			}

			setDrugResponseData(transformedData);
		} catch (error) {
			console.error("Failed to load drug response data:", error);
			setError(
				`Failed to load drug response data: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
			setDrugResponseData([]);
			setAvailableMetadata([]);
			setSelectedMetadata("");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (drugResponseData.length > 0 && selectedMetadata) {
			// Get all unique values for the selected metadata
			const uniqueValues = [
				...new Set(
					drugResponseData.map(
						(item) => item[selectedMetadata]?.toString() || "Unknown"
					)
				),
			];

			// Skip processing if the group is not categorical
			if (!isCategoricalGroup(uniqueValues)) {
				setClusterDrugData({});
				setError("Please select a categorical grouping variable");
				return;
			}

			// Group data by clusters
			const clusterGroups = new Map<string, DrugResponse[]>();
			drugResponseData.forEach((item) => {
				const cluster =
					selectedMetadata in item ? item[selectedMetadata] : undefined;
				let clusterValue = "Unknown";

				if (cluster !== undefined && cluster !== null) {
					clusterValue = cluster.toString();
				}

				if (!clusterGroups.has(clusterValue)) {
					clusterGroups.set(clusterValue, []);
				}
				clusterGroups.get(clusterValue)?.push(item);
			});

			// Calculate drug stats for each cluster
			const newClusterDrugData: ClusterDrugData = {};

			clusterGroups.forEach((samples, cluster) => {
				// Group by drugs within cluster
				const drugGroups = new Map<string, DrugResponse[]>();
				samples.forEach((item) => {
					if (!drugGroups.has(item.inhibitor)) {
						drugGroups.set(item.inhibitor, []);
					}
					drugGroups.get(item.inhibitor)?.push(item);
				});

				// Calculate stats for each drug
				const drugStats: DrugStats[] = [];
				drugGroups.forEach((drugSamples, drug) => {
					if (drugSamples.length >= MIN_SAMPLES && drug) {
						const aucValues = drugSamples.map((d) => d.auc);
						const stats = calculateStats(aucValues);
						const boxPlotData = calculateBoxPlotData(aucValues);

						drugStats.push({
							drug,
							avgAUC: stats.mean,
							medianAUC: stats.median,
							stdAUC: stats.std,
							minAUC: stats.min,
							maxAUC: stats.max,
							sampleCount: drugSamples.length,
							rawValues: aucValues,
							boxPlotData,
						});
					}
				});

				// Sort drugs by average AUC (ascending - lower is better)
				drugStats.sort((a, b) => a.avgAUC - b.avgAUC);

				newClusterDrugData[cluster] = {
					totalSamples: samples.length,
					drugs: drugStats,
				};
			});

			setClusterDrugData(newClusterDrugData);
		}
	}, [drugResponseData, selectedMetadata]);

	return (
		<Card className="h-full w-full">
			<CardHeader>
				<CardTitle>Drug Response Summary per Group</CardTitle>
				<CardDescription>
					Each drug requires at least {MIN_SAMPLES} patient samples for
					analysis. Area Under the Curve (AUC) values indicate drug
					effectiveness - lower AUC means better response to treatment. Click
					any group to see detailed drug response data and statistics.
				</CardDescription>
				<div className="flex flex-col sm:flex-row gap-4 mt-4">
					<Select value={selectedMetadata} onValueChange={setSelectedMetadata}>
						<SelectTrigger className="w-full sm:w-[180px]">
							<SelectValue placeholder="Select grouping" />
						</SelectTrigger>
						<SelectContent>
							{availableMetadata.map((field) => (
								<SelectItem key={field} value={field}>
									{formatMetadataLabel(field)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						onClick={handleFetchData}
						disabled={isLoading}
						className="flex-1 sm:flex-none"
					>
						{isLoading ? "Loading..." : "Fetch Data"}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="flex-grow flex flex-col gap-6">
				{error && (
					<div className="p-4 bg-red-50 border border-red-200 rounded-md">
						<p className="text-red-600 font-medium">{error}</p>
					</div>
				)}
				{drugResponseData.length === 0 && !isLoading ? (
					<div className="flex-grow flex items-center justify-center">
						<p className="text-center text-gray-500">
							Click "Fetch Data" to analyze drug responses
						</p>
					</div>
				) : (
					<ScrollArea className="h-[500px] w-full">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[200px]">
										{formatMetadataLabel(selectedMetadata)}
									</TableHead>
									<TableHead className="pl-4">Drug Response Summary</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{Object.entries(clusterDrugData)
									.sort(([a], [b]) => sortGroups(a, b))
									.map(([cluster, data]) => (
										<TableRow key={`${selectedMetadata}-${cluster}`}>
											<td colSpan={2} className="p-0">
												<Accordion type="single" collapsible className="w-full">
													<AccordionItem
														value={`${selectedMetadata}-${cluster}`}
														className="border-0"
													>
														<div className="flex w-full">
															<div className="w-[200px] py-2">
																<AccordionTrigger className="hover:no-underline w-full">
																	<span className="text-left">
																		<span className="font-medium">
																			{formatGroupValue(cluster)}
																		</span>
																	</span>
																</AccordionTrigger>
															</div>

															<div className="ml-4 flex-1 py-2 pr-4 flex justify-between items-center">
																<span className="text-muted-foreground">
																	{data.drugs.length} drugs with sufficient
																	samples
																</span>
																<Button
																	variant="outline"
																	size="sm"
																	className="h-8"
																	onClick={(e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		downloadReport(
																			formatGroupValue(cluster),
																			data.drugs
																		);
																	}}
																>
																	<DownloadIcon className="mr-2 h-4 w-4" />
																	Download Report
																</Button>
															</div>
														</div>
														<AccordionContent>
															<div className="py-4 px-6 bg-muted/5">
																<DrugBoxPlot drugs={data.drugs} />
																<div className="space-y-4 mt-4">
																	{data.drugs
																		.filter((drug) => drug && drug.drug)
																		.map((drug, index) => (
																			<div
																				key={drug.drug}
																				className="flex flex-col gap-1"
																			>
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
																						Median AUC:{" "}
																						{drug.medianAUC.toFixed(3)}
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
															</div>
														</AccordionContent>
													</AccordionItem>
												</Accordion>
											</td>
										</TableRow>
									))}
							</TableBody>
						</Table>
					</ScrollArea>
				)}
			</CardContent>
		</Card>
	);
}
