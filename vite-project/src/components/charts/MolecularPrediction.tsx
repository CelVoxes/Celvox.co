import { useEffect, useMemo, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Info, Loader2, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
	fetchMolecularPrediction,
	fetchMolecularTools,
	fetchSampleDataNames,
	getSelectedDiseaseContext,
	type MolecularToolCatalogEntry,
	type MolecularToolId,
} from "@/utils/api";
import {
	MOLECULAR_TOOL_CONFIGS,
	type MolecularDashboardToolMetadata,
} from "@/config/dashboard-tools";
import { cn } from "@/lib/utils";

type SampleOption = {
	value: string;
	label: string;
};

type ProbabilityItem = {
	label: string;
	probability: number;
};

type ScoreItem = {
	label: string;
	score: number;
};

type ToolLevelResult = {
	level: string;
	prediction?: string;
	confidence?: number;
	topPredictions: ProbabilityItem[];
};

type NormalizedPrediction = {
	raw: Record<string, unknown>;
	error?: string;
	details?: string;
	warning?: string;
	model?: string;
	sampleId?: string;
	requestedSample?: string;
	resolvedSampleColumn?: string;
	disease?: string;
	prediction?: string;
	confidence?: number;
	topPredictions: ProbabilityItem[];
	topScores: ScoreItem[];
	passCutoff?: boolean;
	levels: ToolLevelResult[];
	meta: Record<string, string | number | boolean | null>;
};

const TOOL_CONFIGS = MOLECULAR_TOOL_CONFIGS;

type ToolUiMeta = {
	id: MolecularToolId;
	label: string;
	shortLabel?: string;
	integrated?: boolean;
	applicable?: boolean;
	available?: boolean;
	runtimeReady?: boolean;
	missing?: string[];
	notes?: string;
	repoUrl?: string;
	docsUrl?: string;
	diseaseScope?: string;
	supportedDiseases?: string[];
};

const RUNNABLE_TOOL_IDS: MolecularToolId[] = [
	"bridge",
	"amlmapr",
	"allcatchr",
	"allsorts",
	"tallsorts",
];

const isMolecularToolId = (value: string): value is MolecularToolId =>
	RUNNABLE_TOOL_IDS.includes(value as MolecularToolId);

const asString = (value: unknown): string | undefined => {
	const v = Array.isArray(value) ? value[0] : value;
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	return undefined;
};

const displayValue = (value: unknown): string => {
	const v = Array.isArray(value) && value.length === 1 ? value[0] : value;
	if (v == null) return "N/A";
	if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
		return String(v);
	}
	if (Array.isArray(v)) {
		return v.map((item) => displayValue(item)).join(", ");
	}
	if (typeof v === "object") {
		const obj = v as Record<string, unknown>;
		const preferred = ["label", "prediction", "class", "name", "value", "result"];
		for (const key of preferred) {
			const text = asString(obj[key]);
			if (text) return text;
		}
		return Object.entries(obj)
			.slice(0, 4)
			.map(([key, item]) => `${key}: ${displayValue(item)}`)
			.join("; ");
	}
	return String(v);
};

const asNumber = (value: unknown): number | undefined => {
	const v = Array.isArray(value) ? value[0] : value;
	if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
	if (typeof v === "string" && v.trim() !== "") {
		const n = Number(v);
		return Number.isFinite(n) ? n : undefined;
	}
	return undefined;
};

const asBoolean = (value: unknown): boolean | undefined => {
	const v = Array.isArray(value) ? value[0] : value;
	if (typeof v === "boolean") return v;
	if (typeof v === "string") {
		if (v.toLowerCase() === "true") return true;
		if (v.toLowerCase() === "false") return false;
	}
	return undefined;
};

const asStringArray = (value: unknown): string[] => {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => asString(item))
		.filter((v): v is string => Boolean(v));
};

const asObjectRecord = (value: unknown): Record<string, unknown> | undefined => {
	const v = Array.isArray(value) ? value[0] : value;
	if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
	return v as Record<string, unknown>;
};

const normalizeProbabilityItems = (value: unknown): ProbabilityItem[] => {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			const obj = asObjectRecord(item);
			if (!obj) return null;
			const label = asString(obj.label) ?? displayValue(obj.label);
			const probability = asNumber(obj.probability);
			if (!label || probability == null) return null;
			return { label, probability } satisfies ProbabilityItem;
		})
		.filter((x): x is ProbabilityItem => x !== null);
};

const normalizeScoreItems = (value: unknown): ScoreItem[] => {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			const obj = asObjectRecord(item);
			if (!obj) return null;
			const label = asString(obj.label) ?? displayValue(obj.label);
			const score = asNumber((obj as { score?: unknown }).score);
			if (!label || score == null) return null;
			return { label, score } satisfies ScoreItem;
		})
		.filter((x): x is ScoreItem => x !== null);
};

const normalizeLevels = (value: unknown): ToolLevelResult[] => {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			const obj = asObjectRecord(item);
			if (!obj) return null;
			const level = asString(obj.level) ?? displayValue(obj.level);
			if (!level) return null;
			const normalized: ToolLevelResult = {
				level,
				prediction: asString(obj.prediction) ?? displayValue(obj.prediction),
				confidence: asNumber(obj.confidence),
				topPredictions: normalizeProbabilityItems(obj.top_predictions),
			};
			return normalized;
		})
		.filter((x): x is ToolLevelResult => x !== null);
};

const normalizePrediction = (rawValue: unknown): NormalizedPrediction => {
	const raw = (asObjectRecord(rawValue) ?? {}) as Record<string, unknown>;
	const levels = normalizeLevels(raw.levels);
	const topPredictions = normalizeProbabilityItems(raw.top_predictions);
	const topScores = normalizeScoreItems(raw.top_scores);

	const meta: Record<string, string | number | boolean | null> = {
		input_gene_count: asNumber(raw.input_gene_count) ?? null,
		model_gene_count: asNumber(raw.model_gene_count) ?? null,
		matched_gene_count: asNumber(raw.matched_gene_count) ?? null,
		matched_nonzero_features: asNumber(raw.matched_nonzero_features) ?? null,
		n_input_features: asNumber(raw.n_input_features) ?? null,
		matched_nonzero_reference_genes:
			asNumber(raw.matched_nonzero_reference_genes) ?? null,
		expected_gene_count: asNumber(raw.expected_gene_count) ?? null,
		latent_dim: asNumber(raw.latent_dim) ?? null,
		normalization: asString(raw.normalization) ?? null,
		log1p_rna: asBoolean(raw.log1p_rna) ?? null,
		primary_level: asString(raw.primary_level) ?? null,
		implementation: asString(raw.implementation) ?? null,
			confidence_label: asString(raw.confidence_label) ?? null,
			bcr_abl1_maincluster_pred: asString(raw.bcr_abl1_maincluster_pred) ?? null,
			bcr_abl1_maincluster_score:
				asNumber(raw.bcr_abl1_maincluster_score) ?? null,
			bcr_abl1_subcluster_pred: asString(raw.bcr_abl1_subcluster_pred) ?? null,
			bcr_abl1_subcluster_score:
				asNumber(raw.bcr_abl1_subcluster_score) ?? null,
			bcr_abl1_hyperdiploidy_pred:
				asString(raw.bcr_abl1_hyperdiploidy_pred) ?? null,
			bcr_abl1_hyperdiploidy_score:
				asNumber(raw.bcr_abl1_hyperdiploidy_score) ?? null,
			immuno: asString(raw.immuno) ?? null,
			immuno_score: asNumber(raw.immuno_score) ?? null,
			sex_prediction: asString(raw.sex_prediction) ?? null,
			sex_score: asNumber(raw.sex_score) ?? null,
			blast_counts: asNumber(raw.blast_counts) ?? null,
		};

	return {
		raw,
		error: asString(raw.error),
		details: asString(raw.details),
		warning: asString(raw.warning),
		model: asString(raw.model),
		sampleId: asString(raw.sample_id),
		requestedSample: asString(raw.requested_sample),
		resolvedSampleColumn: asString(raw.resolved_sample_column),
		disease: asString(raw.disease),
		prediction: asString(raw.prediction),
		confidence: asNumber(raw.confidence),
		topPredictions,
		topScores,
		passCutoff: asBoolean(raw.pass_cutoff),
		levels,
		meta,
	};
};

const formatPercent = (value?: number) =>
	typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "N/A";

const formatScore = (value: unknown) => {
	const n = asNumber(value);
	if (n == null) return displayValue(value);
	if (n >= 0 && n <= 1) return `${(n * 100).toFixed(1)}%`;
	return n.toFixed(3);
};

const labelForDisease = (disease?: string) => {
	if (!disease) return "Unknown";
	if (disease === "aml") return "AML";
	if (disease === "ball") return "B-ALL";
	if (disease === "tall") return "T-ALL";
	if (disease === "pan_leukemia") return "Pan-Leukemia";
	if (disease === "multi_disease" || disease === "multi-disease") return "Multi-disease";
	return disease;
};

const getToolById = (id: MolecularToolId): MolecularDashboardToolMetadata =>
	TOOL_CONFIGS.find((tool) => tool.id === id) ?? TOOL_CONFIGS[0];

const resultKey = (toolId: MolecularToolId, sample: string) => `${toolId}::${sample}`;

const getResultSummary = (result?: NormalizedPrediction) => {
	if (!result || result.error) return null;
	if (result.prediction) return result.prediction;
	if (result.levels.length > 0) {
		const firstCall = result.levels.find((level) => level.prediction);
		if (firstCall) return firstCall.prediction;
	}
	if (result.topPredictions.length > 0) return result.topPredictions[0].label;
	if (result.topScores.length > 0) return result.topScores[0].label;
	return "No call";
};

function ToolStatusBadge({
	isBusy,
	hasError,
	hasResult,
}: {
	isBusy: boolean;
	hasError: boolean;
	hasResult: boolean;
}) {
	if (isBusy) {
		return (
			<Badge variant="secondary" className="gap-1 text-[10px]">
				<Loader2 className="h-3 w-3 animate-spin" />
				Running
			</Badge>
		);
	}
	if (hasError) {
		return (
			<Badge variant="destructive" className="gap-1 text-[10px]">
				<XCircle className="h-3 w-3" />
				Error
			</Badge>
		);
	}
	if (hasResult) {
		return (
			<Badge variant="default" className="gap-1 text-[10px]">
				<CheckCircle2 className="h-3 w-3" />
				Done
			</Badge>
		);
	}
	return <Badge variant="outline" className="text-[10px]">Not run</Badge>;
}

function PredictionEvidence({ result }: { result: NormalizedPrediction }) {
	const probabilityRows = result.topPredictions.slice(0, 10);
	const scoreRows = result.topScores.slice(0, 10);
	const levelRows = result.levels;
	const classifierRows = [
		{ label: "Primary call", value: result.prediction },
		{
			label: "BCR-ABL1 main cluster",
			value: result.meta.bcr_abl1_maincluster_pred,
			score: result.meta.bcr_abl1_maincluster_score,
		},
		{
			label: "BCR-ABL1 subcluster",
			value: result.meta.bcr_abl1_subcluster_pred,
			score: result.meta.bcr_abl1_subcluster_score,
		},
		{
			label: "BCR-ABL1 hyperdiploidy",
			value: result.meta.bcr_abl1_hyperdiploidy_pred,
			score: result.meta.bcr_abl1_hyperdiploidy_score,
		},
		{
			label: "Immunophenotype",
			value: result.meta.immuno,
			score: result.meta.immuno_score,
		},
		{
			label: "Sex prediction",
			value: result.meta.sex_prediction,
			score: result.meta.sex_score,
		},
		{ label: "Blast counts", value: result.meta.blast_counts },
	].filter(({ value }) => value !== null && value !== undefined && value !== "");

	if (
		probabilityRows.length === 0 &&
		scoreRows.length === 0 &&
		levelRows.length === 0 &&
		classifierRows.length === 0
	) {
		return (
			<div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
				No ranked evidence returned.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{classifierRows.length > 0 && (
				<div className="space-y-2">
					<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Classifier calls
					</div>
					{classifierRows.map(({ label, value, score }) => (
						<div
							key={label}
							className="flex justify-between gap-3 rounded border px-2 py-1 text-xs"
						>
							<span className="text-muted-foreground">{label}</span>
							<span className="font-medium text-right break-words">
								{displayValue(value)}
								{score !== null && score !== undefined && (
									<span className="ml-2 text-muted-foreground">
										{formatScore(score)}
									</span>
								)}
							</span>
						</div>
					))}
				</div>
			)}
			{probabilityRows.length > 0 && (
				<div className="space-y-2">
					<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Predicted classes
					</div>
					{probabilityRows.map((item) => (
						<div key={item.label} className="space-y-1">
							<div className="flex justify-between gap-3 text-xs">
								<span className="truncate">{item.label}</span>
								<span className="text-muted-foreground tabular-nums">
									{(item.probability * 100).toFixed(1)}%
								</span>
							</div>
							<div className="h-1.5 overflow-hidden rounded bg-muted">
								<div
									className="h-full bg-primary"
									style={{
										width: `${Math.max(0, Math.min(100, item.probability * 100))}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>
			)}
			{scoreRows.length > 0 && (
				<div className="space-y-2">
					<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Class scores
					</div>
					{scoreRows.map((item) => (
						<div
							key={item.label}
							className="flex justify-between gap-3 rounded border px-2 py-1 text-xs"
						>
							<span className="truncate">{item.label}</span>
							<span className="text-muted-foreground tabular-nums">
								{item.score.toFixed(4)}
							</span>
						</div>
					))}
				</div>
			)}
			{levelRows.length > 0 && (
				<div className="space-y-2">
					<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Hierarchy calls
					</div>
					{levelRows.map((level) => (
						<div key={level.level} className="rounded border px-2 py-2 text-xs">
							<div className="flex justify-between gap-3">
								<span className="truncate text-muted-foreground">{level.level}</span>
								<span className="font-medium truncate">
									{level.prediction ?? "No call"}
								</span>
							</div>
							{typeof level.confidence === "number" && (
								<div className="mt-1 text-muted-foreground">
									Top probability: {formatPercent(level.confidence)}
								</div>
							)}
							{level.topPredictions.length > 0 && (
								<div className="mt-2 space-y-1">
									{level.topPredictions.slice(0, 5).map((item) => (
										<div
											key={`${level.level}-${item.label}`}
											className="flex justify-between gap-3"
										>
											<span className="truncate">{item.label}</span>
											<span className="text-muted-foreground tabular-nums">
												{(item.probability * 100).toFixed(1)}%
											</span>
										</div>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export function MolecularPredictionPanel() {
	const [sampleOptions, setSampleOptions] = useState<SampleOption[]>([]);
	const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
	const [isLoadingSamples, setIsLoadingSamples] = useState(false);
	const [sampleLoadError, setSampleLoadError] = useState<string | null>(null);
	const [isRunningAll, setIsRunningAll] = useState(false);
	const [batchRunningTool, setBatchRunningTool] = useState<MolecularToolId | null>(null);
	const [predictingByTool, setPredictingByTool] = useState<
		Partial<Record<string, boolean>>
	>({});
	const [resultsByTool, setResultsByTool] = useState<Partial<Record<string, NormalizedPrediction>>>({});
	const [errorByTool, setErrorByTool] = useState<Partial<Record<string, string>>>({});
	const [expandedResults, setExpandedResults] = useState<Partial<Record<string, boolean>>>({});
	const [toolCatalog, setToolCatalog] = useState<
		Partial<Record<MolecularToolId, MolecularToolCatalogEntry>>
	>({});
	const [catalogRequestDisease, setCatalogRequestDisease] = useState<string>("");

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setIsLoadingSamples(true);
			try {
				const names = await fetchSampleDataNames();
				const uploaded = Array.isArray(names) ? names.slice(1).map(String) : [];
				const priority = (name: string) =>
					name.endsWith("_unstranded")
						? 0
						: name.endsWith("_fwd")
						? 1
						: name.endsWith("_rev")
						? 2
						: 3;

				const options = uploaded
					.map((col) => ({
						value: col,
						label: col,
						base: col.replace(/_(unstranded|fwd|rev)$/i, ""),
					}))
					.sort((a, b) => {
						const byBase = a.base.localeCompare(b.base);
						if (byBase !== 0) return byBase;
						const byPriority = priority(a.value) - priority(b.value);
						if (byPriority !== 0) return byPriority;
						return a.value.localeCompare(b.value);
					})
					.map(({ value, label }) => ({ value, label }));

				if (!cancelled) {
					setSampleOptions(options);
					if (options.length > 0) {
						setSelectedSamples((prev) => (prev.length > 0 ? prev : [options[0].value]));
					}
				}
			} catch (err) {
				if (!cancelled) {
					setSampleLoadError(
						err instanceof Error ? err.message : "Failed to load uploaded samples"
					);
				}
			} finally {
				if (!cancelled) setIsLoadingSamples(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;

		const loadCatalog = async () => {
			try {
				const response = await fetchMolecularTools();
				if (cancelled) return;
				const entries = Array.isArray(response.tools) ? response.tools : [];
				const next: Partial<Record<MolecularToolId, MolecularToolCatalogEntry>> = {};
				for (const entry of entries) {
					const toolId = String(entry?.id ?? "");
					if (!toolId || !isMolecularToolId(toolId)) continue;
					next[toolId] = entry;
				}
				setToolCatalog(next);
				setCatalogRequestDisease(String(response.request_disease ?? getSelectedDiseaseContext()));
			} catch {
				if (!cancelled) {
					setCatalogRequestDisease(getSelectedDiseaseContext());
				}
			}
		};

		void loadCatalog();
		const onFocus = () => {
			void loadCatalog();
		};
		const onStorage = (event: StorageEvent) => {
			if (event.key === null || event.key === "seamless-dashboard-disease") {
				void loadCatalog();
			}
		};
		window.addEventListener("focus", onFocus);
		window.addEventListener("storage", onStorage);

		return () => {
			cancelled = true;
			window.removeEventListener("focus", onFocus);
			window.removeEventListener("storage", onStorage);
		};
	}, []);

	const currentDiseaseLabel = labelForDisease(catalogRequestDisease || getSelectedDiseaseContext());

	const toolUiMetaById = useMemo(() => {
		const out: Partial<Record<MolecularToolId, ToolUiMeta>> = {};
		for (const tool of TOOL_CONFIGS) {
			const entry = toolCatalog[tool.id];
			const entryObj = asObjectRecord(entry);
			const availabilityObj = asObjectRecord(entryObj?.availability);
			const missing =
				Array.isArray(availabilityObj?.missing)
					? availabilityObj.missing
							.map((item) => asString(item))
							.filter((x): x is string => Boolean(x))
					: undefined;
			out[tool.id] = {
				id: tool.id,
				label: asString(entryObj?.label) || tool.label,
				shortLabel: asString(entryObj?.short_label) || tool.label,
				integrated:
					asBoolean((entryObj as { integrated?: unknown } | undefined)?.integrated) ?? true,
				applicable: asBoolean(entryObj?.applicable_for_request),
				available: asBoolean(availabilityObj?.available),
				runtimeReady: asBoolean(availabilityObj?.runtime_ready),
				missing,
				notes: asString(entryObj?.notes),
				repoUrl: asString((entryObj as { repo_url?: unknown } | undefined)?.repo_url),
				docsUrl: asString((entryObj as { docs_url?: unknown } | undefined)?.docs_url),
				diseaseScope: asString((entryObj as { disease_scope?: unknown } | undefined)?.disease_scope),
				supportedDiseases: asStringArray(
					(entryObj as { supported_diseases?: unknown } | undefined)?.supported_diseases,
				),
			};
		}
		return out;
	}, [toolCatalog]);

	const orderedTools = useMemo(() => {
		const context = catalogRequestDisease || getSelectedDiseaseContext();
		const byContext: Record<string, MolecularToolId[]> = {
			aml: ["bridge", "amlmapr", "allcatchr", "allsorts", "tallsorts"],
			ball: ["bridge", "allcatchr", "allsorts", "amlmapr", "tallsorts"],
			tall: ["bridge", "tallsorts", "amlmapr", "allcatchr", "allsorts"],
			pan_leukemia: ["bridge", "amlmapr", "allcatchr", "allsorts", "tallsorts"],
		};
		const order =
			byContext[context] ?? ["bridge", "amlmapr", "allcatchr", "allsorts", "tallsorts"];
		return order.map((id) => getToolById(id));
	}, [catalogRequestDisease]);

	const consensusSummary = useMemo(() => {
		const rows: Array<{
			toolId: MolecularToolId;
			prediction: string;
			confidence: number | undefined;
		}> = Object.entries(resultsByTool).map(([key, result]) => {
			if (!result || result.error) return null;
			const toolId = key.split("::")[0] as MolecularToolId;
			const pred = result.prediction?.trim();
			if (!pred) return null;
			return {
				toolId,
				prediction: pred,
				confidence: result.confidence,
			};
		}).filter((row): row is NonNullable<typeof row> => row !== null);

		const uniquePredictions = Array.from(new Set(rows.map((row) => row.prediction)));
		return {
			totalCompleted: rows.length,
			uniquePredictions,
			status:
				rows.length <= 1
					? "insufficient"
					: uniquePredictions.length === 1
					? "agreement"
					: "divergent",
		};
	}, [resultsByTool]);

	const runPredictionForToolAndSample = async (toolId: MolecularToolId, sample: string) => {
		const key = resultKey(toolId, sample);
		setPredictingByTool((prev) => ({ ...prev, [key]: true }));
		setErrorByTool((prev) => ({ ...prev, [key]: undefined }));
		try {
			const raw = await fetchMolecularPrediction(toolId, sample);
			const normalized = normalizePrediction(raw);
			setResultsByTool((prev) => ({ ...prev, [key]: normalized }));
			if (normalized.error) {
				setErrorByTool((prev) => ({ ...prev, [key]: normalized.error }));
			}
		} catch (err) {
			setResultsByTool((prev) => ({ ...prev, [key]: undefined }));
			setErrorByTool((prev) => ({
				...prev,
				[key]: err instanceof Error ? err.message : "Prediction failed",
			}));
		} finally {
			setPredictingByTool((prev) => ({ ...prev, [key]: false }));
		}
	};

	const runPredictionForTool = async (toolId: MolecularToolId) => {
		if (selectedSamples.length === 0) return;
		for (const sample of selectedSamples) {
			await runPredictionForToolAndSample(toolId, sample);
		}
	};

	const runAllPredictions = async () => {
		if (selectedSamples.length === 0 || isRunningAll) return;
		setIsRunningAll(true);
		try {
			for (const tool of orderedTools) {
				setBatchRunningTool(tool.id);
				for (const sample of selectedSamples) {
					await runPredictionForToolAndSample(tool.id, sample);
				}
			}
		} finally {
			setBatchRunningTool(null);
			setIsRunningAll(false);
		}
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Molecular Diagnostics</CardTitle>
					<CardDescription>
						Run molecular classifiers and compare their outputs in one standard view
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-center gap-2 text-xs">
						<Badge variant="outline">Disease context: {currentDiseaseLabel}</Badge>
						<Badge variant="secondary">
							Completed: {consensusSummary.totalCompleted}/{TOOL_CONFIGS.length * selectedSamples.length}
						</Badge>
						{consensusSummary.status === "agreement" && (
							<Badge variant="default">Agreement</Badge>
						)}
						{consensusSummary.status === "divergent" && (
							<Badge variant="outline">
								Different outputs ({consensusSummary.uniquePredictions.length})
							</Badge>
						)}
					</div>

					<div className="flex flex-col gap-3 lg:flex-row lg:items-start">
						<div className="flex-1 rounded-lg border bg-muted/20 p-3">
							<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
								<div className="text-sm font-medium">Samples</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setSelectedSamples(sampleOptions.map((sample) => sample.value))}
										disabled={sampleOptions.length === 0}
									>
										All
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setSelectedSamples([])}
										disabled={selectedSamples.length === 0}
									>
										Clear
									</Button>
								</div>
							</div>
							<div className="grid max-h-40 gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
								{sampleOptions.map((sample) => (
									<label
										key={sample.value}
										className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs"
									>
										<Checkbox
											checked={selectedSamples.includes(sample.value)}
											onCheckedChange={(checked) => {
												setSelectedSamples((prev) =>
													checked
														? Array.from(new Set([...prev, sample.value]))
														: prev.filter((value) => value !== sample.value)
												);
											}}
										/>
										<span className="min-w-0 truncate">{sample.label}</span>
									</label>
								))}
							</div>
						</div>
						<Button
							onClick={runAllPredictions}
							disabled={selectedSamples.length === 0 || isRunningAll || isLoadingSamples}
						>
							{isRunningAll ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Running {batchRunningTool ? getToolById(batchRunningTool).label : "Tools"}
								</>
							) : (
								"Run All Methods"
							)}
						</Button>
					</div>

					{sampleOptions.length === 0 && !isLoadingSamples && (
						<Alert>
							<Info className="h-4 w-4" />
							<AlertDescription>
								No uploaded samples found. Upload raw RNA counts first.
							</AlertDescription>
						</Alert>
					)}

					{sampleLoadError && (
						<Alert>
							<Info className="h-4 w-4" />
							<AlertDescription>{sampleLoadError}</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

				<div className="grid gap-3 xl:grid-cols-2">
					{orderedTools.map((tool) => {
						const toolMeta = toolUiMetaById[tool.id];
						const selectedRows = selectedSamples.map((sample) => {
							const key = resultKey(tool.id, sample);
							const result = resultsByTool[key];
							const toolError = errorByTool[key];
							const isBusy = Boolean(predictingByTool[key]);
							return {
								key,
								sample,
								result,
								toolError,
								isBusy,
								hasResult: Boolean(result && !result.error),
								summary: getResultSummary(result),
							};
						});
						const hasAnyResult = selectedRows.some((row) => row.hasResult);
						const hasAnyError = selectedRows.some((row) => Boolean(row.toolError));
						const isAnyBusy = selectedRows.some((row) => row.isBusy);
						const unavailable = toolMeta?.available === false;

					return (
						<Card
							key={tool.id}
								className={cn(
									"overflow-hidden shadow-sm",
									isAnyBusy && "ring-1 ring-primary/30"
								)}
							>
							<CardHeader className="space-y-3">
								<div className="flex flex-wrap items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<CardTitle className="text-base">
													{toolMeta?.shortLabel || tool.label}
												</CardTitle>
												{toolMeta?.repoUrl && (
													<a
														href={toolMeta.repoUrl}
														target="_blank"
														rel="noreferrer"
														className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
													>
														GitHub <ExternalLink className="h-3 w-3" />
													</a>
												)}
												{toolMeta?.docsUrl && (
													<a
														href={toolMeta.docsUrl}
														target="_blank"
														rel="noreferrer"
														className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
													>
														Docs <ExternalLink className="h-3 w-3" />
													</a>
												)}
											</div>
											<CardDescription>{tool.description}</CardDescription>
										</div>
										<ToolStatusBadge
											isBusy={isAnyBusy}
											hasError={hasAnyError}
											hasResult={hasAnyResult}
										/>
								</div>
								<div className="flex flex-wrap gap-1">
									{toolMeta?.diseaseScope && (
										<Badge variant="outline" className="text-[10px]">
											{labelForDisease(toolMeta.diseaseScope)}
										</Badge>
									)}
									{unavailable && (
										<Badge variant="destructive" className="text-[10px]">
											Missing runtime
										</Badge>
									)}
								</div>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										{selectedRows.length === 0 && (
											<div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
												Select at least one sample.
											</div>
										)}
										{selectedRows.map(({ key, sample, result, toolError, isBusy, hasResult, summary }) => {
											const isExpanded = Boolean(expandedResults[key]);
											return (
												<div key={key} className="rounded-lg border bg-muted/20 p-3">
													<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
														<button
															type="button"
															onClick={() =>
																setExpandedResults((prev) => ({
																	...prev,
																	[key]: !prev[key],
																}))
															}
															className="flex min-w-0 items-start gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
														>
															{isExpanded ? (
																<ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
															) : (
																<ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
															)}
															<div className="min-w-0">
																<div className="truncate text-xs text-muted-foreground">
																	{sample}
																</div>
																{toolError ? (
																	<div className="mt-1 text-sm font-medium text-destructive">
																		{toolError}
																	</div>
																) : summary ? (
																	<div className="mt-1 text-xl font-semibold break-words">
																		{summary}
																	</div>
																) : (
																	<div className="mt-1 text-sm text-muted-foreground">
																		Not run yet
																	</div>
																)}
															</div>
															</button>
															<div className="flex flex-wrap items-start gap-1 sm:justify-end">
																{(isBusy || toolError || !hasResult) && (
																	<ToolStatusBadge
																		isBusy={isBusy}
																		hasError={Boolean(toolError)}
																		hasResult={hasResult}
																	/>
																)}
																{result && typeof result.confidence === "number" && (
																<Badge variant="outline" className="text-[10px]">
																	{formatPercent(result.confidence)}
																</Badge>
															)}
															{result && typeof result.passCutoff === "boolean" && (
																<Badge
																	variant={result.passCutoff ? "default" : "outline"}
																	className="text-[10px]"
																>
																	{result.passCutoff ? "Pass" : "Fail"}
																</Badge>
															)}
														</div>
													</div>

													{isExpanded && result && !result.error && (
														<div className="mt-3 space-y-3">
															<PredictionEvidence result={result} />
															{result.warning && (
																<Alert>
																	<Info className="h-4 w-4" />
																	<AlertDescription>{result.warning}</AlertDescription>
																</Alert>
															)}
															{result.details && (
																<div className="rounded border p-3 text-xs text-destructive whitespace-pre-wrap">
																	{result.details}
																</div>
															)}
														</div>
													)}
												</div>
											);
										})}
									</div>

									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="text-xs text-muted-foreground">
											{selectedSamples.length} selected sample{selectedSamples.length === 1 ? "" : "s"}
										</div>
										<Button
										variant="outline"
										size="sm"
											onClick={() => runPredictionForTool(tool.id)}
											disabled={
												selectedSamples.length === 0 ||
												isAnyBusy ||
												isRunningAll ||
												isLoadingSamples ||
												unavailable
										}
										>
											{isAnyBusy ? (
												<>
													<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
													Running
												</>
											) : hasAnyResult || hasAnyError ? (
												"Rerun"
											) : (
											"Run"
										)}
									</Button>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}

export default MolecularPredictionPanel;
