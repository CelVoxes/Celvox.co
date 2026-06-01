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
	fetchQCMetrics,
	fetchDeconvolutionData,
	fetchCNVData,
	fetchKNNDEG,
	fetchMolecularPrediction,
	fetchMolecularTools,
	getSelectedDiseaseContext,
	type MolecularToolId,
} from "@/utils/api";
import {
	adjustPValues,
	calculateHypergeometricPValue,
	calculateTTest,
} from "@/utils/zzz";
import { Slider } from "@/components/ui/slider";
import ReactMarkdown from "react-markdown";

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
	crossTabEvidence: Record<string, unknown>;
}

// Update this interface
interface TSNEDataItem {
	sample_id: string;
	data_source: string;
	[key: string]: unknown;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value as UnknownRecord;
};

const asString = (value: unknown): string | null => {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return null;
};

const asNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

const asBoolean = (value: unknown): boolean | null => {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (normalized === "true") return true;
		if (normalized === "false") return false;
	}
	return null;
};

const normalizeSampleId = (sampleId: string) =>
	sampleId
		.toLowerCase()
		.replace(/_sample_data$/i, "")
		.replace(/_(unstranded|fwd|rev)$/i, "")
		.trim();

const sampleMatches = (a: string | null, b: string | null) => {
	if (!a || !b) return false;
	if (a === b) return true;
	return normalizeSampleId(a) === normalizeSampleId(b);
};

const MOLECULAR_TOOL_IDS: MolecularToolId[] = [
	"bridge",
	"amlmapr",
	"allcatchr",
	"allsorts",
	"tallsorts",
];
const HAMLET_AI_SUMMARY_KEY = "hamlet-ai-summary-v1";

const isMolecularToolId = (value: string): value is MolecularToolId =>
	MOLECULAR_TOOL_IDS.includes(value as MolecularToolId);

export const AIAMLReport = () => {
	const [report, setReport] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [visibleChars, setVisibleChars] = useState(0);
	const [progress, setProgress] = useState(0);
	const { toast } = useToast();
	const [selectedSample, setSelectedSample] = useState<string | null>(null);
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [kValue, setKValue] = useState(20);
	const [selectedModel, setSelectedModel] = useState<string>("gpt-5.4-mini");

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

	const safeFetch = async <T,>(
		label: string,
		fn: () => Promise<T>
	): Promise<T | null> => {
		try {
			return await fn();
		} catch (error) {
			console.warn(`AI report: failed to fetch ${label}`, error);
			return null;
		}
	};

	const summarizeQCMetrics = (qcRaw: unknown, sampleId: string) => {
		const qc = asRecord(qcRaw);
		const sampleStatsRaw =
			qc && Array.isArray(qc.sample_stats) ? (qc.sample_stats as unknown[]) : [];

		const sampleStats = sampleStatsRaw
			.map((row) => {
				const obj = asRecord(row);
				if (!obj) return null;
				return {
					sample_id: asString(obj.sample_id),
					lib_size: asNumber(obj.lib_size),
					detected_genes: asNumber(obj.detected_genes),
					median_expression: asNumber(obj.median_expression),
					mean_expression: asNumber(obj.mean_expression),
				};
			})
			.filter(
				(
					row
				): row is {
					sample_id: string | null;
					lib_size: number | null;
					detected_genes: number | null;
					median_expression: number | null;
					mean_expression: number | null;
				} => row !== null
			);

		const matched = sampleStats.find((row) => sampleMatches(row.sample_id, sampleId));
		if (!matched) {
			return {
				status: "unavailable",
				reason: "No matching sample in QC metrics",
			};
		}

		return {
			status: "ok",
			sample_id: matched.sample_id,
			lib_size: matched.lib_size,
			detected_genes: matched.detected_genes,
			median_expression: matched.median_expression,
			mean_expression: matched.mean_expression,
		};
	};

	const summarizeDeconvolution = (deconvRaw: unknown, sampleId: string) => {
		const response = asRecord(deconvRaw);
		const payload = response ? response.deconvolution : null;

		let rows: UnknownRecord[] = [];
		if (Array.isArray(payload)) {
			rows = payload
				.map((item) => asRecord(item))
				.filter((item): item is UnknownRecord => item !== null);
		} else {
			const payloadRecord = asRecord(payload);
			if (payloadRecord) {
				rows = Object.values(payloadRecord)
					.map((item) => asRecord(item))
					.filter((item): item is UnknownRecord => item !== null);
			}
		}

		const matchedRow = rows.find((row) => {
			const rowName = asString(row._row) ?? asString(row.sample_id);
			return sampleMatches(rowName, sampleId);
		});

		if (!matchedRow) {
			return {
				status: "unavailable",
				reason: "No matching sample in deconvolution output",
			};
		}

		const rankedCellTypes = Object.entries(matchedRow)
			.map(([cellType, rawValue]) => ({
				cellType,
				fraction: asNumber(rawValue),
			}))
			.filter(
				(item) =>
					item.cellType !== "_row" &&
					item.cellType !== "sample_id" &&
					item.fraction !== null
			)
			.map((item) => ({
				cell_type: item.cellType,
				fraction: item.fraction as number,
				percent: Number(((item.fraction as number) * 100).toFixed(2)),
			}))
			.sort((a, b) => b.fraction - a.fraction);

		return {
			status: "ok",
			sample_id: asString(matchedRow._row) ?? asString(matchedRow.sample_id) ?? sampleId,
			dominant_cell_type: rankedCellTypes[0]?.cell_type ?? null,
			top_cell_types: rankedCellTypes.slice(0, 8),
		};
	};

	const summarizeCNV = (cnvRaw: unknown) => {
		const cnv = asRecord(cnvRaw);
		const genesRaw =
			cnv && Array.isArray(cnv.genome_expression)
				? (cnv.genome_expression as unknown[])
				: [];

		const genes = genesRaw
			.map((row) => {
				const obj = asRecord(row);
				if (!obj) return null;
				return {
					gene_id: asString(obj.gene_id),
					chromosome: asString(obj.chromosome),
					cnv_score: asNumber(obj.cnv_score),
					cnv_z_score: asNumber(obj.cnv_z_score),
					is_significant_cnv: asBoolean(obj.is_significant_cnv),
					is_amplification: asBoolean(obj.is_amplification),
					is_deletion: asBoolean(obj.is_deletion),
				};
			})
			.filter(
				(
					item
				): item is {
					gene_id: string | null;
					chromosome: string | null;
					cnv_score: number | null;
					cnv_z_score: number | null;
					is_significant_cnv: boolean | null;
					is_amplification: boolean | null;
					is_deletion: boolean | null;
				} => item !== null
			);

		if (genes.length === 0) {
			return {
				status: "unavailable",
				reason: "No CNV data available for selected sample",
			};
		}

		const significant = genes.filter(
			(gene) =>
				gene.is_significant_cnv === true ||
				(gene.cnv_z_score !== null && Math.abs(gene.cnv_z_score) >= 2)
		);
		const amplifications = genes
			.filter(
				(gene) =>
					gene.is_amplification === true ||
					(gene.cnv_z_score !== null && gene.cnv_z_score >= 2)
			)
			.sort((a, b) => (b.cnv_z_score ?? -Infinity) - (a.cnv_z_score ?? -Infinity))
			.slice(0, 10)
			.map((gene) => ({
				gene_id: gene.gene_id,
				chromosome: gene.chromosome,
				cnv_score: gene.cnv_score,
				cnv_z_score: gene.cnv_z_score,
			}));
		const deletions = genes
			.filter(
				(gene) =>
					gene.is_deletion === true ||
					(gene.cnv_z_score !== null && gene.cnv_z_score <= -2)
			)
			.sort((a, b) => (a.cnv_z_score ?? Infinity) - (b.cnv_z_score ?? Infinity))
			.slice(0, 10)
			.map((gene) => ({
				gene_id: gene.gene_id,
				chromosome: gene.chromosome,
				cnv_score: gene.cnv_score,
				cnv_z_score: gene.cnv_z_score,
			}));

		return {
			status: "ok",
			total_genes: genes.length,
			significant_event_count: significant.length,
			top_amplifications: amplifications,
			top_deletions: deletions,
		};
	};

	const summarizeKnnDeg = (degRaw: unknown) => {
		if (!Array.isArray(degRaw)) {
			return {
				status: "unavailable",
				reason: "No KNN differential expression results",
			};
		}

		const rows = degRaw
			.map((row) => {
				const obj = asRecord(row);
				if (!obj) return null;
				return {
					gene: asString(obj._row),
					logFC: asNumber(obj.logFC),
					adjPVal: asNumber(obj["adj.P.Val"]),
					logFDR: asNumber(obj.logFDR),
				};
			})
			.filter(
				(
					item
				): item is {
					gene: string | null;
					logFC: number | null;
					adjPVal: number | null;
					logFDR: number | null;
				} => item !== null
			)
			.filter((item) => item.gene !== null);

		if (rows.length === 0) {
			return {
				status: "unavailable",
				reason: "No parsable KNN differential expression rows",
			};
		}

		const significant = rows.filter(
			(item) =>
				item.adjPVal !== null && item.logFC !== null && item.adjPVal < 0.05
		);
		const up = significant
			.filter((item) => (item.logFC ?? 0) > 0)
			.sort((a, b) => (b.logFC ?? -Infinity) - (a.logFC ?? -Infinity))
			.slice(0, 12)
			.map((item) => ({
				gene: item.gene,
				logFC: item.logFC,
				adjPVal: item.adjPVal,
				logFDR: item.logFDR,
			}));
		const down = significant
			.filter((item) => (item.logFC ?? 0) < 0)
			.sort((a, b) => (a.logFC ?? Infinity) - (b.logFC ?? Infinity))
			.slice(0, 12)
			.map((item) => ({
				gene: item.gene,
				logFC: item.logFC,
				adjPVal: item.adjPVal,
				logFDR: item.logFDR,
			}));

		return {
			status: "ok",
			total_gene_tests: rows.length,
			significant_gene_count: significant.length,
			top_upregulated_genes: up,
			top_downregulated_genes: down,
		};
	};

	const fetchMolecularEvidence = async (sampleId: string) => {
		const diseaseContext = getSelectedDiseaseContext();
		const preferredByDisease: Record<string, MolecularToolId[]> = {
			aml: ["bridge", "amlmapr", "allcatchr"],
			ball: ["bridge", "allcatchr", "allsorts"],
			tall: ["bridge", "tallsorts", "amlmapr"],
			pan_leukemia: ["bridge", "amlmapr", "allcatchr", "allsorts"],
		};
		const preferredTools =
			preferredByDisease[diseaseContext] ?? ["bridge", "amlmapr", "allcatchr"];

		const catalog = await safeFetch("molecular-tools", () => fetchMolecularTools());
		const catalogTools =
			catalog && Array.isArray(catalog.tools) ? (catalog.tools as unknown[]) : [];

		const runnableFromCatalog = catalogTools
			.map((tool) => asRecord(tool))
			.filter((tool): tool is UnknownRecord => tool !== null)
			.filter((tool) => {
				const id = asString(tool.id);
				if (!id || !isMolecularToolId(id)) return false;
				const applicable = asBoolean(tool.applicable_for_request);
				const availability = asRecord(tool.availability);
				const available = availability ? asBoolean(availability.available) : null;
				const runtimeReady = availability
					? asBoolean(availability.runtime_ready)
					: null;
				if (applicable === false) return false;
				if (available === false) return false;
				if (runtimeReady === false) return false;
				return true;
			})
			.map((tool) => asString(tool.id))
			.filter((id): id is MolecularToolId => Boolean(id && isMolecularToolId(id)));

		const toolsToRun = (runnableFromCatalog.length > 0
			? preferredTools.filter((tool) => runnableFromCatalog.includes(tool))
			: preferredTools
		).slice(0, 3);

		const predictions = await Promise.all(
			toolsToRun.map(async (toolId) => {
				try {
					const rawResponse = await fetchMolecularPrediction(toolId, sampleId);
					const raw = asRecord(rawResponse) ?? {};
					const topPredictions = Array.isArray(raw.top_predictions)
						? (raw.top_predictions as unknown[])
								.map((item) => {
									const obj = asRecord(item);
									if (!obj) return null;
									const label = asString(obj.label);
									const probability = asNumber(obj.probability);
									if (!label || probability === null) return null;
									return { label, probability };
								})
								.filter(
									(
										item
									): item is {
										label: string;
										probability: number;
									} => item !== null
								)
								.slice(0, 5)
						: [];

					return {
						tool: toolId,
						prediction: asString(raw.prediction),
						confidence: asNumber(raw.confidence),
						model: asString(raw.model),
						warning: asString(raw.warning),
						error: asString(raw.error),
						top_predictions: topPredictions,
					};
				} catch (error) {
					return {
						tool: toolId,
						error:
							error instanceof Error
								? error.message
								: "Failed to compute molecular prediction",
					};
				}
			})
		);

		return {
			status: "ok",
			disease_context: diseaseContext,
			sample_id: sampleId,
			tools_attempted: toolsToRun,
			predictions,
		};
	};

	const readHamletEvidence = (sampleId: string) => {
		if (typeof window === "undefined") {
			return {
				status: "unavailable",
				reason: "No browser session available",
			};
		}

		try {
			const raw = window.sessionStorage.getItem(HAMLET_AI_SUMMARY_KEY);
			if (!raw) {
				return {
					status: "unavailable",
					reason: "HAMLET tab data not loaded in current session",
				};
			}

			const parsed: unknown = JSON.parse(raw);
			const summary = asRecord(parsed);
			if (!summary) {
				return {
					status: "unavailable",
					reason: "HAMLET summary format is invalid",
				};
			}

			const hamletSampleName = asString(summary.sample_name);
			if (hamletSampleName && !sampleMatches(hamletSampleName, sampleId)) {
				return {
					status: "unavailable",
					reason: "HAMLET data belongs to a different sample",
					hamlet_sample_name: hamletSampleName,
					selected_sample: sampleId,
				};
			}

			return summary;
		} catch (error) {
			console.warn("AI report: failed to read HAMLET summary", error);
			return {
				status: "unavailable",
				reason: "Failed to parse HAMLET summary",
			};
		}
	};

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
			const [
				knnData,
				drugResponseData,
				mutationData,
				qcMetricsRaw,
				deconvolutionRaw,
				cnvRaw,
				knnDegRaw,
				molecularEvidence,
			] = await Promise.all([
				fetchKNNData(kValue),
				fetchDrugResponseData(),
				fetchMutationTSNEData(),
				safeFetch("qc-metrics", fetchQCMetrics),
				safeFetch("deconvolution", fetchDeconvolutionData),
				safeFetch("cnv", () => fetchCNVData([selectedSample], false)),
				safeFetch("knn-deg", () => fetchKNNDEG(kValue, selectedSample)),
				safeFetch("molecular-predictions", () =>
					fetchMolecularEvidence(selectedSample)
				),
			]);

			const crossTabEvidence: Record<string, unknown> = {
				qc_metrics: summarizeQCMetrics(qcMetricsRaw, selectedSample),
				deconvolution: summarizeDeconvolution(deconvolutionRaw, selectedSample),
				cnv: summarizeCNV(cnvRaw),
				knn_differential_expression: summarizeKnnDeg(knnDegRaw),
				molecular_predictions: molecularEvidence ?? {
					status: "unavailable",
					reason: "Molecular prediction data unavailable",
				},
				hamlet: readHamletEvidence(selectedSample),
			};

			const processedData = processData(
				selectedSample,
				knnData,
				drugResponseData,
				mutationData,
				tsneData,
				kValue,
				crossTabEvidence
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
		k: number,
		crossTabEvidence: Record<string, unknown>
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
			crossTabEvidence,
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

		const { sample, metadataReport, mutationReport, drugReport, crossTabEvidence } =
			processedData;

		const metadataSection = generateMetadataSection(metadataReport);
		const mutationSection = generateMutationSection(mutationReport);
		const drugResponseSection = generateDrugResponseSection(drugReport);
		const integratedAnalysis = await generateIntegratedAnalysis(
			sample.sample_id,
			metadataReport,
			mutationReport,
			drugReport,
			crossTabEvidence
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
		sampleId: string,
		metadataReport: Record<string, MetadataReportItem>,
		mutationReport: {
			gene: string;
			count: number;
			pValue: number;
			neighborFrequency: string;
		}[],
		drugReport: DrugReport,
		crossTabEvidence: Record<string, unknown>
	) => {
		const crossTabCoverage = Object.entries(crossTabEvidence)
			.filter(([, value]) => {
				const record = asRecord(value);
				return record ? record.status === "ok" : false;
			})
			.map(([key]) => key);

		const structuredPatientEvidence = {
			sample_id: sampleId,
			metadata_summary: Object.fromEntries(
				Object.entries(metadataReport).map(([key, value]) => [
					key,
					{
						mostProbable: value.mostProbable,
						probability: Number(value.probability.toFixed(4)),
						breakdown: value.breakdown.slice(0, 5),
					},
				])
			),
			enriched_mutations: mutationReport.slice(0, 15),
			drug_response: {
				significant_comparisons: (drugReport.comparisons ?? [])
					.filter(
						(
							item
						): item is {
							drug: string;
							neighborAvg: number;
							allSamplesAvg: number;
							pValue: number;
							significant: boolean;
						} => item !== null
					)
					.sort((a, b) => a.pValue - b.pValue)
					.slice(0, 15),
			},
			cross_tab_evidence: crossTabEvidence,
			cross_tab_coverage: crossTabCoverage,
		};

		const patientInfo = [
			`Sample ID: ${sampleId}`,
			"Patient evidence (JSON):",
			"```json",
			JSON.stringify(structuredPatientEvidence, null, 2),
			"```",
			"Task: produce an integrated AML research summary with references.",
			"Rules: use the provided sample evidence for patient-specific claims; use web sources for current external context and cite them.",
			"Prioritize clinically relevant findings from all available tabs, especially QC, deconvolution, CNV, KNN differential expression, and molecular predictions.",
		].join("\n");

		const aiReport = await fetchAIReport(patientInfo, selectedModel);

		if (aiReport?.error) {
			return `Unable to generate integrated analysis: ${aiReport.error}`;
		}

		const rawSummary = aiReport?.summary;
		const summaryText = Array.isArray(rawSummary)
			? rawSummary.filter(Boolean).join("\n\n")
			: typeof rawSummary === "string"
			? rawSummary
			: "";

		if (!summaryText) {
			return "Unable to generate integrated analysis. Please try again.";
		}

		const rawSources: unknown[] = Array.isArray(aiReport?.sources)
			? (aiReport.sources as unknown[])
			: [];
		const sources = rawSources
			.filter(
				(
					source: unknown
				): source is {
					title?: string;
					url: string;
				} => {
					if (!source || typeof source !== "object") return false;
					const maybeUrl = (source as { url?: unknown }).url;
					return typeof maybeUrl === "string" && maybeUrl.trim() !== "";
				}
			)
			.map((source) => {
				const label = source.title?.trim() || source.url;
				return `- [${label}](${source.url})`;
			});

		if (sources.length === 0) {
			return summaryText;
		}

		return `${summaryText}\n\n### Web Sources\n${sources.join("\n")}`;
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
							<SelectItem value="gpt-5.4-mini">GPT-5.4 mini</SelectItem>
							<SelectItem value="gpt-5.4">GPT-5.4</SelectItem>
							<SelectItem value="gpt-4.1-mini">GPT-4.1 mini</SelectItem>
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
