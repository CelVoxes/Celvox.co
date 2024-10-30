import { useState, useEffect } from "react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	fetchKNNData,
	fetchDrugResponseData,
	fetchTSNEData,
	fetchMutationTSNEData,
	fetchAIReport,
} from "@/utils/api";
import {
	adjustPValues,
	calculateHypergeometricPValue,
	renderMarkdown,
	calculateTTest,
} from "@/utils/zzz";
import { Slider } from "@/components/ui/slider";

interface DrugData {
	drug: string;
	averageAUC: number;
	count: number;
	aucs: number[];
	totalSamples: number; // Add this line
}

interface DrugComparison {
	drug: string;
	neighborAvg: number;
	allSamplesAvg: number;
	pValue: number;
	significant: boolean;
	totalSamples?: number; // Add this optional property
}

interface DrugReport {
	allSamples?: DrugData[];
	neighborSamples?: DrugData[];
	comparisons?: (DrugComparison | null)[];
}

interface MetadataReportItem {
	mostProbable: string;
	probability: number;
	breakdown: Array<{
		value: string | number;
		count: number;
		percentage: number;
		pValue: string;
		adjustedPValue: string;
		totalInCategory: number;
	}>;
}

interface DrugResponse {
	sample_id: string; // Add this line
	inhibitor: string;
	auc: number;
}

interface ProcessedData {
	sample: {
		sample_id: string;
		[key: string]: unknown;
	};
	metadataReport: Record<string, MetadataReportItem>;
	mutationReport: Array<{
		gene: string;
		count: number;
		pValue: number;
		neighborFrequency: string;
		databaseFrequency: string;
	}>;
	drugReport: {
		allSamples?: DrugData[];
		neighborSamples?: DrugData[];
		comparisons?: (DrugComparison | null)[]; // Allow null values in the array
	};
}

// Update this interface
interface TSNEDataItem {
	sample_id: string;
	data_source: string;
	[key: string]: unknown;
}

export const AIAMLReport = () => {
	const [report, setReport] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [visibleChars, setVisibleChars] = useState(0);
	const [progress, setProgress] = useState(0);
	const { toast } = useToast();
	const [selectedSample, setSelectedSample] = useState<string | null>(null);
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [kValue, setKValue] = useState(20);
	const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");

	useEffect(() => {
		fetchTSNEData().then(setTsneData).catch(console.error);
	}, []);

	useEffect(() => {
		if (report) {
			let charIndex = 0;
			const intervalId = setInterval(() => {
				if (charIndex < report.length) {
					setVisibleChars(charIndex + 2);
					setProgress(((charIndex + 2) / report.length) * 100);
					charIndex += 2;
				} else {
					clearInterval(intervalId);
					setProgress(100);
				}
			}, 10);

			return () => clearInterval(intervalId);
		}
	}, [report]);

	const generateReport = async () => {
		if (!selectedSample) {
			toast({
				title: "Error",
				description: "Please select a sample before generating the report.",
				variant: "destructive",
			});
			return;
		}

		setIsLoading(true);
		try {
			const [knnData, drugResponseData, mutationData] = await Promise.all([
				fetchKNNData(kValue),
				fetchDrugResponseData(),
				fetchMutationTSNEData(),
			]);

			const processedData = processData(
				selectedSample,
				knnData,
				drugResponseData,
				mutationData,
				tsneData,
				kValue
			);

			if (processedData) {
				const aiReport = await generateAIReport(processedData);
				setReport(aiReport);
			} else {
				setReport("Failed to process data. Please try again.");
			}
		} catch (error) {
			console.error("Error generating report:", error);
			setReport("Failed to generate report. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const processData = (
		selectedSample: string,
		knnData: { sample_id: string; knn_indices: number[] }[],
		drugResponseData: { sample_id: string; inhibitor: string; auc: number }[],
		mutationData: { sample_id: string; gene_id: string }[],
		tsneData: TSNEDataItem[],
		k: number
	) => {
		const sample = tsneData.find((d) => d.sample_id === selectedSample);
		const knnItem = knnData.find((item) => item.sample_id === selectedSample);

		if (!sample || !knnItem) {
			return null;
		}

		const neighbors = knnItem.knn_indices
			.slice(0, k)
			.map((index: number) => tsneData[index - 1])
			.filter(Boolean);

		const neighborSampleIds = neighbors.map(
			(neighbor: { sample_id: string }) => neighbor.sample_id
		);

		// Process metadata
		const metadataReport = processMetadata(neighbors, tsneData, k);
		// Process mutations
		const mutationReport = processMutations(
			mutationData,
			neighborSampleIds,
			k,
			mutationData.length
		);
		// Process drug response
		const drugReport = processDrugResponse(
			drugResponseData,
			neighborSampleIds,
			k
		);

		return {
			sample,
			metadataReport,
			mutationReport,
			drugReport,
		};
	};

	const processMetadata = (
		neighbors: { sample_id: string }[],
		tsneData: TSNEDataItem[],
		k: number
	) => {
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

		const report: Record<string, MetadataReportItem> = {};

		// Calculate overall frequencies
		const overallFrequencies: Record<
			string,
			Record<string | number, number>
		> = {};
		METADATA_ATTRIBUTES.forEach((attr) => {
			overallFrequencies[attr] = tsneData.reduce(
				(acc: Record<string | number, number>, sample) => {
					const value = sample[attr as keyof typeof sample];
					if (value !== null && value !== undefined && value !== "NA") {
						acc[value as string | number] =
							(acc[value as string | number] || 0) + 1;
					}
					return acc;
				},
				{}
			);
		});

		METADATA_ATTRIBUTES.forEach((attr) => {
			const values = neighbors
				.map((neighbor) => neighbor[attr as keyof typeof neighbor])
				.filter(
					(value): value is string =>
						value !== null && value !== undefined && value !== "NA"
				);

			if (values.length === 0) {
				report[attr] = {
					mostProbable: "No data available",
					probability: 0,
					breakdown: [],
				};
			} else {
				const valueCount = values.reduce((acc, value) => {
					acc[value] = (acc[value] || 0) + 1;
					return acc;
				}, {} as Record<string | number, number>);

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

				report[attr] = {
					mostProbable: mostProbableValue,
					probability: mostProbableCount / k,
					breakdown: pValues.map((item) => ({
						value: item.value,
						count: item.count,
						percentage: (item.count / k) * 100,
						pValue: item.pValue !== null ? item.pValue.toExponential(2) : "N/A",
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

		return report;
	};

	const processMutations = (
		mutationData: { sample_id: string; gene_id: string }[],
		neighborSampleIds: string[],
		k: number,
		totalSamples: number
	) => {
		// Implementation similar to KNNReportMutation component
		const neighborMutations = mutationData.filter((mutation) =>
			neighborSampleIds.includes(mutation.sample_id)
		);

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

		const geneSampleCounts = Object.fromEntries(
			Object.entries(geneCount).map(([gene, sampleSet]) => [
				gene,
				sampleSet.size as number,
			])
		);

		const enrichedGenes = Object.entries(geneSampleCounts)
			.map(([gene, count]) => {
				const K = mutationData.filter((m) => m.gene_id === gene).length;
				const N = totalSamples;
				const n = k;
				const pValue = calculateHypergeometricPValue(count, n, K, N);
				return {
					gene,
					count,
					pValue,
					neighborFrequency: `${count}/${n}`,
					databaseFrequency: `${K}/${N}`,
				};
			})
			.filter((gene) => gene.pValue < 0.05)
			.sort((a, b) => a.pValue - b.pValue);
		return enrichedGenes;
	};

	const processDrugResponse = (
		drugResponseData: {
			sample_id: string;
			inhibitor: string;
			auc: number;
		}[],
		neighborSampleIds: string[],
		k: number
	) => {
		if (!drugResponseData || !Array.isArray(drugResponseData)) {
			console.error(
				"Drug response data is not in the expected format:",
				drugResponseData
			);
			return { allSamples: [], neighborSamples: [], comparisons: [] };
		}

		// Create an array of objects from the drugResponseData
		const drugResponses = drugResponseData.map((item) => ({
			sample_id: item.sample_id,
			inhibitor: item.inhibitor,
			auc: item.auc,
		}));

		// Function to process drug responses
		const processDrugSensitivity = (responses: DrugResponse[]) => {
			const sensitivity = responses.reduce(
				(
					acc: Record<
						string,
						{ count: number; totalAUC: number; aucs: number[] }
					>,
					response: DrugResponse
				) => {
					const inhibitor = response.inhibitor || "Unknown";
					if (!acc[inhibitor]) {
						acc[inhibitor] = { count: 0, totalAUC: 0, aucs: [] };
					}
					acc[inhibitor].count += 1;
					acc[inhibitor].totalAUC += response.auc;
					acc[inhibitor].aucs.push(response.auc);
					return acc;
				},
				{} as Record<
					string,
					{ count: number; totalAUC: number; aucs: number[] }
				>
			);

			return Object.entries(sensitivity)
				.map(([drug, { count, totalAUC, aucs }]) => ({
					drug,
					averageAUC: totalAUC / count,
					count,
					aucs,
					totalSamples: count, // Add this line
				}))
				.filter((item) => !isNaN(item.averageAUC))
				.sort((a, b) => b.averageAUC - a.averageAUC);
		};

		// Process all samples
		const allSamples = processDrugSensitivity(
			drugResponses.filter(
				(response) =>
					response.inhibitor != null &&
					response.auc != null &&
					!isNaN(response.auc)
			)
		);

		// Process neighbor samples (limited to k closest neighbors)
		const neighborDrugResponses = drugResponses.filter(
			(response: DrugResponse) =>
				neighborSampleIds.slice(0, k).includes(response.sample_id) &&
				response.inhibitor != null &&
				response.auc != null &&
				!isNaN(response.auc)
		);
		const neighborSamples = processDrugSensitivity(neighborDrugResponses);
		// Compare neighbor samples to the rest
		const comparisons = allSamples
			.map((drug) => {
				const neighborDrug = neighborSamples.find((n) => n.drug === drug.drug);
				if (!neighborDrug) return null;

				const restSamples = drug.aucs.filter(
					(auc) => !neighborDrug.aucs.includes(auc)
				);
				const tTestResult = calculateTTest(neighborDrug.aucs, restSamples);

				return {
					drug: drug.drug,
					neighborAvg: neighborDrug.averageAUC,
					allSamplesAvg: drug.averageAUC,
					pValue: tTestResult.pValue,
					significant: tTestResult.pValue < 0.05,
				};
			})
			.filter(Boolean);
		return { allSamples, neighborSamples, comparisons };
	};

	const generateAIReport = async (processedData: ProcessedData) => {
		if (!processedData) {
			return "Unable to generate report due to missing data.";
		}

		const { sample, metadataReport, mutationReport, drugReport } =
			processedData;

		const metadataSection = generateMetadataSection(metadataReport);
		const mutationSection = generateMutationSection(mutationReport);
		const drugResponseSection = generateDrugResponseSection(drugReport);
		const integratedAnalysis = await generateIntegratedAnalysis(
			metadataReport,
			mutationReport,
			drugReport
		);

		return `
## AI-Generated AML Report for Sample ${sample.sample_id}

### 1. Sample Information Summary
- Sample ID: ${sample.sample_id}
- Data sources: Gene expression, Mutations, Drug response

### 2. Metadata Analysis
${metadataSection}

### 3. Mutation Analysis
${mutationSection}

### 4. Drug Response Analysis (ex-vivo)
${drugResponseSection}

### 5. Integrated Analysis (AI-generated)
${integratedAnalysis}


Please note that this AI-generated report is for research purposes only and should not be used as a substitute for professional medical advice or diagnosis.
		`;
	};

	const generateMetadataSection = (
		metadataReport: Record<string, MetadataReportItem>
	) => {
		return Object.entries(metadataReport)
			.map(([attr, data]: [string, MetadataReportItem]) => {
				const breakdown = data.breakdown || [];
				const smallestPValueItem = breakdown.reduce(
					(min: { pValue: string }, item: { pValue: string }) =>
						parseFloat(item.pValue) < parseFloat(min.pValue) ? item : min,
					{ pValue: "1" }
				);
				const smallestPValue = parseFloat(smallestPValueItem.pValue);
				const isPValueSignificant = smallestPValue < 0.05;

				return `- ${attr}: ${
					data.mostProbable
				} (p-value: ${smallestPValue.toExponential(2)})${
					isPValueSignificant ? " (significant)" : ""
				}`;
			})
			.join("\n");
	};

	const generateMutationSection = (
		mutationReport: {
			gene: string;
			count: number;
			pValue: number;
			neighborFrequency: string;
		}[]
	) => {
		return mutationReport
			.slice(0, 5)
			.map(
				(gene: {
					gene: string;
					count: number;
					pValue: number;
					neighborFrequency: string;
				}) => {
					return `- ${gene.gene}: Found in ${
						gene.neighborFrequency
					} neighbors (p-value: ${gene.pValue.toExponential(2)})`;
				}
			)
			.join("\n");
	};

	const generateDrugResponseSection = (drugReport: DrugReport) => {
		if (
			!drugReport ||
			!drugReport.comparisons ||
			drugReport.comparisons.length === 0
		) {
			return "No valid drug response data available for this sample.";
		}

		const drugCounts = drugReport.allSamples?.map((drug: DrugData) => ({
			...drug,
			totalSamples: drug.count,
		}));

		// Filter drugs with at least 40 total samples
		const validDrugs = drugCounts?.filter(
			(drug: DrugData) => drug.totalSamples >= 40
		);

		// Filter comparisons to only include valid drugs
		const validComparisons = drugReport.comparisons?.filter(
			(comparison): comparison is DrugComparison =>
				comparison !== null &&
				validDrugs?.some((drug: DrugData) => drug.drug === comparison.drug) ===
					true
		);

		// Add totalSamples to comparisons
		validComparisons?.forEach((comparison: DrugComparison) => {
			const drug = validDrugs?.find(
				(d: DrugData) => d.drug === comparison.drug
			);
			if (drug) {
				comparison.totalSamples = drug.totalSamples;
			}
		});

		const significantDrugs = validComparisons
			?.filter((drug: DrugComparison) => drug.pValue < 0.05)
			.sort((a: DrugComparison, b: DrugComparison) => a.pValue - b.pValue)
			.slice(0, 5);

		const topDrugs = validComparisons
			.sort(
				(a: DrugComparison, b: DrugComparison) => a.neighborAvg - b.neighborAvg
			)
			.slice(0, 5);

		let report = "";

		if (significantDrugs.length > 0) {
			report += `
#### Statistically Significant Drug Responses:
${generateDrugList(significantDrugs, true)}

Note: Lower AUC indicates higher sensitivity. P-value threshold: 0.05.
`;
		}

		report += `
#### Top 5 Most Sensitive Drug Responses:
${generateDrugList(topDrugs, false)}

Note: These drugs show the lowest AUC values for this sample's neighbors, indicating higher sensitivity.
`;

		return report.trim();
	};

	const generateDrugList = (
		drugs: DrugComparison[],
		isSignificant: boolean
	) => {
		return drugs
			.map((drug) => {
				const difference = drug.neighborAvg - drug.allSamplesAvg;
				const sensitivity = difference < 0 ? "more" : "less";
				return `- ${drug.drug}: ${drug.neighborAvg.toFixed(2)} AUC (${Math.abs(
					difference
				).toFixed(
					2
				)} ${sensitivity} sensitive than average, p=${drug.pValue.toExponential(
					2
				)}${isSignificant ? " significant" : ""})`;
			})
			.join("\n");
	};

	const generateIntegratedAnalysis = async (
		metadataReport: Record<string, MetadataReportItem>,
		mutationReport: {
			gene: string;
			count: number;
			pValue: number;
			neighborFrequency: string;
		}[],
		drugReport: DrugReport
	) => {
		const metadataSection = generateMetadataSection(metadataReport);
		const mutationSection = generateMutationSection(mutationReport);
		const drugSection = generateDrugResponseSection(drugReport);

		const patientInfo =
			"You are an expert in AML research specializing in hematology. Generate an integrated analysis based on following information about the patient: " +
			metadataSection +
			"\n" +
			mutationSection +
			"\n" +
			drugSection +
			"\n" +
			"Add relevant references to the data used to support the analysis. Make sure to use markdown formatting for the response.";

		// Generate integrated analysis combining metadata, mutations, and drug response
		const aiReport = await fetchAIReport(patientInfo, selectedModel);

		// Check if aiReport.summary is an array and has at least one element
		if (Array.isArray(aiReport.summary) && aiReport.summary.length > 0) {
			console.log(aiReport.summary[0]);
			return aiReport.summary[0];
		} else {
			return "Unable to generate integrated analysis. Please try again.";
		}
	};

	const copyToClipboard = () => {
		navigator.clipboard.writeText(report).then(() => {
			toast({
				title: "Copied!",
				description: "Report copied to clipboard",
			});
		});
	};

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>
					<div className="text-2xl font-bold text-purple-600">AI Assistant</div>
					<div className="text-sm text-blue-600">(Experimental)</div>
				</CardTitle>
				<CardDescription>
					Leverage Artificial Intelligence to gain insights into uploaded
					samples
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
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

				<div className="flex items-center space-x-4">
					<span className="w-24">Model:</span>
					<Select onValueChange={setSelectedModel} value={selectedModel}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Select a model" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
							<SelectItem value="gpt-4o">GPT-4o</SelectItem>
							<SelectItem value="gpt-o1-mini">GPT-o1-mini</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center space-x-4">
					<span className="w-24">K Value:</span>
					<div className="flex-1">
						<Slider
							value={[kValue]}
							onValueChange={(value) => setKValue(value[0])}
							max={50}
							min={5}
							step={1}
						/>
					</div>
					<span className="w-12 text-right">{kValue}</span>
				</div>

				<Button
					onClick={generateReport}
					disabled={isLoading || !selectedSample}
					className="w-full"
				>
					{isLoading ? (
						<div className="items-center space-x-2 flex">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							<span>Analyzing...</span>
						</div>
					) : (
						<span>Generate Report</span>
					)}
				</Button>

				{report && (
					<div className="mt-8 bg-white p-8 rounded-lg shadow-lg w-full">
						<div
							className="transition-all duration-500 ease-in-out rounded-full mt-4"
							style={{
								width: `${progress}%`,
								height: "4px",
								backgroundColor: "#4F46E5",
							}}
						/>
						<Separator className="my-2" />
						<div className="text-sm text-justify overflow-hidden relative">
							{renderMarkdown(report.slice(0, visibleChars))}
						</div>
						<div className="mt-4 flex justify-end">
							<Button onClick={copyToClipboard} variant="outline" size="sm">
								<Copy className="w-4 h-4 mr-2" />
								Copy Report
							</Button>
						</div>
					</div>
				)}
			</CardContent>
			<CardFooter className="text-center text-sm text-gray-500">
				AI models may not always be accurate. Always consult with medical
				professionals before making any clinical decisions.
			</CardFooter>
		</Card>
	);
};

export default AIAMLReport;
