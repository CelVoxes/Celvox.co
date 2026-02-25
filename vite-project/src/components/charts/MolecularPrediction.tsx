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
import { ExternalLink, Info, Loader2 } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	fetchMolecularPrediction,
	fetchMolecularTools,
	fetchSampleDataNames,
	getSelectedDiseaseContext,
	type MolecularToolCatalogEntry,
	type MolecularToolId,
} from "@/utils/api";

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

type ToolConfig = {
	id: MolecularToolId;
	label: string;
	description: string;
	runLabel: string;
};

const TOOL_CONFIGS: ToolConfig[] = [
	{
		id: "bridge",
		label: "Bridge",
		description: "Pan-leukemia Bridge classifier (official package)",
		runLabel: "Run Bridge",
	},
	{
		id: "amlmapr",
		label: "AMLmapR",
		description: "AML transcriptional subtype predictor",
		runLabel: "Run AMLmapR",
	},
	{
		id: "allcatchr",
		label: "ALLCatchR",
		description: "B-ALL classifier with BCR-ABL1 subcluster outputs (ALLCatchR_bcrabl1)",
		runLabel: "Run ALLCatchR",
	},
	{
		id: "allsorts",
		label: "ALLSorts (B-ALL)",
		description: "B-ALL subtype classifier (ALLSorts)",
		runLabel: "Run ALLSorts",
	},
	{
		id: "tallsorts",
		label: "TALLSorts (T-ALL)",
		description: "T-ALL subtype classifier (TALLSorts)",
		runLabel: "Run TALLSorts",
	},
];

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
	return typeof v === "string" ? v : v == null ? undefined : String(v);
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
			const label = asString(obj.label);
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
			const label = asString(obj.label);
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
			const level = asString(obj.level);
			if (!level) return null;
			const normalized: ToolLevelResult = {
				level,
				prediction: asString(obj.prediction),
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
		bcr_abl1_subcluster_pred: asString(raw.bcr_abl1_subcluster_pred) ?? null,
		bcr_abl1_hyperdiploidy_pred:
			asString(raw.bcr_abl1_hyperdiploidy_pred) ?? null,
		immuno: asString(raw.immuno) ?? null,
		sex_prediction: asString(raw.sex_prediction) ?? null,
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

const labelForDisease = (disease?: string) => {
	if (!disease) return "Unknown";
	if (disease === "aml") return "AML";
	if (disease === "ball") return "B-ALL";
	if (disease === "tall") return "T-ALL";
	if (disease === "pan_leukemia") return "Pan-Leukemia";
	if (disease === "multi_disease" || disease === "multi-disease") return "Multi-disease";
	return disease;
};

const getToolById = (id: MolecularToolId) =>
	TOOL_CONFIGS.find((tool) => tool.id === id) ?? TOOL_CONFIGS[0];

function ProbabilitiesList({
	items,
	title,
}: {
	items: ProbabilityItem[];
	title: string;
}) {
	if (items.length === 0) return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{items.slice(0, 10).map((item) => {
						const width = Math.max(
							0,
							Math.min(100, item.probability * 100)
						);
						return (
							<div key={item.label} className="space-y-1">
								<div className="flex justify-between text-sm gap-4">
									<span className="font-medium truncate">{item.label}</span>
									<span className="text-muted-foreground">
										{(item.probability * 100).toFixed(2)}%
									</span>
								</div>
								<div className="h-2 rounded bg-muted overflow-hidden">
									<div className="h-full bg-primary" style={{ width: `${width}%` }} />
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

function ScoresList({ items }: { items: ScoreItem[] }) {
	if (items.length === 0) return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle>Top AMLmapR Cluster Scores</CardTitle>
				<CardDescription>
					Decision boundary distances (higher is more favored)
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{items.slice(0, 10).map((item) => (
						<div
							key={item.label}
							className="flex items-center justify-between gap-4 rounded border px-3 py-2 text-sm"
						>
							<span className="font-medium truncate">{item.label}</span>
							<span className="text-muted-foreground tabular-nums">
								{item.score.toFixed(4)}
							</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function TALLLevelsCard({ levels }: { levels: ToolLevelResult[] }) {
	if (levels.length === 0) return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle>TALLSorts Hierarchy Levels</CardTitle>
				<CardDescription>
					Per-level calls from the T-ALL hierarchical classifier
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3 md:grid-cols-2">
					{levels.map((level) => (
						<div key={level.level} className="rounded border p-3 space-y-2">
							<div className="flex items-center justify-between gap-2">
								<div className="text-sm font-medium">{level.level}</div>
								<Badge variant="outline">
									{level.prediction ?? "No call"}
								</Badge>
							</div>
							{typeof level.confidence === "number" && (
								<div className="text-xs text-muted-foreground">
									Top probability: {formatPercent(level.confidence)}
								</div>
							)}
							<div className="space-y-1">
								{level.topPredictions.slice(0, 5).map((item) => (
									<div
										key={`${level.level}-${item.label}`}
										className="flex justify-between gap-3 text-xs"
									>
										<span className="truncate">{item.label}</span>
										<span className="text-muted-foreground tabular-nums">
											{(item.probability * 100).toFixed(1)}%
										</span>
									</div>
								))}
								{level.topPredictions.length === 0 && (
									<div className="text-xs text-muted-foreground">No probabilities for this level.</div>
								)}
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function MetaGrid({ meta }: { meta: NormalizedPrediction["meta"] }) {
	const rows = Object.entries(meta).filter(([, value]) => value !== null && value !== undefined);
	if (rows.length === 0) return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle>Run Metadata</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollArea className="max-h-56">
					<div className="space-y-1">
						{rows.map(([key, value]) => (
							<div
								key={key}
								className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded border px-3 py-2 text-sm"
							>
								<span className="text-muted-foreground break-all">{key}</span>
								<span className="font-medium tabular-nums">
									{typeof value === "boolean" ? (value ? "true" : "false") : String(value)}
								</span>
							</div>
						))}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}

export function MolecularPredictionPanel() {
	const [activeTool, setActiveTool] = useState<MolecularToolId>("bridge");
	const [sampleOptions, setSampleOptions] = useState<SampleOption[]>([]);
	const [selectedSample, setSelectedSample] = useState<string>("");
	const [isLoadingSamples, setIsLoadingSamples] = useState(false);
	const [isRunningAll, setIsRunningAll] = useState(false);
	const [predictingByTool, setPredictingByTool] = useState<
		Partial<Record<MolecularToolId, boolean>>
	>({});
	const [resultsByTool, setResultsByTool] = useState<Partial<Record<MolecularToolId, NormalizedPrediction>>>({});
	const [errorByTool, setErrorByTool] = useState<Partial<Record<MolecularToolId, string>>>({});
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
					.map(({ base: _base, ...rest }) => rest);

				if (!cancelled) {
					setSampleOptions(options);
					if (options.length > 0) {
						setSelectedSample((prev) => prev || options[0].value);
					}
				}
			} catch (err) {
				if (!cancelled) {
					setErrorByTool((prev) => ({
						...prev,
						[activeTool]: err instanceof Error ? err.message : "Failed to load uploaded samples",
					}));
				}
			} finally {
				if (!cancelled) setIsLoadingSamples(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [activeTool]);

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

	const activeToolConfig = useMemo(() => getToolById(activeTool), [activeTool]);
	const activeResult = resultsByTool[activeTool] ?? null;
	const activeError = errorByTool[activeTool] ?? null;
	const isActivePredicting = Boolean(predictingByTool[activeTool]) || isRunningAll;
	const hasAnyToolResults = TOOL_CONFIGS.some((tool) => Boolean(resultsByTool[tool.id]));
	const hasAnyToolErrors = TOOL_CONFIGS.some((tool) => Boolean(errorByTool[tool.id]));
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

	const activeToolMeta = toolUiMetaById[activeTool];

	const pickerTools = useMemo(() => {
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
		}> = TOOL_CONFIGS.map((tool) => {
			const result = resultsByTool[tool.id];
			if (!result || result.error) return null;
			const pred = result.prediction?.trim();
			if (!pred) return null;
			return {
				toolId: tool.id,
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
	}, [resultsByTool, toolUiMetaById]);

	const runPredictionForTool = async (toolId: MolecularToolId) => {
		if (!selectedSample) return;
		setPredictingByTool((prev) => ({ ...prev, [toolId]: true }));
		setErrorByTool((prev) => ({ ...prev, [toolId]: undefined }));
		try {
			const raw = await fetchMolecularPrediction(toolId, selectedSample);
			const normalized = normalizePrediction(raw);
			setResultsByTool((prev) => ({ ...prev, [toolId]: normalized }));
			if (normalized.error) {
				setErrorByTool((prev) => ({ ...prev, [toolId]: normalized.error }));
			}
		} catch (err) {
			setResultsByTool((prev) => ({ ...prev, [toolId]: undefined }));
			setErrorByTool((prev) => ({
				...prev,
				[toolId]: err instanceof Error ? err.message : "Prediction failed",
			}));
		} finally {
			setPredictingByTool((prev) => ({ ...prev, [toolId]: false }));
		}
	};

	const runPrediction = async () => {
		if (!selectedSample || isActivePredicting) return;
		await runPredictionForTool(activeTool);
	};

	const runAllPredictions = async () => {
		if (!selectedSample || isRunningAll) return;
		setIsRunningAll(true);
		try {
			for (const tool of TOOL_CONFIGS) {
				await runPredictionForTool(tool.id);
			}
		} finally {
			setIsRunningAll(false);
		}
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Molecular Diagnostics</CardTitle>
					<CardDescription>
						Run integrated molecular classifiers on uploaded raw RNA counts
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<Badge variant="outline">Disease context: {currentDiseaseLabel}</Badge>
						<Badge variant="outline">Registry-backed tools</Badge>
					</div>

					<div className="rounded-lg border p-3 space-y-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div>
								<div className="text-sm font-medium">Tool Selection</div>
								<div className="text-xs text-muted-foreground">
									Choose a classifier to run. Catalog entries are listed below for reference.
								</div>
							</div>
							<Badge variant="outline">{TOOL_CONFIGS.length} runnable tools</Badge>
						</div>

						<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
							{pickerTools.map((tool) => {
								const toolMeta = toolUiMetaById[tool.id];
								const isSelected = activeTool === tool.id;
								return (
									<button
										key={tool.id}
										type="button"
										onClick={() => setActiveTool(tool.id)}
										className={`rounded-md border p-3 text-left transition-colors ${
											isSelected
												? "border-primary bg-primary/5"
												: "hover:bg-muted/40"
										}`}
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<div className="text-sm font-medium truncate">
													{toolMeta?.shortLabel || tool.label}
												</div>
												<div className="text-[11px] text-muted-foreground truncate">
													{toolMeta?.diseaseScope
														? labelForDisease(toolMeta.diseaseScope)
														: tool.description}
												</div>
											</div>
											{toolMeta?.available === false && (
												<Badge variant="destructive" className="text-[10px]">
													Missing
												</Badge>
											)}
										</div>
									</button>
								);
							})}
						</div>

						<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<Badge variant="secondary">Selected: {activeToolConfig.label}</Badge>
							{activeToolMeta?.diseaseScope && (
								<Badge variant="outline">
									{labelForDisease(activeToolMeta.diseaseScope)}
								</Badge>
							)}
							{activeToolMeta?.repoUrl && (
								<a
									href={activeToolMeta.repoUrl}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1 text-primary hover:underline"
								>
									GitHub <ExternalLink className="h-3 w-3" />
								</a>
							)}
							{activeToolMeta?.docsUrl && (
								<a
									href={activeToolMeta.docsUrl}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1 text-primary hover:underline"
								>
									Docs <ExternalLink className="h-3 w-3" />
								</a>
							)}
							{activeToolMeta?.notes && (
								<span className="line-clamp-1">{activeToolMeta.notes}</span>
							)}
						</div>
					</div>

					<div className="flex flex-col lg:flex-row gap-3">
						<div className="flex-1">
							<Select
								value={selectedSample}
								onValueChange={setSelectedSample}
								disabled={isLoadingSamples || sampleOptions.length === 0}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select uploaded sample" />
								</SelectTrigger>
								<SelectContent>
									{sampleOptions.map((sample) => (
										<SelectItem key={sample.value} value={sample.value}>
											{sample.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<Button
							onClick={runPrediction}
							disabled={!selectedSample || isActivePredicting || isLoadingSamples}
						>
							{isActivePredicting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Running {activeToolConfig.label}
								</>
							) : (
								activeToolConfig.runLabel
							)}
						</Button>
						<Button
							variant="outline"
							onClick={runAllPredictions}
							disabled={!selectedSample || isRunningAll || isLoadingSamples}
						>
							{isRunningAll ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Running All Runnable Tools
								</>
							) : (
								"Run All Runnable Tools"
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

					{activeError && (
						<Alert>
							<Info className="h-4 w-4" />
							<AlertDescription>{activeError}</AlertDescription>
						</Alert>
					)}

					{activeResult?.warning && (
						<Alert>
							<Info className="h-4 w-4" />
							<AlertDescription>{activeResult.warning}</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			{(hasAnyToolResults || hasAnyToolErrors) && (
				<Card>
					<CardHeader>
						<CardTitle>Predictions Overview</CardTitle>
						<CardDescription>
							Compare calls across molecular tools for the selected sample
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
							<Badge variant="outline">Context: {currentDiseaseLabel}</Badge>
							<Badge variant="secondary">
								Completed: {consensusSummary.totalCompleted}/{TOOL_CONFIGS.length}
							</Badge>
							{consensusSummary.status === "agreement" && (
								<Badge variant="default">Agreement</Badge>
							)}
							{consensusSummary.status === "divergent" && (
								<Badge variant="outline">
									Divergent calls ({consensusSummary.uniquePredictions.length})
								</Badge>
							)}
							{consensusSummary.status === "insufficient" && (
								<Badge variant="outline">Run more tools for comparison</Badge>
							)}
						</div>
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
							{TOOL_CONFIGS.map((tool) => {
								const result = resultsByTool[tool.id];
								const toolError = errorByTool[tool.id];
								const isBusy = Boolean(predictingByTool[tool.id]) || isRunningAll;
								const isActive = activeTool === tool.id;
								const toolMeta = toolUiMetaById[tool.id];

								return (
									<button
										key={tool.id}
										type="button"
										onClick={() => setActiveTool(tool.id)}
										className={`rounded-lg border p-3 text-left transition-colors ${
											isActive
												? "border-primary bg-primary/5"
												: "hover:bg-muted/40"
										}`}
									>
										<div className="flex items-center justify-between gap-2">
											<div className="text-sm font-medium">{tool.label}</div>
											{isBusy && (
												<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
											)}
										</div>
										<div className="mt-2 space-y-1">
											<div className="flex flex-wrap gap-1">
												{toolMeta?.diseaseScope && (
													<Badge variant="outline" className="text-[10px]">
														{labelForDisease(toolMeta.diseaseScope)}
													</Badge>
												)}
												{toolMeta?.available === false && (
													<Badge variant="destructive" className="text-[10px]">
														Unavailable
													</Badge>
												)}
											</div>
											{toolError ? (
												<div className="text-xs text-destructive line-clamp-3">
													{toolError}
												</div>
											) : result && !result.error ? (
												<>
													<div className="text-base font-semibold truncate">
														{result.prediction ?? "No call"}
													</div>
													<div className="flex flex-wrap gap-1">
														{typeof result.confidence === "number" && (
															<Badge variant="secondary" className="text-[10px]">
																{formatPercent(result.confidence)}
															</Badge>
														)}
														{typeof result.passCutoff === "boolean" && (
															<Badge
																variant={result.passCutoff ? "default" : "outline"}
																className="text-[10px]"
															>
																AMLmapR {result.passCutoff ? "pass" : "fail"}
															</Badge>
														)}
													</div>
													{result.warning && (
														<div className="text-[11px] text-muted-foreground line-clamp-2">
															{result.warning}
														</div>
													)}
												</>
											) : (
												<div className="text-xs text-muted-foreground">Not run yet</div>
											)}
										</div>
									</button>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{activeResult && !activeResult.error && (
				<>
					<Card>
						<CardHeader>
							<CardTitle>{activeToolConfig.label} Result</CardTitle>
							<CardDescription>
								{activeResult.model ?? activeToolConfig.label} | Sample: {activeResult.sampleId ?? selectedSample}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="rounded-lg border p-4 bg-muted/30">
								<div className="text-xs uppercase tracking-wide text-muted-foreground">
									Primary Prediction
								</div>
								<div className="text-2xl font-semibold">
									{activeResult.prediction ?? "No call"}
								</div>
								<div className="mt-2 flex flex-wrap gap-2 text-xs">
									{typeof activeResult.confidence === "number" && (
										<Badge variant="secondary">Confidence: {formatPercent(activeResult.confidence)}</Badge>
									)}
									{typeof activeResult.passCutoff === "boolean" && (
										<Badge variant={activeResult.passCutoff ? "default" : "outline"}>
											AMLmapR cutoff: {activeResult.passCutoff ? "pass" : "fail"}
										</Badge>
									)}
									{activeResult.disease && (
										<Badge variant="outline">
											Context: {labelForDisease(activeResult.disease)}
										</Badge>
									)}
								</div>
							</div>

							<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
								{activeResult.requestedSample && (
									<div className="rounded border p-3">
										<div className="text-muted-foreground">Requested sample</div>
										<div className="font-medium break-all">{activeResult.requestedSample}</div>
									</div>
								)}
								{activeResult.resolvedSampleColumn && (
									<div className="rounded border p-3">
										<div className="text-muted-foreground">Count column used</div>
										<div className="font-medium break-all">{activeResult.resolvedSampleColumn}</div>
									</div>
								)}
								{activeResult.model && (
									<div className="rounded border p-3">
										<div className="text-muted-foreground">Model</div>
										<div className="font-medium break-all">{activeResult.model}</div>
									</div>
								)}
								{activeResult.meta.implementation && (
									<div className="rounded border p-3">
										<div className="text-muted-foreground">Implementation</div>
										<div className="font-medium break-all">{String(activeResult.meta.implementation)}</div>
									</div>
								)}
							</div>

							{asString(activeResult.raw.gene_id_note) && (
								<div className="text-xs text-muted-foreground rounded border p-3">
									{asString(activeResult.raw.gene_id_note)}
								</div>
							)}
							{activeResult.details && (
								<div className="text-xs text-destructive rounded border p-3 whitespace-pre-wrap">
									{activeResult.details}
								</div>
							)}
						</CardContent>
					</Card>

					<ProbabilitiesList items={activeResult.topPredictions} title="Top Predictions" />
					<ScoresList items={activeResult.topScores} />
					<TALLLevelsCard levels={activeResult.levels} />
					<MetaGrid meta={activeResult.meta} />
				</>
			)}
		</div>
	);
}

export default MolecularPredictionPanel;
