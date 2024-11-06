import { useState } from "react";
import {
	fetchTSNEData,
	fetchKNNData,
	fetchMutationTSNEData,
} from "@/utils/api"; // Updated import to include fetchMutationData
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
	[key: string]: string | number; // Allow for dynamic metadata attributes
}

interface MutationDataItem {
	sample_id: string;
	gene_id: string;
	variant: string;
	aa_position: string;
	VAF: number;
	ref: string;
	alt: string;
	study: string;
	cluster: string;
}

interface EnrichedGenesData {
	genes: {
		gene: string;
		count: number;
		neighborFrequency: string;
		databaseFrequency: string;
		enrichmentRatio: number;
		probabilityScore: number;
	}[];
	mutations: MutationDataItem[];
}

type ReportData = EnrichedGenesData;

export function KNNReportMutation() {
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [, setKnnData] = useState<KNNDataItem[]>([]);
	const [, setMutationData] = useState<MutationDataItem[]>([]);
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
			const mutationResult = await fetchMutationTSNEData();

			setTsneData(tsneResult);
			setKnnData(knnResult);
			setMutationData(mutationResult);
			generateReport(tsneResult, knnResult, mutationResult, kValue);

			// Select the first uploaded sample after generating the report
			const firstUploadedSample = tsneResult.find(
				(d: TSNEDataItem) => d.data_source === "uploaded"
			);
			if (firstUploadedSample) {
				setSelectedSample(firstUploadedSample.sample_id);
			}
		} catch (error) {
			console.error("Failed to load TSNE, KNN, or Mutation data:", error);
			setError("Failed to load data. Please try again.");
			setSelectedSample(null);
		} finally {
			setIsLoading(false);
		}
	};

	const generateReport = (
		tsneData: TSNEDataItem[],
		knnData: KNNDataItem[],
		mutationData: MutationDataItem[],
		k: number
	) => {
		const uploadedSamples = tsneData.filter(
			(d) => d.data_source === "uploaded"
		);
		const newReport: Record<string, Record<string, ReportData>> = {};

		uploadedSamples.forEach((sample) => {
			const knnItem = knnData.find(
				(item) => item.sample_id === sample.sample_id
			);

			if (knnItem) {
				const neighbors = knnItem.knn_indices
					.slice(0, k)
					.map((index) => tsneData[index - 1])
					.filter(Boolean);

				// Get mutations for neighbors
				const neighborMutations = mutationData.filter((mutation) =>
					neighbors.some((n) => n.sample_id === mutation.sample_id)
				);

				// Group mutations by gene
				const geneGroups = neighborMutations.reduce((acc, mutation) => {
					if (!acc[mutation.gene_id]) {
						acc[mutation.gene_id] = [];
					}
					acc[mutation.gene_id].push(mutation);
					return acc;
				}, {} as Record<string, MutationDataItem[]>);

				// Calculate enrichment for each gene
				const enrichedGenes = Object.entries(geneGroups)
					.map(([gene, mutations]) => {
						const neighborCount = new Set(mutations.map((m) => m.sample_id))
							.size;
						const totalSamples = tsneData.length;
						const databaseCount = mutationData.filter(
							(m) => m.gene_id === gene
						).length;

						// Skip genes with fewer than 5 cases in the database
						if (databaseCount < 5 || neighborCount < 2) {
							return null;
						}

						// Calculate frequencies and enrichment ratio
						const neighborFreq = neighborCount / k;
						const databaseFreq = databaseCount / totalSamples;
						const logEnrichmentRatio = Math.log(neighborFreq / databaseFreq);

						// Calculate probability based on database frequency
						const p = databaseCount / totalSamples;
						const probabilityScore = calculateBinomialProbability(
							k,
							neighborCount,
							p
						);

						return {
							gene,
							count: mutations.length,
							neighborFrequency: `${neighborCount}/${k}`,
							databaseFrequency: `${databaseCount}/${totalSamples}`,
							enrichmentRatio: Number(logEnrichmentRatio.toFixed(2)),
							probabilityScore,
						};
					})
					.filter((gene): gene is NonNullable<typeof gene> => gene !== null)
					.sort((a, b) => b.enrichmentRatio - a.enrichmentRatio); // Higher enrichment ratio first

				const sampleReport = {
					enriched_genes: {
						genes: enrichedGenes.sort(
							(a, b) => a.probabilityScore - b.probabilityScore
						),
						mutations: neighborMutations,
					},
				};

				newReport[sample.sample_id] = sampleReport;
			}
		});

		setReport(newReport);
	};

	return (
		<Card className="w-full ">
			<CardHeader>
				<CardTitle>KNN Mutation Report for Uploaded Samples</CardTitle>
				<CardDescription className="text-sm ">
					This analysis identifies enriched mutations in neighboring samples
					using KNN. For each uploaded sample, it analyzes mutations present in
					its K nearest neighbors, calculating enrichment ratios and statistical
					significance compared to the overall database frequency. Genes are
					ranked by their enrichment scores and binomial probability, with
					detailed variant information available for each gene.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-6 mb-6">
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
				{error && <p className="text-red-500 mb-4">{error}</p>}
				{selectedSample && report[selectedSample] && (
					<Card className="mb-4">
						<CardHeader>
							<CardTitle className="truncate">
								Sample ID: {selectedSample}
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0">
							{report[selectedSample]["enriched_genes"] && (
								<Accordion type="single" collapsible className="w-full">
									{/* Header row - hidden on mobile, shown on larger screens */}
									<div className="hidden md:flex w-full py-2 px-6 font-medium text-sm border-b">
										<div className="w-1/5">Gene</div>
										<div className="w-1/5">Neighbor Count</div>
										<div className="w-1/5">Database Count</div>
										<div className="w-1/5">Log Enrichment Ratio</div>
										<div className="w-1/5">Binomial Probability</div>
									</div>
									{(
										report[selectedSample][
											"enriched_genes"
										] as EnrichedGenesData
									).genes.map((gene) => (
										<AccordionItem key={gene.gene} value={gene.gene}>
											<AccordionTrigger className="hover:no-underline px-6">
												{/* Mobile layout - stack vertically */}
												<div className="grid md:hidden w-full text-sm">
													<span className="text-left font-medium mb-2">
														{gene.gene}
													</span>
													<div className="grid grid-cols-1 gap-1 text-xs">
														<div className="flex justify-between">
															<span className="text-muted-foreground">
																Neighbors:
															</span>
															<span>{gene.neighborFrequency}</span>
														</div>
														<div className="flex justify-between">
															<span className="text-muted-foreground">
																Database:
															</span>
															<span>{gene.databaseFrequency}</span>
														</div>
														<div className="flex justify-between">
															<span className="text-muted-foreground">
																Enrichment:
															</span>
															<span className="flex items-center">
																{gene.enrichmentRatio > 0 ? (
																	<span className="text-green-500 mr-1">↑</span>
																) : (
																	<span className="text-red-500 mr-1">↓</span>
																)}
																{gene.enrichmentRatio}
															</span>
														</div>
														<div className="flex justify-between">
															<span className="text-muted-foreground">
																P-value:
															</span>
															<span>
																{Number(gene.probabilityScore.toExponential(2))}
															</span>
														</div>
													</div>
												</div>
												{/* Desktop layout - fixed enrichment ratio alignment */}
												<div className="hidden md:flex w-full text-sm items-center">
													<span className="w-1/5">{gene.gene}</span>
													<span className="w-1/5">
														{gene.neighborFrequency}
													</span>
													<span className="w-1/5">
														{gene.databaseFrequency}
													</span>
													<div className="w-1/5">
														{gene.enrichmentRatio > 0 ? (
															<span className="text-green-500">↑ </span>
														) : (
															<span className="text-red-500">↓ </span>
														)}
														{gene.enrichmentRatio}
													</div>
													<span className="w-1/5">
														{Number(gene.probabilityScore.toExponential(2))}
													</span>
												</div>
											</AccordionTrigger>
											<AccordionContent>
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>Sample ID</TableHead>
															<TableHead>VAF</TableHead>
															<TableHead>Variant</TableHead>
															<TableHead>AA Position</TableHead>
															<TableHead>Ref</TableHead>
															<TableHead>Alt</TableHead>
															<TableHead>Study</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{(
															report[selectedSample][
																"enriched_genes"
															] as EnrichedGenesData
														).mutations
															.filter(
																(mutation) => mutation.gene_id === gene.gene
															)
															.map((mutation, index) => (
																<TableRow
																	key={`${mutation.sample_id}-${index}`}
																>
																	<TableCell className="text-left">
																		{mutation.sample_id}
																	</TableCell>
																	<TableCell className="text-left">
																		{mutation.VAF}
																	</TableCell>
																	<TableCell className="text-left">
																		{mutation.variant}
																	</TableCell>
																	<TableCell className="text-left">
																		{mutation.aa_position}
																	</TableCell>
																	<TableCell className="text-left">
																		{mutation.ref}
																	</TableCell>
																	<TableCell className="text-left">
																		{mutation.alt}
																	</TableCell>
																	<TableCell className="text-left">
																		{mutation.study}
																	</TableCell>
																</TableRow>
															))}
													</TableBody>
												</Table>
											</AccordionContent>
										</AccordionItem>
									))}
								</Accordion>
							)}
						</CardContent>
					</Card>
				)}
			</CardContent>
		</Card>
	);
}

export default KNNReportMutation;
