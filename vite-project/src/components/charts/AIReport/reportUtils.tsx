import { calculateBinomialProbability } from "@/utils/zzz";

type TSNEDataItem = {
	sample_id: string;
	data_source: string;
	// Add other properties if needed
};

// Define the processMetadata function
const processMetadata = (
	neighbors: TSNEDataItem[],
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

	const overallFrequencies: Record<string, Record<string, number>> = {};
	METADATA_ATTRIBUTES.forEach((attr) => {
		overallFrequencies[attr] = tsneData.reduce((acc, sample) => {
			const value = sample[attr as keyof TSNEDataItem];
			if (value !== null && value !== undefined && value !== "NA") {
				acc[value] = (acc[value] || 0) + 1;
			}
			return acc;
		}, {} as Record<string, number>);
	});

	const metadataReport: Record<string, unknown> = {};

	METADATA_ATTRIBUTES.forEach((attr) => {
		const values = neighbors
			.map((neighbor) => neighbor[attr as keyof TSNEDataItem])
			.filter(
				(value): value is string =>
					value !== null && value !== undefined && value !== "NA"
			);

		if (values.length === 0) {
			metadataReport[attr] = {
				mostProbable: "No data available",
				probability: 0,
				breakdown: [],
			};
		} else {
			const valueCount = values.reduce((acc, value) => {
				acc[value] = (acc[value] || 0) + 1;
				return acc;
			}, {} as Record<string, number>);

			const sortedValues = Object.entries(valueCount).sort(
				(a, b) => b[1] - a[1]
			);

			const breakdown = sortedValues.map(([value, count]) => {
				const totalInCategory = overallFrequencies[attr][value] || 0;
				const p = totalInCategory / tsneData.length;
				const binomialPValue = calculateBinomialProbability(k, count, p);

				const enrichmentRatio =
					totalInCategory === 0 || k === 0
						? 0
						: Math.log(count / k / (totalInCategory / tsneData.length));

				return {
					value,
					count,
					percentage: (count / k) * 100,
					totalInCategory,
					neighborFrequency: `${count}/${k}`,
					databaseFrequency: `${totalInCategory}/${tsneData.length}`,
					enrichmentRatio,
					probabilityScore: binomialPValue,
				};
			});

			metadataReport[attr] = {
				breakdown: breakdown.sort(
					(a, b) => a.probabilityScore - b.probabilityScore
				),
			};
		}
	});

	return {
		summary: "Metadata summary",
		details: metadataReport,
	};
};

// Define the processMetadata function
const processMutations = (
	mutationData: { sample_id: string; gene_id: string }[],
	neighborSampleIds: string[],
	tsneData: TSNEDataItem[],
	k: number
) => {
	const mutationReport: Record<string, unknown> = {};

	// Filter mutation data for neighbors
	const neighborMutations = mutationData.filter((mutation) =>
		neighborSampleIds.includes(mutation.sample_id)
	);

	// Group mutations by gene
	const geneGroups = neighborMutations.reduce((acc, mutation) => {
		if (!acc[mutation.gene_id]) {
			acc[mutation.gene_id] = [];
		}
		acc[mutation.gene_id].push(mutation);
		return acc;
	}, {} as Record<string, { sample_id: string; gene_id: string }[]>);

	// Calculate enrichment for each gene
	const enrichedGenes = Object.entries(geneGroups)
		.map(([gene, mutations]) => {
			const neighborCount = new Set(mutations.map((m) => m.sample_id)).size;
			const totalSamples = tsneData.length;
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
		.sort((a, b) => b.enrichmentRatio - a.enrichmentRatio);

	mutationReport["enriched_genes"] = {
		genes: enrichedGenes.sort(
			(a, b) => a.probabilityScore - b.probabilityScore
		),
		mutations: neighborMutations,
	};

	return {
		summary: "Mutation summary",
		details: mutationReport,
	};
};

const generateIntegratedAnalysis = async (
	metadataReport: Record<string, unknown>,
	mutationReport: Record<string, unknown>,
	// drugReport: Record<string, unknown>, // Uncomment if drugReport is used
	selectedModel: string
): Promise<string> => {
	// Example logic for integrating analysis
	let analysisSummary = `Integrated analysis using model: ${selectedModel}\n\n`;

	// Integrate metadata analysis
	analysisSummary += "### Metadata Analysis\n";
	analysisSummary += JSON.stringify(metadataReport, null, 2) + "\n\n";

	// Integrate mutation analysis
	analysisSummary += "### Mutation Analysis\n";
	analysisSummary += JSON.stringify(mutationReport, null, 2) + "\n\n";

	// Integrate drug response analysis if applicable
	// analysisSummary += "### Drug Response Analysis\n";
	// analysisSummary += JSON.stringify(drugReport, null, 2) + "\n\n";

	// Add any additional AI model-based analysis here
	analysisSummary += "### AI Model Insights\n";
	analysisSummary += `Insights based on the selected model: ${selectedModel}\n`;

	return analysisSummary;
};

export const processData = (
	selectedSample: string,
	knnData: { sample_id: string; knn_indices: number[] }[],
	// drugResponseData: { sample_id: string; inhibitor: string; auc: number }[],
	mutationData: { sample_id: string; gene_id: string }[],
	tsneData: TSNEDataItem[],
	k: number
) => {
	const sample = tsneData.find((d) => d.sample_id === selectedSample);
	console.log("Selected sample:", sample);

	const knnItem = knnData.find((item) => item.sample_id === selectedSample);
	console.log("KNN item:", knnItem);

	if (!sample || !knnItem) {
		console.log("Sample or KNN item not found.");
		return null;
	}

	const neighbors = knnItem.knn_indices
		.slice(0, k)
		.map((index) => {
			const neighborKNN = knnData[index - 1];
			return neighborKNN
				? tsneData.find((d) => d.sample_id === neighborKNN.sample_id)
				: null;
		})
		.filter((n): n is TSNEDataItem => n !== null);

	console.log("Neighbors:", neighbors);

	const neighborSampleIds = neighbors.map(
		(neighbor: { sample_id: string }) => neighbor.sample_id
	);
	console.log("Neighbor sample IDs:", neighborSampleIds);

	const metadataReport = processMetadata(neighbors, tsneData, k);
	console.log("Metadata report:", metadataReport);

	const mutationReport = processMutations(
		mutationData,
		neighborSampleIds,
		tsneData,
		k
	);
	console.log("Mutation report:", mutationReport);

	// const drugReport = processDrugResponse(
	// 	drugResponseData,
	// 	neighborSampleIds,
	// 	k
	// );
	// console.log("Drug report:", drugReport);

	return {
		sample,
		metadataReport,
		mutationReport,
		// drugReport,
	};
};

export const generateAIReport = async (
	processedData: ReturnType<typeof processData>,
	selectedModel: string
) => {
	if (!processedData) {
		return "Unable to generate report due to missing data.";
	}

	const {
		sample,
		metadataReport,
		mutationReport,
		// drugReport
	} = processedData;

	// const metadataSection = generateMetadataSection(metadataReport);
	// const mutationSection = generateMutationSection(mutationReport);
	// const drugResponseSection = generateDrugResponseSection(drugReport);
	const integratedAnalysis = await generateIntegratedAnalysis(
		metadataReport,
		mutationReport,
		// drugReport,
		selectedModel
	);

	return `
## AI-Generated AML Report for ${sample.sample_id}

### 1. Sample Information Summary

- Sample ID: ${sample.sample_id}
- Data sources: Gene expression, Mutations, Drug response

### 2. Metadata Analysis

${metadataReport}

### 3. Mutation Analysis

${mutationReport}

### 4. Integrated Analysis (AI-generated)

${integratedAnalysis}

Please note that this AI-generated report is for research purposes only and should not be used as a substitute for professional medical advice or diagnosis.
  `;
};

// Other utility functions like processMetadata, processMutations, processDrugResponse, generateMetadataSection, generateMutationSection, generateDrugResponseSection, generateIntegratedAnalysis would be defined here similarly.
