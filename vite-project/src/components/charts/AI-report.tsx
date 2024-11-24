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
import { Slider } from "@/components/ui/slider";
import ReactMarkdown from "react-markdown";
import {
	fetchKNNData,
	fetchDrugResponseData,
	fetchTSNEData,
	fetchMutationTSNEData,
	fetchAIReport,
} from "@/utils/api";
import { calculateTTest, calculateBinomialProbability } from "@/utils/zzz";
import { generateKNNReport } from "@/utils/reportUtils";
import {
	TSNEDataItem,
	KNNDataItem,
	DrugResponse,
	ProcessedData,
	MetadataReportItem,
	DrugData,
	DrugReport,
	DrugComparison,
	MutationReport,
	BreakdownItem,
} from "@/utils/interfaces";

export const AIAMLReport = () => {
	const [report, setReport] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [visibleChars, setVisibleChars] = useState(0);
	const [progress, setProgress] = useState(0);
	const [selectedSample, setSelectedSample] = useState<string | null>(null);
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [kValue, setKValue] = useState(20);
	const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");
	const { toast } = useToast();

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
					charIndex += 3;
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
		knnData: KNNDataItem[],
		drugResponseData: DrugResponse,
		mutationData: { sample_id: string; gene_id: string }[],
		tsneData: TSNEDataItem[],
		k: number
	): ProcessedData | null => {
		const sample = tsneData.find((d) => d.sample_id === selectedSample);
		const knnItem = knnData.find((item) => item.sample_id === selectedSample);

		console.log("Selected Sample:", selectedSample);
		console.log("KNN Item:", knnItem);

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

		const generatedKNNMeta = generateKNNReport(
			tsneData,
			knnData,
			k
		) as MetadataReportItem[]>;

		console.log("META DATA REPORT");
		console.log(generatedKNNMeta);

		const metadataReport = processMetaReport(generatedKNNMeta, selectedSample);

		const mutationReport = processMutations(
			mutationData,
			neighborSampleIds,
			k,
			mutationData.length
		)[0];
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

	const processMetaReport = (
		metaData: Record<string, BreakdownItem[]>,
		selectedSample: string
	): Record<string, MetadataReportItem> => {
		if (!metaData || !metaData[selectedSample]) {
			return {};
		}

		const selectedSampleMeta = metaData[selectedSample];
		const processedReport: Record<string, MetadataReportItem> = {};

		for (const [key, values] of Object.entries(selectedSampleMeta)) {
			if (values && Array.isArray(values)) {
				processedReport[key] = {
					breakdown: values
						.map((item: BreakdownItem) => item)
						.filter((item): item is BreakdownItem => item.count > 0),
				};
			}
		}

		return processedReport;
	};

	const processMutations = (
		mutationData: { sample_id: string; gene_id: string }[],
		neighborSampleIds: string[],
		k: number,
		totalSamples: number
	): MutationReport[] => {
		const neighborMutations = mutationData.filter((mutation) =>
			neighborSampleIds.includes(mutation.sample_id)
		);

		const geneGroups = neighborMutations.reduce((acc, mutation) => {
			if (!acc[mutation.gene_id]) {
				acc[mutation.gene_id] = [];
			}
			acc[mutation.gene_id].push(mutation);
			return acc;
		}, {} as Record<string, { sample_id: string; gene_id: string }[]>);

		const enrichedGenes = Object.entries(geneGroups)
			.map(([gene, mutations]) => {
				const neighborCount = new Set(mutations.map((m) => m.sample_id)).size;
				const databaseCount = mutationData.filter(
					(m) => m.gene_id === gene
				).length;

				if (databaseCount < 5 || neighborCount < 2) {
					return null;
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
			.sort((a, b) => a.probabilityScore - b.probabilityScore);

		return enrichedGenes.map((gene) => ({
			gene: gene.gene,
			count: gene.count,
			pValue: gene.probabilityScore,
			neighborFrequency: gene.neighborFrequency,
			databaseFrequency: gene.databaseFrequency,
		}));
	};

	const processDrugResponse = (
		drugResponseData: DrugResponse,
		neighborSampleIds: string[],
		k: number
	) => {
		// Transform single drug response into array format
		const transformedDrugResponses = [
			{
				sample_id: drugResponseData.sample_id,
				inhibitor: drugResponseData.inhibitor,
				auc: drugResponseData.auc,
			},
		];

		const filteredDrugResponses = transformedDrugResponses.map((item) => ({
			sample_id: item.sample_id,
			inhibitor: item.inhibitor,
			auc: item.auc,
		}));

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
					totalSamples: count,
				}))
				.filter((item) => !isNaN(item.averageAUC))
				.sort((a, b) => b.averageAUC - a.averageAUC);
		};

		const allSamples = processDrugSensitivity(
			filteredDrugResponses.filter(
				(response) =>
					response.inhibitor != null &&
					response.auc != null &&
					!isNaN(response.auc)
			)
		);

		const neighborDrugResponses = filteredDrugResponses.filter(
			(response: DrugResponse) =>
				neighborSampleIds.slice(0, k).includes(response.sample_id) &&
				response.inhibitor != null &&
				response.auc != null &&
				!isNaN(response.auc)
		);
		const neighborSamples = processDrugSensitivity(neighborDrugResponses);

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
		const mutationSection = generateMutationSection([mutationReport]);
		const drugResponseSection = generateDrugResponseSection(drugReport);

		const integratedAnalysis = await generateIntegratedAnalysis(
			metadataReport,
			mutationReport,
			drugReport
		);

		return `
## AI-Generated AML Report for ${sample.sample_id}

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
				if (breakdown.length === 0) return null;

				const breakdownWithBinomial = breakdown.map((item) => {
					const totalInCategory = item.totalInCategory || 0;
					const totalSamples = tsneData.length;
					const p = totalInCategory / totalSamples;
					const binomialPValue = calculateBinomialProbability(
						kValue,
						item.count,
						p
					);
					return {
						...item,
						binomialPValue,
					};
				});

				// Find the most significant category
				const significantItem = breakdownWithBinomial.reduce(
					(min, item) =>
						item.binomialPValue < min.binomialPValue ? item : min,
					breakdownWithBinomial[0]
				);

				// Only show if there's meaningful data
				if (significantItem.count === 0) return null;

				return `- ${attr}: ${significantItem.value} (${
					significantItem.count
				}/${kValue} samples, p=${significantItem.binomialPValue.toExponential(
					2
				)})${significantItem.binomialPValue < 0.05 ? " *" : ""}`;
			})
			.filter(Boolean) // Remove null entries
			.join("\n");
	};

	const generateMutationSection = (mutationReport: MutationReport[]) => {
		return mutationReport
			.slice(0, 5)
			.map((gene: MutationReport) => {
				if (!gene.neighborFrequency || !gene.databaseFrequency) {
					return `- ${gene.gene}: Data missing for frequency calculations.`;
				}

				return `- ${gene.gene}: Found in ${
					gene.neighborFrequency
				} neighbors (binomial p-value: ${gene.pValue.toExponential(2)})`;
			})
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

		const validDrugs = drugCounts?.filter(
			(drug: DrugData) => drug.totalSamples >= 40
		);

		const validComparisons = drugReport.comparisons?.filter(
			(comparison): comparison is DrugComparison =>
				comparison !== null &&
				validDrugs?.some((drug: DrugData) => drug.drug === comparison.drug) ===
					true
		);

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
		mutationReport: MutationReport,
		drugReport: DrugReport
	) => {
		const metadataSection = generateMetadataSection(metadataReport);
		const mutationSection = generateMutationSection([mutationReport]);
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

		const aiReport = await fetchAIReport(patientInfo, selectedModel);

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
		<Card className="w-full max-w-full overflow-x-hidden">
			<CardHeader>
				<CardTitle>
					<div className="text-lg md:text-2xl font-bold text-purple-600">
						AI Assistant
					</div>
					<div className="text-xs md:text-sm text-blue-600">(Experimental)</div>
				</CardTitle>
				<CardDescription className="text-xs md:text-sm">
					Leverage AI to gain insights into uploaded samples
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6 px-2 md:px-4">
				<div className="flex flex-col space-y-2">
					<span className="text-sm font-medium">Sample:</span>
					<Select
						onValueChange={setSelectedSample}
						value={selectedSample || undefined}
					>
						<SelectTrigger className="w-full text-sm">
							<SelectValue placeholder="Select a sample" />
						</SelectTrigger>
						<SelectContent>
							{tsneData
								.filter((d) => d.data_source === "uploaded")
								.map((sample) => (
									<SelectItem
										key={sample.sample_id}
										value={sample.sample_id}
										className="truncate"
									>
										{sample.sample_id}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col space-y-2">
					<span className="text-sm font-medium">Model:</span>
					<Select onValueChange={setSelectedModel} value={selectedModel}>
						<SelectTrigger className="w-full text-sm">
							<SelectValue placeholder="Select a model" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
							<SelectItem value="gpt-4o">GPT-4o</SelectItem>
							<SelectItem value="gpt-o1-mini">GPT-o1-mini</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col space-y-2">
					<span className="text-sm font-medium">K Value:</span>
					<div className="flex items-center space-x-2">
						<div className="flex-1">
							<Slider
								value={[kValue]}
								onValueChange={(value) => setKValue(value[0])}
								max={50}
								min={5}
								step={1}
							/>
						</div>
						<span className="w-8 text-sm text-right">{kValue}</span>
					</div>
				</div>

				<Button
					onClick={generateReport}
					disabled={isLoading || !selectedSample}
					className="w-full text-sm"
				>
					{isLoading ? (
						<div className="items-center space-x-2 flex">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span>Analyzing...</span>
						</div>
					) : (
						<span>Generate Report</span>
					)}
				</Button>

				{report && (
					<div className="bg-white p-2 md:p-6 w-full mt-4">
						<div
							className="transition-all duration-500 ease-in-out rounded-full"
							style={{
								width: `${progress}%`,
								height: "4px",
								backgroundColor: "#4F46E5",
							}}
						/>
						<Separator className="my-2" />
						<ReactMarkdown className="prose prose-sm max-w-none overflow-x-auto text-left">
							{report.slice(0, visibleChars)}
						</ReactMarkdown>
						<div className="mt-4 flex justify-end">
							<Button onClick={copyToClipboard} variant="outline" size="sm">
								<Copy className="w-3 h-3 mr-1.5" />
								<span className="text-xs">Copy Report</span>
							</Button>
						</div>
					</div>
				)}
			</CardContent>
			<CardFooter className="text-center text-xs px-2 md:px-4 text-gray-500">
				AI models may not always be accurate. Always consult with medical
				professionals.
			</CardFooter>
		</Card>
	);
};

export default AIAMLReport;
