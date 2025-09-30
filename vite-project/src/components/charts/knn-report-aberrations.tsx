import { useState } from "react";
import {
	fetchTSNEData,
	fetchKNNData,
	fetchAberrationsTSNEData,
} from "@/utils/api";
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
import { calculateBinomialProbability } from "@/utils/zzz";

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
	[key: string]: string | number;
}

interface AberrationsDataItem {
	sample_id: string;
	[key: string]: string | number;
}

interface EnrichedAberrationsData {
	aberrations: {
		aberration: string;
		count: number;
		neighborFrequency: string;
		databaseFrequency: string;
		enrichmentRatio: number;
		probabilityScore: number;
	}[];
}

type ReportData = EnrichedAberrationsData;

export function KNNReportAberrations() {
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [, setKnnData] = useState<KNNDataItem[]>([]);
	const [, setAberrationsData] = useState<AberrationsDataItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [kValue, setKValue] = useState(20);
	const [report, setReport] = useState<
		Record<string, Record<string, ReportData>>
	>({});
	const [selectedSample, setSelectedSample] = useState<string | null>(null);

	const handleRunReport = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const tsneResult = await fetchTSNEData();
			const knnResult = await fetchKNNData(kValue);
			const aberrationsResult = await fetchAberrationsTSNEData();

			setTsneData(tsneResult);
			setKnnData(knnResult);
			setAberrationsData(aberrationsResult);
			generateReport(tsneResult, knnResult, aberrationsResult, kValue);

			// Select the first uploaded sample after generating the report
			const firstUploadedSample = tsneResult.find(
				(d: TSNEDataItem) => d.data_source === "uploaded"
			);
			if (firstUploadedSample) {
				setSelectedSample(firstUploadedSample.sample_id);
			}
		} catch (error) {
			console.error("Failed to load TSNE, KNN, or Aberrations data:", error);
			setError("Failed to load data. Please try again.");
			setSelectedSample(null);
		} finally {
			setIsLoading(false);
		}
	};

	const generateReport = (
		tsneData: TSNEDataItem[],
		knnData: KNNDataItem[],
		aberrationsData: AberrationsDataItem[],
		k: number
	) => {
		const uploadedSamples = tsneData.filter(
			(d) => d.data_source === "uploaded"
		);
		const newReport: Record<string, Record<string, ReportData>> = {};

		// Create a lookup map for knn data by sample_id for faster access
		const knnMap = new Map(knnData.map((item) => [item.sample_id, item]));

		uploadedSamples.forEach((sample) => {
			const knnItem = knnMap.get(sample.sample_id);

			if (knnItem) {
				// Get the neighbors using the indices from knnItem
				const neighbors = knnItem.knn_indices
					.slice(0, k)
					.map((index) => {
						// Find the sample_id that corresponds to this index in knnData
						const neighborSampleId = knnData[index - 1]?.sample_id;
						if (!neighborSampleId) {
							console.warn(`No KNN data found for index ${index}`);
							return null;
						}
						// Find the corresponding TSNE data point
						const neighborTSNE = tsneData.find(
							(d) => d.sample_id === neighborSampleId
						);
						if (!neighborTSNE) {
							console.warn(`No TSNE data found for sample ${neighborSampleId}`);
							return null;
						}
						return neighborTSNE;
					})
					.filter((n): n is TSNEDataItem => n !== null);

				// Log for debugging
				console.log(
					`Sample ${sample.sample_id} has ${neighbors.length} neighbors`
				);
				console.log(
					"Neighbor sample IDs:",
					neighbors.map((n) => n.sample_id)
				);

				// Get aberrations for neighbors
				const neighborAberrations = aberrationsData.filter((aberration) =>
					neighbors.some((n) => n.sample_id === aberration.sample_id)
				);

				// Group aberrations by type
				const aberrationGroups: Record<
					string,
					{
						aberration: string;
						count: number;
						neighborFrequency: string;
						databaseFrequency: string;
						enrichmentRatio: number;
						probabilityScore: number;
					}
				> = {};

				Object.keys(aberrationsData[0] || {})
					.filter((key) => key !== "sample_id")
					.forEach((aberration) => {
						// Count samples with this aberration in neighbors
						const neighborCount = neighborAberrations.filter(
							(a) => a[aberration as keyof typeof a] === 1
						).length;

						const totalSamples = tsneData.length;
						const databaseCount = aberrationsData.filter(
							(a) => a[aberration as keyof typeof a] === 1
						).length;

						if (databaseCount < 5 || neighborCount < 2) {
							return;
						}

						const neighborFreq = neighborCount / k;
						const databaseFreq = databaseCount / totalSamples;
						const logEnrichmentRatio = Math.log(neighborFreq / databaseFreq);

						const p = databaseCount / totalSamples;
						const probabilityScore = calculateBinomialProbability(
							k,
							neighborCount,
							p
						);

						aberrationGroups[aberration] = {
							aberration,
							count: neighborCount,
							neighborFrequency: `${neighborCount}/${k}`,
							databaseFrequency: `${databaseCount}/${totalSamples}`,
							enrichmentRatio: Number(logEnrichmentRatio.toFixed(2)),
							probabilityScore,
						};
					});

				const enrichedAberrations = Object.values(aberrationGroups).sort(
					(a, b) => b.enrichmentRatio - a.enrichmentRatio
				);

				const sampleReport = {
					aberrations: enrichedAberrations,
				};

				newReport[sample.sample_id] = {
					[`k${k}`]: sampleReport,
				};
			}
		});

		setReport(newReport);
	};

	const selectedReportData =
		selectedSample && report[selectedSample]?.[`k${kValue}`];

	return (
		<Card className="w-full h-full">
			<CardHeader>
				<CardTitle>KNN Aberrations Report</CardTitle>
				<CardDescription>
					Identify aberrations enriched in the KNN neighborhood of uploaded
					samples compared to the background population.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col space-y-4">
				{error && <p className="text-red-500">{error}</p>}

				<div className="space-y-4">
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
							<SelectTrigger className="w-full max-w-[200px] sm:max-w-full">
								<SelectValue
									placeholder="Select a sample"
									className="truncate"
								/>
							</SelectTrigger>
							<SelectContent className="max-h-[300px]">
								<div className="overflow-y-auto max-h-[300px]">
									{tsneData
										.filter((d) => d.data_source === "uploaded")
										.map((sample) => (
											<SelectItem
												key={sample.sample_id}
												value={sample.sample_id}
												className="truncate pr-6"
											>
												{sample.sample_id}
											</SelectItem>
										))}
								</div>
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

				{selectedReportData && (
					<Accordion type="single" collapsible className="w-full">
						<AccordionItem value="aberrations">
							<AccordionTrigger>
								Enriched Aberrations (K={kValue}, Sample: {selectedSample})
							</AccordionTrigger>
							<AccordionContent>
								<div className="max-h-[400px] overflow-y-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Aberration</TableHead>
												<TableHead className="text-right">Count</TableHead>
												<TableHead className="text-right">
													Neighbor Freq
												</TableHead>
												<TableHead className="text-right">
													Database Freq
												</TableHead>
												<TableHead className="text-right">
													Enrichment Ratio
												</TableHead>
												<TableHead className="text-right">
													Probability Score
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{selectedReportData.aberrations.map(
												(aberration, index) => (
													<TableRow key={index}>
														<TableCell className="font-medium">
															{aberration.aberration}
														</TableCell>
														<TableCell className="text-right">
															{aberration.count}
														</TableCell>
														<TableCell className="text-right">
															{aberration.neighborFrequency}
														</TableCell>
														<TableCell className="text-right">
															{aberration.databaseFrequency}
														</TableCell>
														<TableCell className="text-right">
															{aberration.enrichmentRatio}
														</TableCell>
														<TableCell className="text-right">
															{aberration.probabilityScore < 0.001
																? "< 0.001"
																: aberration.probabilityScore.toFixed(4)}
														</TableCell>
													</TableRow>
												)
											)}
											{selectedReportData.aberrations.length === 0 && (
												<TableRow>
													<TableCell
														colSpan={6}
														className="text-center text-gray-500"
													>
														No significantly enriched aberrations found
													</TableCell>
												</TableRow>
											)}
										</TableBody>
									</Table>
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				)}

				{!selectedReportData && selectedSample && (
					<p className="text-gray-500 text-center">
						Click "Generate Report" to analyze aberrations for the selected
						sample.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

export default KNNReportAberrations;
