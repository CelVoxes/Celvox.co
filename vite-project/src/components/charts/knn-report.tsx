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
import { PDFChart } from "@/components/charts/histogram-chart";
import { generateKNNReport } from "@/utils/reportUtils";
import { BreakdownItem, KNNDataItem, TSNEDataItem } from "@/utils/interfaces";

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
			const generatedReport = generateKNNReport(tsneResult, knnResult, kValue); // Store the generated report
			setReport(generatedReport); // Update the report state

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

	function formatAttribute(attr: string): string {
		return attr
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");
	}

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>KNN Metadata Report for Uploaded Samples</CardTitle>
				<CardDescription className="text-sm">
					This report analyzes your sample using K-Nearest Neighbors (KNN) to
					find similar samples in our database. For each metadata attribute
					(like diagnosis, tissue type, etc.), it shows the distribution of
					values among the K most similar samples, highlighting statistically
					significant patterns and enrichments.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col space-y-4 mb-6">
					<div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
						<span className="w-24">K Value:</span>
						<div className="flex-1 flex items-center space-x-4">
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
					</div>
					<div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
						<span className="w-24">Sample:</span>
						<Select
							onValueChange={setSelectedSample}
							value={selectedSample || undefined}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select a sample" />
							</SelectTrigger>
							<SelectContent className="max-h-[300px]">
								{tsneData
									.filter((d) => d.data_source === "uploaded")
									.map((sample) => (
										<SelectItem
											key={sample.sample_id}
											value={sample.sample_id}
											className="break-all pr-6"
										>
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
							<CardTitle className="break-all">
								Sample ID: {selectedSample}
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0">
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
										const typedData = data as { breakdown: BreakdownItem[] };
										const smallestPValueItem = typedData.breakdown.reduce(
											(min, item) =>
												item.probabilityScore < min.probabilityScore
													? item
													: min
										);
										const smallestPValue = smallestPValueItem.probabilityScore;
										const isPValueSignificant = smallestPValue < 0.05;

										return (
											<AccordionItem key={attr} value={attr}>
												<AccordionTrigger
													className={` text-left  ${
														isPValueSignificant ? "bg-green-100" : ""
													}`}
												>
													{isContinuousVariable(typedData.breakdown) ? (
														<>
															{formatAttribute(attr)}:{" "}
															{calculateMedian(typedData.breakdown).toFixed(2)}{" "}
															(median)
														</>
													) : (
														<>{formatAttribute(attr)}</>
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
															<Table className="block overflow-x-auto whitespace-nowrap sm:table">
																<TableHeader>
																	<TableRow>
																		<TableHead className="min-w-[100px]">
																			Value
																		</TableHead>
																		<TableHead className="min-w-[80px]">
																			Neighbor Count
																		</TableHead>
																		<TableHead className="min-w-[100px]">
																			Database Count
																		</TableHead>
																		<TableHead className="min-w-[120px]">
																			Log Enrichment Ratio
																		</TableHead>
																		<TableHead className="min-w-[100px]">
																			Binomial Probability
																		</TableHead>
																	</TableRow>
																</TableHeader>
																<TableBody>
																	{typedData.breakdown.map(
																		({
																			value,
																			neighborFrequency,
																			databaseFrequency,
																			enrichmentRatio,
																			probabilityScore,
																		}) => (
																			<TableRow
																				key={value}
																				className={
																					probabilityScore < 0.05
																						? "bg-green-100"
																						: ""
																				}
																			>
																				<TableCell className="text-left">
																					{value}
																				</TableCell>
																				<TableCell className="text-left">
																					{neighborFrequency}
																				</TableCell>
																				<TableCell className="text-left">
																					{databaseFrequency}
																				</TableCell>
																				<TableCell className="text-left">
																					{enrichmentRatio > 0 ? (
																						<span className="text-green-500">
																							↑{" "}
																						</span>
																					) : (
																						<span className="text-red-500">
																							↓{" "}
																						</span>
																					)}
																					{enrichmentRatio.toFixed(2)}
																				</TableCell>
																				<TableCell className="text-left">
																					{probabilityScore.toExponential(2)}
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
