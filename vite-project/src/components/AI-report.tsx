import React, { useState, useEffect } from "react";
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
} from "@/utils/api";
import {
	adjustPValues,
	calculateHypergeometricPValue,
	renderMarkdown,
} from "@/utils/zzz";

export const AIAMLReport = () => {
	const [report, setReport] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [visibleChars, setVisibleChars] = useState(0);
	const [progress, setProgress] = useState(0);
	const { toast } = useToast();
	const [selectedSample, setSelectedSample] = useState<string | null>(null);
	const [tsneData, setTsneData] = useState<any[]>([]);
	const [kValue, setKValue] = useState(20);

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

			const aiReport = await generateAIReport(processedData);

			setReport(aiReport);
		} catch (error) {
			console.error("Error generating report:", error);
			setReport("Failed to generate report. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const processData = (
		selectedSample: string,
		knnData: any[],
		drugResponseData: any[],
		mutationData: any[],
		tsneData: any[],
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
			(neighbor: any) => neighbor.sample_id
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

	const processMetadata = (neighbors: any[], tsneData: any[], k: number) => {
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

		const report: Record<string, any> = {};

		// Calculate overall frequencies
		const overallFrequencies: Record<
			string,
			Record<string | number, number>
		> = {};
		METADATA_ATTRIBUTES.forEach((attr) => {
			overallFrequencies[attr] = tsneData.reduce((acc, sample) => {
				const value = sample[attr];
				if (value !== null && value !== undefined && value !== "NA") {
					acc[value] = (acc[value] || 0) + 1;
				}
				return acc;
			}, {} as Record<string | number, number>);
		});

		METADATA_ATTRIBUTES.forEach((attr) => {
			const values = neighbors
				.map((neighbor) => neighbor[attr])
				.filter(
					(value): value is string | number =>
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
		mutationData: any[],
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
		drugResponseData: any,
		neighborSampleIds: string[],
		k: number
	) => {
		// Check if drugResponseData is an object with the expected structure
		if (
			!drugResponseData ||
			typeof drugResponseData !== "object" ||
			!drugResponseData.sample_id
		) {
			console.error(
				"Drug response data is not in the expected format:",
				drugResponseData
			);
			return [];
		}

		// Transform the data into an array of objects
		const transformedData = Array.from(
			{ length: drugResponseData.sample_id.length },
			(_, i) => ({
				sample_id: drugResponseData.sample_id[i],
				inhibitor: drugResponseData.inhibitor[i],
				auc: drugResponseData.auc[i],
			})
		);

		// Filter for neighbor samples
		const neighborDrugResponses = transformedData.filter((response) =>
			neighborSampleIds.includes(response.sample_id)
		);

		// Process drug response data
		const drugSensitivity = neighborDrugResponses.reduce((acc, response) => {
			if (!acc[response.inhibitor]) {
				acc[response.inhibitor] = { count: 0, totalAUC: 0 };
			}
			acc[response.inhibitor].count += 1;
			acc[response.inhibitor].totalAUC += response.auc;
			return acc;
		}, {} as Record<string, { count: number; totalAUC: number }>);

		// Calculate average AUC and sort by it
		const drugReport = Object.entries(drugSensitivity)
			.map(([drug, { count, totalAUC }]) => ({
				drug,
				averageAUC: totalAUC / count,
				count,
			}))
			.sort((a, b) => b.averageAUC - a.averageAUC);

		return drugReport;
	};

	const generateAIReport = async (processedData: any) => {
		if (!processedData) {
			return "Unable to generate report due to missing data.";
		}

		const { sample, metadataReport, mutationReport, drugReport } =
			processedData;

		return `
## AI-Generated AML Report for Sample ${sample.sample_id}

### 1. Sample Information Summary
- Sample ID: ${sample.sample_id}
- Data sources: Gene expression, Mutations, Drug response

### 2. Metadata Analysis
${generateMetadataSection(metadataReport)}

### 3. Mutation Analysis
${generateMutationSection(mutationReport)}

### 4. Drug Response Analysis (ex-vivo)
${generateDrugResponseSection(drugReport)}

### 5. Integrated Analysis
${generateIntegratedAnalysis(metadataReport, mutationReport, drugReport)}

### 6. Potential Treatment Implications
${generateTreatmentImplications(mutationReport, drugReport)}

### 7. Future Research Directions
${generateFutureResearchDirections(metadataReport, mutationReport, drugReport)}

Please note that this AI-generated report is for research purposes only and should not be used as a substitute for professional medical advice or diagnosis.
		`;
	};

	const generateMetadataSection = (metadataReport: any) => {
		return Object.entries(metadataReport)
			.map(([attr, data]: [string, any]) => {
				const breakdown = data.breakdown || [];
				const smallestPValueItem = breakdown.reduce(
					(min: any, item: any) =>
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

	const generateMutationSection = (mutationReport: any) => {
		return mutationReport
			.slice(0, 5)
			.map((gene: any) => {
				return `- ${gene.gene}: Found in ${
					gene.neighborFrequency
				} neighbors (p-value: ${gene.pValue.toExponential(2)})`;
			})
			.join("\n");
	};

	const generateDrugResponseSection = (drugReport: any) => {
		return drugReport
			.slice(0, 5)
			.map((drug: any) => {
				return `- ${drug.drug}: Average AUC ${drug.averageAUC.toFixed(3)}`;
			})
			.join("\n");
	};

	const generateIntegratedAnalysis = (
		metadataReport: any,
		mutationReport: any,
		drugReport: any
	) => {
		// Generate integrated analysis combining metadata, mutations, and drug response
		return "Integrated analysis of metadata, mutations, and drug response suggests...";
	};

	const generateTreatmentImplications = (
		mutationReport: any,
		drugReport: any
	) => {
		// Generate potential treatment implications based on mutations and drug response
		return "Based on the mutation profile and drug response data, potential treatment options may include...";
	};

	const generateFutureResearchDirections = (
		metadataReport: any,
		mutationReport: any,
		drugReport: any
	) => {
		// Generate suggestions for future research based on the findings
		return "Future research could focus on investigating the relationship between...";
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
