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
import { calculateHypergeometricPValue } from "@/utils/zzz";

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

interface EnrichedGenesData {
	genes: {
		gene: string;
		count: number;
		pValue: number;
		adjustedPValue: number;
		neighborFrequency: string;
		databaseFrequency: string;
	}[];
	mutations: MutationDataItem[];
}

interface EnrichedGene {
	gene: string;
	count: number;
	pValue: number;
	adjustedPValue: number;
	neighborFrequency: string;
	databaseFrequency: string;
}

type ReportData = AttributeData | EnrichedGenesData;

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

		// Calculate overall frequencies for each metadata attribute
		const overallGeneFrequencies: Record<
			string,
			Set<string>
		> = mutationData.reduce((acc, sample) => {
			const gene = sample.gene_id;
			if (gene !== null && gene !== undefined && gene !== "NA") {
				if (!acc[gene]) {
					acc[gene] = new Set();
				}
				acc[gene].add(sample.sample_id);
			}
			return acc;
		}, {} as Record<string, Set<string>>);

		// Convert Sets to counts
		const overallGeneSampleCounts = Object.fromEntries(
			Object.entries(overallGeneFrequencies).map(([gene, sampleSet]) => [
				gene,
				sampleSet.size,
			])
		);

		uploadedSamples.forEach((sample) => {
			const knnItem = knnData.find(
				(item) => item.sample_id === sample.sample_id
			);

			if (knnItem) {
				const neighbors = knnItem.knn_indices
					.slice(0, k)
					.map((index) => tsneData[index - 1])
					.filter(Boolean);

				const sampleReport: Record<string, ReportData> = {};

				// Process Mutation Data to Identify Enriched Genes
				const neighborSampleIds = neighbors.map(
					(neighbor) => neighbor.sample_id
				);
				const neighborMutations = mutationData.filter((mutation) =>
					neighborSampleIds.includes(mutation.sample_id)
				);

				// Calculate gene counts among neighbors (count samples, not mutations)
				const geneCount = neighborMutations.reduce((acc, mutation) => {
					const gene = mutation.gene_id;
					if (gene !== null && gene !== undefined && gene !== "NA") {
						if (!acc[gene]) {
							acc[gene] = new Set();
						}
						acc[gene].add(mutation.sample_id);
					}
					return acc;
				}, {} as Record<string, Set<string>>);

				// Convert Sets to counts
				const geneSampleCounts = Object.fromEntries(
					Object.entries(geneCount).map(([gene, sampleSet]) => [
						gene,
						sampleSet.size,
					])
				);

				// Identify enriched genes using hypergeometric test
				const enrichedGenes: EnrichedGene[] = Object.entries(geneSampleCounts)
					.map(([gene, count]) => {
						const K = overallGeneSampleCounts[gene] || 0;
						const N = mutationData.length;
						const n = k; // Number of neighbors
						const pValue = calculateHypergeometricPValue(count, n, K, N);
						return {
							gene,
							count,
							pValue,
							adjustedPValue: 0, // Initialize with 0
							neighborFrequency: `${count}/${n}`,
							databaseFrequency: `${K}/${N}`,
						};
					})
					.filter((gene) => gene.pValue < 0.05)
					.sort((a, b) => a.pValue - b.pValue);

				// Apply Benjamini-Hochberg correction
				const m = enrichedGenes.length;
				enrichedGenes.forEach((gene, i) => {
					gene.adjustedPValue = Math.min(1, (gene.pValue * m) / (i + 1));
				});

				// Attach enriched genes to the report
				sampleReport["enriched_genes"] = {
					genes: enrichedGenes.map((gene) => ({
						...gene,
						adjustedPValue: Number(gene.adjustedPValue.toExponential(2)),
						neighborFrequency: gene.neighborFrequency,
						databaseFrequency: gene.databaseFrequency,
					})),
					mutations: neighborMutations.filter((mutation) =>
						enrichedGenes.some((gene) => gene.gene === mutation.gene_id)
					),
				};

				newReport[sample.sample_id] = sampleReport;
			}
		});

		setReport(newReport);
	};

	return (
		<Card className="w-full ">
			<CardHeader>
				<CardTitle>
					KNN Mutation Report for Uploaded Samples
					<p className="mt-1 text-sm text-blue-600">(Developmental)</p>
				</CardTitle>
				<CardDescription className="text-sm ">
					This section displays a detailed KNN (K-Nearest Neighbors) report for
					the selected sample based on mutation data. It shows the most probable
					enriched genes based on the K nearest neighbors, along with their
					probabilities, p-values, and a breakdown of the neighbor values and
					actual mutation variants.
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
							{report[selectedSample]["enriched_genes"] && (
								<Accordion type="single" collapsible className="w-full">
									<div className="grid grid-cols-5 gap-4 w-full py-2 font-medium text-sm">
										<div className="text-left">Gene</div>
										<div className="text-left">Neighbor Count</div>
										<div className="text-left">Database Count</div>
										<div className="text-left">P-Value</div>
										<div className="text-left">Adjusted P-Value</div>
									</div>
									{(
										report[selectedSample][
											"enriched_genes"
										] as EnrichedGenesData
									).genes.map((gene) => (
										<AccordionItem key={gene.gene} value={gene.gene}>
											<AccordionTrigger className="hover:no-underline">
												<div className="grid grid-cols-5 gap-4 w-full text-sm items-center">
													<span className="text-left">{gene.gene}</span>
													<span className="text-left">
														{gene.neighborFrequency}
													</span>
													<span className="text-left">
														{gene.databaseFrequency}
													</span>
													<span className="text-left">
														{gene.pValue.toExponential(2)}
													</span>
													<span className="text-left">
														{gene.adjustedPValue}
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
