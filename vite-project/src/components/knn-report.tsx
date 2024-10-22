import { useState } from "react";
import { fetchTSNEData, fetchKNNData } from "@/utils/api";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { calculateHypergeometricPValue, adjustPValues } from "@/utils/zzz";
import { PDFChart } from "@/components/histogram-chart";

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
	[key: string]: string | number; // Allow for dynamic metadata attributes
}

const METADATA_ATTRIBUTES = [
	"sex",
	"tissue",
	"prim_rec",
	"FAB",
	"WHO_2022",
	"ICC_2022",
	"KMT2A_diagnosis",
	"rare_diagnosis",
	"clusters",
	"blasts",
];

interface BreakdownItem {
	value: string;
	count: number;
	percentage: number;
	pValue: string;
	adjustedPValue: string;
	totalInCategory: number;
}

interface AttributeData {
	breakdown: BreakdownItem[];
	// Add other properties if needed
}

const isContinuousVariable = (breakdown: BreakdownItem[]): boolean => {
	// Check if all values can be parsed as numbers
	return breakdown.every(
		(item) => !isNaN(parseFloat(item.value)) && isFinite(parseFloat(item.value))
	);
};

const calculateMedian = (breakdown: BreakdownItem[]): number => {
	const sortedValues = breakdown
		.flatMap((item) => Array(item.count).fill(parseFloat(item.value)))
		.sort((a, b) => a - b);
	const mid = Math.floor(sortedValues.length / 2);
	return sortedValues.length % 2 !== 0
		? sortedValues[mid]
		: (sortedValues[mid - 1] + sortedValues[mid]) / 2;
};

export function KNNReport() {
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [, setKnnData] = useState<KNNDataItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [kValue, setKValue] = useState(20);
	const [report, setReport] = useState<Record<string, Record<string, unknown>>>(
		{}
	);
	const [selectedSample, setSelectedSample] = useState<string | null>(null);

	const handleRunReport = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const tsneResult = await fetchTSNEData();
			const knnResult = await fetchKNNData(kValue); // Pass kValue to fetchKNNData
			setTsneData(tsneResult);
			setKnnData(knnResult);
			generateReport(tsneResult, knnResult, kValue); // Pass kValue to generateReport

			// Select the first uploaded sample after generating the report
			const firstUploadedSample = tsneResult.find(
				(d: TSNEDataItem) => d.data_source === "uploaded"
			);
			if (firstUploadedSample) {
				setSelectedSample(firstUploadedSample.sample_id);
			}
		} catch (error) {
			console.error("Failed to load TSNE and KNN data:", error);
			setError("Failed to load TSNE and KNN data. Please try again.");
			setSelectedSample(null);
		} finally {
			setIsLoading(false);
		}
	};

	const generateReport = (
		tsneData: TSNEDataItem[],
		knnData: KNNDataItem[],
		k: number
	) => {
		const uploadedSamples = tsneData.filter(
			(d) => d.data_source === "uploaded"
		);
		const newReport: Record<string, Record<string, unknown>> = {};

		// Calculate overall frequencies for each attribute
		const overallFrequencies: Record<string, Record<string, number>> = {};
		METADATA_ATTRIBUTES.forEach((attr) => {
			overallFrequencies[attr] = tsneData.reduce((acc, sample) => {
				const value = sample[attr];
				if (value !== null && value !== undefined && value !== "NA") {
					acc[value] = (acc[value] || 0) + 1;
				}
				return acc;
			}, {} as Record<string, number>);
		});

		uploadedSamples.forEach((sample) => {
			const knnItem = knnData.find(
				(item) => item.sample_id === sample.sample_id
			);

			if (knnItem) {
				const neighbors = knnItem.knn_indices
					.slice(0, k)
					.map((index) => tsneData[index - 1])
					.filter(Boolean);

				const sampleReport: Record<string, unknown> = {};

				METADATA_ATTRIBUTES.forEach((attr) => {
					const values = neighbors
						.map((neighbor) => neighbor[attr])
						.filter(
							(value): value is string | number =>
								value !== null && value !== undefined && value !== "NA"
						);

					if (values.length === 0) {
						sampleReport[attr] = {
							mostProbable: "No data available",
							probability: 0,
							breakdown: [],
						};
					} else {
						// Calculate value counts within the neighbors
						const valueCount = values.reduce((acc, value) => {
							acc[value] = (acc[value] || 0) + 1;
							return acc;
						}, {} as Record<string, number>);

						const sortedValues = Object.entries(valueCount).sort(
							(a, b) => b[1] - a[1]
						);
						const [mostProbableValue, mostProbableCount] = sortedValues[0];

						const N = tsneData.length; // Total number of samples

						const pValues = sortedValues.map(([value, count]) => {
							const K = overallFrequencies[attr][value] || 0;
							let pValue = null;
							if (K > 0 && N > 0) {
								pValue = calculateHypergeometricPValue(count, k, K, N);
							}
							return { value, count, totalInCategory: K, pValue };
						});

						// Adjust p-values only for non-null values
						const validPValues = pValues.filter((item) => item.pValue !== null);
						const adjustedPValues = adjustPValues(
							validPValues.map((item) => item.pValue as number)
						);

						sampleReport[attr] = {
							mostProbable: mostProbableValue,
							probability: mostProbableCount / k,
							breakdown: pValues.map((item) => ({
								value: item.value,
								count: item.count,
								percentage: (item.count / k) * 100,
								pValue:
									item.pValue !== null ? item.pValue.toExponential(2) : "N/A",
								adjustedPValue:
									item.pValue !== null
										? adjustedPValues[
												validPValues.findIndex((vp) => vp.value === item.value)
										  ].toExponential(2)
										: "N/A",
								totalInCategory: item.totalInCategory,
							})),
						};
					}
				});

				newReport[sample.sample_id] = sampleReport;
			}
		});

		setReport(newReport);
	};

	function formatAttribute(attr: string): string {
		return attr
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");
	}

	return (
		<Card className="w-full ">
			<CardHeader>
				<CardTitle>KNN Metadata Report for Uploaded Samples</CardTitle>
				<CardDescription className="text-sm ">
					This section displays a detailed KNN (K-Nearest Neighbors) report for
					the selected sample based on gene expression data. It shows the most
					probable metadata values for various attributes based on the K nearest
					neighbors, along with their probabilities and a breakdown of the
					neighbor values.
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
					<Card className="mb-4">
						<CardHeader>
							<CardTitle>Sample ID: {selectedSample}</CardTitle>
						</CardHeader>
						<CardContent>
							<Accordion type="single" collapsible className="w-full">
								{Object.entries(report[selectedSample])
									.sort(([, a], [, b]) => {
										const pValueA = Math.min(
											...(
												a as { breakdown: { pValue: string }[] }
											).breakdown.map((item) => parseFloat(item.pValue))
										);
										const pValueB = Math.min(
											...(
												b as { breakdown: { pValue: string }[] }
											).breakdown.map((item) => parseFloat(item.pValue))
										);
										return pValueA - pValueB;
									})
									.map(([attr, data]) => {
										const typedData = data as AttributeData;
										const smallestPValueItem = typedData.breakdown.reduce(
											(min, item) =>
												parseFloat(item.pValue) < parseFloat(min.pValue)
													? item
													: min
										);
										const smallestPValue = parseFloat(
											smallestPValueItem.pValue
										);
										const isPValueSignificant = smallestPValue < 0.05;

										return (
											<AccordionItem key={attr} value={attr}>
												<AccordionTrigger
													className={` text-left  ${
														isPValueSignificant ? "text-green-600" : ""
													}`}
												>
													{isContinuousVariable(typedData.breakdown) ? (
														<>
															{formatAttribute(attr)}:{" "}
															{calculateMedian(typedData.breakdown).toFixed(2)}{" "}
															(median)
														</>
													) : (
														<>
															{formatAttribute(attr)}:{" "}
															{smallestPValueItem.value} (p-value:{" "}
															{smallestPValue.toExponential(2)})
														</>
													)}
												</AccordionTrigger>
												<AccordionContent>
													{isContinuousVariable(typedData.breakdown) ? (
														<PDFChart
															data={typedData.breakdown.map((b) => ({
																x: parseFloat(b.value),
																y: b.count,
															}))}
															attribute={attr}
														/>
													) : (
														<>
															<Table>
																<TableHeader>
																	<TableRow>
																		<TableHead className="text-left ">
																			Value
																		</TableHead>
																		<TableHead className="text-left">
																			Count
																		</TableHead>
																		<TableHead className="text-left">
																			Percentage
																		</TableHead>
																		<TableHead className="text-left">
																			Total in Category
																		</TableHead>
																		<TableHead className="text-left">
																			P-value
																		</TableHead>
																		<TableHead className="text-left">
																			Adjusted P-value
																		</TableHead>
																	</TableRow>
																</TableHeader>
																<TableBody>
																	{typedData.breakdown
																		.sort(
																			(a, b) =>
																				parseFloat(a.adjustedPValue) -
																				parseFloat(b.adjustedPValue)
																		)
																		.map(
																			({
																				value,
																				count,
																				totalInCategory,
																				percentage,
																				pValue,
																				adjustedPValue,
																			}) => (
																				<TableRow
																					key={value}
																					className={
																						parseFloat(pValue) < 0.05
																							? "bg-green-100"
																							: ""
																					}
																				>
																					<TableCell className="text-left">
																						{value}
																					</TableCell>
																					<TableCell className="text-left">
																						{count}/{kValue}
																					</TableCell>
																					<TableCell className="text-left">
																						{percentage.toFixed(2)}%
																					</TableCell>
																					<TableCell className="text-left">
																						{totalInCategory}/{tsneData.length}
																					</TableCell>
																					<TableCell
																						className={`text-left ${pValue}`}
																					>
																						{pValue}
																					</TableCell>
																					<TableCell
																						className={`text-left ${adjustedPValue}`}
																					>
																						{adjustedPValue}
																					</TableCell>
																				</TableRow>
																			)
																		)}
																</TableBody>
															</Table>
														</>
													)}
												</AccordionContent>
											</AccordionItem>
										);
									})}
							</Accordion>
						</CardContent>
					</Card>
				)}
			</CardContent>
		</Card>
	);
}

export default KNNReport;
