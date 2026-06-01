import { useEffect, useMemo, useState } from "react";
import {
	fetchHarmonizedDataNames,
	fetchSampleGSEA,
	fetchSampleDysregulation,
	type DysregulationGene,
	type DysregulationResult,
	type GseaPathway,
	type SampleGseaResult,
} from "@/utils/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

type SampleOption = {
	value: string;
	label: string;
	base: string;
};

const firstValue = <T,>(value: T | T[] | undefined | null): T | undefined => {
	return Array.isArray(value) ? value[0] : (value ?? undefined);
};

const asText = (value: unknown): string | null => {
	const v = firstValue(value as string | string[] | undefined | null);
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	return null;
};

const asFiniteNumber = (value: unknown): number | null => {
	const v = firstValue(value as number | number[] | undefined | null);
	const num = typeof v === "number" ? v : Number(v);
	return Number.isFinite(num) ? num : null;
};

const at = (value: unknown, index: number): unknown => {
	return Array.isArray(value) ? value[index] : undefined;
};

function normalizeGeneList(raw: unknown): DysregulationGene[] {
	if (Array.isArray(raw)) {
		return raw
			.map((entry) => ({
				gene_id: asText((entry as Record<string, unknown>)?.gene_id) ?? "",
				target_expr:
					asFiniteNumber((entry as Record<string, unknown>)?.target_expr) ?? 0,
				cohort_mean:
					asFiniteNumber((entry as Record<string, unknown>)?.cohort_mean) ?? 0,
				delta: asFiniteNumber((entry as Record<string, unknown>)?.delta) ?? 0,
				robust_z: asFiniteNumber((entry as Record<string, unknown>)?.robust_z) ?? 0,
				percentile_rank:
					asFiniteNumber((entry as Record<string, unknown>)?.percentile_rank) ?? 0,
			}))
			.filter((entry) => entry.gene_id.length > 0);
	}

	if (raw && typeof raw === "object") {
		const obj = raw as Record<string, unknown>;
		const geneIds = Array.isArray(obj.gene_id) ? obj.gene_id.map((g) => String(g)) : [];
		return geneIds
			.map((gene_id, index) => ({
				gene_id,
				target_expr: asFiniteNumber(at(obj.target_expr, index)) ?? 0,
				cohort_mean: asFiniteNumber(at(obj.cohort_mean, index)) ?? 0,
				delta: asFiniteNumber(at(obj.delta, index)) ?? 0,
				robust_z: asFiniteNumber(at(obj.robust_z, index)) ?? 0,
				percentile_rank: asFiniteNumber(at(obj.percentile_rank, index)) ?? 0,
			}))
			.filter((entry) => entry.gene_id.length > 0);
	}

	return [];
}

function normalizeDysregulationResult(raw: DysregulationResult): DysregulationResult {
	const obj = (raw ?? {}) as Record<string, unknown>;
	const summaryRaw =
		obj.summary && typeof obj.summary === "object"
			? (obj.summary as Record<string, unknown>)
			: {};

	return {
		sample_requested: asText(obj.sample_requested) ?? undefined,
		sample_resolved: asText(obj.sample_resolved) ?? undefined,
		warning: asText(obj.warning),
		cohort_size: asFiniteNumber(obj.cohort_size) ?? undefined,
		genes_tested: asFiniteNumber(obj.genes_tested) ?? undefined,
		summary: {
			up_count: asFiniteNumber(summaryRaw.up_count) ?? 0,
			down_count: asFiniteNumber(summaryRaw.down_count) ?? 0,
			extreme_abs_z_count: asFiniteNumber(summaryRaw.extreme_abs_z_count) ?? 0,
		},
		top_up: normalizeGeneList(obj.top_up),
		top_down: normalizeGeneList(obj.top_down),
		error: asText(obj.error) ?? undefined,
	};
}

function normalizeGseaPathways(raw: unknown): GseaPathway[] {
	if (!Array.isArray(raw)) return [];
	const out: GseaPathway[] = [];
	for (const entry of raw) {
		const obj = (entry ?? {}) as Record<string, unknown>;
		const pathway = asText(obj.pathway) ?? "";
		if (!pathway) continue;
		out.push({
			pathway,
			NES: asFiniteNumber(obj.NES) ?? 0,
			pval: asFiniteNumber(obj.pval) ?? 1,
			padj: asFiniteNumber(obj.padj) ?? 1,
			size: asFiniteNumber(obj.size) ?? 0,
			leading_edge: asText(obj.leading_edge) ?? "",
		});
	}
	return out;
}

function normalizeGseaResult(raw: SampleGseaResult): SampleGseaResult {
	const obj = (raw ?? {}) as Record<string, unknown>;
	const missingRaw = Array.isArray(obj.missing) ? obj.missing : [];
	return {
		sample_requested: asText(obj.sample_requested) ?? undefined,
		sample_resolved: asText(obj.sample_resolved) ?? undefined,
		warning: asText(obj.warning),
		collection: asText(obj.collection) ?? undefined,
		cohort_size: asFiniteNumber(obj.cohort_size) ?? undefined,
		genes_ranked: asFiniteNumber(obj.genes_ranked) ?? undefined,
		pathways_tested: asFiniteNumber(obj.pathways_tested) ?? undefined,
		pathways: normalizeGseaPathways(obj.pathways),
		error: asText(obj.error) ?? undefined,
		missing: missingRaw.map((x) => String(x)),
		install_hint: asText(obj.install_hint) ?? undefined,
	};
}

function normalizeUploadedHarmonizedSampleOptions(names: unknown): SampleOption[] {
	if (!Array.isArray(names)) return [];

	const uploaded = names
		.map((name) => String(name))
		.filter((name) => name.endsWith("_sample_data"))
		.map((name) => name.replace(/_sample_data$/i, ""));

	const unique = Array.from(new Set(uploaded));
	const priority = (name: string) =>
		name.endsWith("_unstranded")
			? 0
			: name.endsWith("_fwd")
				? 1
				: name.endsWith("_rev")
					? 2
					: 3;

	return unique
		.map((value) => ({
			value,
			label: value,
			base: value.replace(/_(unstranded|fwd|rev)$/i, ""),
		}))
		.sort((a, b) => {
			const byBase = a.base.localeCompare(b.base);
			if (byBase !== 0) return byBase;
			const byPriority = priority(a.value) - priority(b.value);
			if (byPriority !== 0) return byPriority;
			return a.value.localeCompare(b.value);
		});
}

function formatNumber(value: unknown, digits = 3): string {
	const num = typeof value === "number" ? value : Number(value);
	return Number.isFinite(num) ? num.toFixed(digits) : "n/a";
}

function GeneTable({ title, genes }: { title: string; genes: DysregulationGene[] }) {
	return (
		<Card className="border-border/60 shadow-none">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[360px] rounded-md border border-border/60">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Gene</TableHead>
								<TableHead className="text-right">Delta</TableHead>
								<TableHead className="text-right">Robust Z</TableHead>
								<TableHead className="text-right">Percentile</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{genes.map((gene) => (
								<TableRow key={`${title}-${gene.gene_id}`}>
									<TableCell className="font-mono text-xs">{gene.gene_id}</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatNumber(gene.delta)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatNumber(gene.robust_z)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatNumber(
											typeof gene.percentile_rank === "number"
												? gene.percentile_rank * 100
												: gene.percentile_rank,
											1,
										)}
										%
									</TableCell>
								</TableRow>
							))}
							{genes.length === 0 && (
								<TableRow>
									<TableCell colSpan={4} className="text-sm text-muted-foreground">
										No genes passed thresholds.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}

export function SampleDysregulationPanel() {
	const [sampleOptions, setSampleOptions] = useState<SampleOption[]>([]);
	const [selectedSample, setSelectedSample] = useState("");
	const [topN, setTopN] = useState(50);
	const [isLoadingSamples, setIsLoadingSamples] = useState(false);
	const [isRunning, setIsRunning] = useState(false);
	const [result, setResult] = useState<DysregulationResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [gseaCollection, setGseaCollection] = useState<"hallmark" | "reactome" | "go_bp">(
		"hallmark",
	);
	const [gseaTopN, setGseaTopN] = useState(30);
	const [isRunningGsea, setIsRunningGsea] = useState(false);
	const [gseaResult, setGseaResult] = useState<SampleGseaResult | null>(null);
	const [gseaError, setGseaError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		const loadSamples = async () => {
			setIsLoadingSamples(true);
			try {
				const names = await fetchHarmonizedDataNames();
				if (cancelled) return;
				const options = normalizeUploadedHarmonizedSampleOptions(names);
				setSampleOptions(options);
				if (options.length > 0) {
					setSelectedSample((prev) =>
						prev && options.some((option) => option.value === prev)
							? prev
							: options[0].value,
					);
				} else {
					setSelectedSample("");
				}
			} catch (err) {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : "Failed to load harmonized samples");
			} finally {
				if (!cancelled) setIsLoadingSamples(false);
			}
		};

		void loadSamples();
		return () => {
			cancelled = true;
		};
	}, []);

	const runAnalysis = async () => {
		if (!selectedSample) return;
		setIsRunning(true);
		setError(null);
		try {
			const next = normalizeDysregulationResult(
				await fetchSampleDysregulation(selectedSample, topN),
			);
			if (next.error) {
				setError(next.error);
				setResult(null);
			} else {
				setResult(next);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to run dysregulation analysis");
			setResult(null);
		} finally {
			setIsRunning(false);
		}
	};

	const runGsea = async () => {
		if (!selectedSample) return;
		setIsRunningGsea(true);
		setGseaError(null);
		try {
			const next = normalizeGseaResult(
				await fetchSampleGSEA(selectedSample, gseaCollection, gseaTopN),
			);
			if (next.error) {
				const details =
					next.install_hint && next.missing && next.missing.length > 0
						? `${next.error} Missing: ${next.missing.join(", ")}. ${next.install_hint}`
						: next.error;
				setGseaError(details);
				setGseaResult(null);
			} else {
				setGseaResult(next);
			}
		} catch (err) {
			setGseaError(err instanceof Error ? err.message : "Failed to run GSEA");
			setGseaResult(null);
		} finally {
			setIsRunningGsea(false);
		}
	};

	const summaryBadges = useMemo(() => {
		if (!result) return [];
		return [
			`Cohort size: ${result.cohort_size ?? "n/a"}`,
			`Genes tested: ${result.genes_tested ?? "n/a"}`,
			`Up: ${result.summary?.up_count ?? 0}`,
			`Down: ${result.summary?.down_count ?? 0}`,
		];
	}, [result]);

	return (
		<div className="space-y-4">
			<Card className="border-border/60 shadow-sm">
				<CardHeader>
					<CardTitle>Sample Dysregulation</CardTitle>
					<CardDescription>
						Identify per-sample up/down outlier genes against the rest of the harmonized
						cohort using robust z-score and effect-size thresholds.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3">
						<Select
							value={selectedSample}
							onValueChange={setSelectedSample}
							disabled={isLoadingSamples || sampleOptions.length === 0}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select harmonized uploaded sample" />
							</SelectTrigger>
							<SelectContent>
								{sampleOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Input
							type="number"
							min={10}
							max={200}
							step={10}
							value={topN}
							onChange={(e) => {
								const next = Number(e.target.value);
								setTopN(Number.isFinite(next) ? Math.max(10, Math.min(200, next)) : 50);
							}}
						/>
						<Button
							onClick={runAnalysis}
							disabled={!selectedSample || isLoadingSamples || isRunning}
						>
							{isRunning ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Running
								</>
							) : (
								"Run"
							)}
						</Button>
					</div>

					{sampleOptions.length === 0 && !isLoadingSamples && (
						<div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
							No harmonized uploaded samples found. Harmonize at least one uploaded sample first.
						</div>
					)}

					{error && (
						<div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{error}
						</div>
					)}

					{result && (
						<div className="flex flex-wrap items-center gap-2">
							{summaryBadges.map((badge) => (
								<Badge key={badge} variant="outline" className="font-medium">
									{badge}
								</Badge>
							))}
							{result.sample_resolved && (
								<Badge variant="secondary" className="font-medium">
									Resolved sample: {result.sample_resolved}
								</Badge>
							)}
						</div>
					)}

					{result?.warning && (
						<div className="rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
							{result.warning}
						</div>
					)}
				</CardContent>
			</Card>

			{result && (
				<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
					<GeneTable title="Top Upregulated" genes={result.top_up ?? []} />
					<GeneTable title="Top Downregulated" genes={result.top_down ?? []} />
				</div>
			)}

			<Card className="border-border/60 shadow-sm">
				<CardHeader>
					<CardTitle>Preranked GSEA</CardTitle>
					<CardDescription>
						Run pathway enrichment from sample-vs-cohort robust z-score ranking.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid grid-cols-1 md:grid-cols-[220px_120px_120px_auto] gap-3">
						<Select
							value={gseaCollection}
							onValueChange={(value) =>
								setGseaCollection(value as "hallmark" | "reactome" | "go_bp")
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="hallmark">Hallmark</SelectItem>
								<SelectItem value="reactome">Reactome</SelectItem>
								<SelectItem value="go_bp">GO BP</SelectItem>
							</SelectContent>
						</Select>
						<Input
							type="number"
							min={10}
							max={100}
							step={5}
							value={gseaTopN}
							onChange={(e) => {
								const next = Number(e.target.value);
								setGseaTopN(
									Number.isFinite(next) ? Math.max(10, Math.min(100, next)) : 30,
								);
							}}
						/>
						<div className="text-xs text-muted-foreground self-center">Top pathways</div>
						<Button onClick={runGsea} disabled={!selectedSample || isRunningGsea}>
							{isRunningGsea ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Running GSEA
								</>
							) : (
								"Run GSEA"
							)}
						</Button>
					</div>

					{gseaError && (
						<div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{gseaError}
						</div>
					)}

					{gseaResult && (
						<div className="space-y-3">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline" className="font-medium">
									Collection: {gseaResult.collection ?? "n/a"}
								</Badge>
								<Badge variant="outline" className="font-medium">
									Pathways tested: {gseaResult.pathways_tested ?? "n/a"}
								</Badge>
								<Badge variant="outline" className="font-medium">
									Genes ranked: {gseaResult.genes_ranked ?? "n/a"}
								</Badge>
							</div>
							<ScrollArea className="h-[360px] rounded-md border border-border/60">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Pathway</TableHead>
											<TableHead className="text-right">NES</TableHead>
											<TableHead className="text-right">padj</TableHead>
											<TableHead className="text-right">Size</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{(gseaResult.pathways ?? []).map((pathway) => (
											<TableRow key={pathway.pathway}>
												<TableCell className="text-xs">{pathway.pathway}</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatNumber(pathway.NES)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatNumber(pathway.padj, 4)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatNumber(pathway.size, 0)}
												</TableCell>
											</TableRow>
										))}
										{(gseaResult.pathways ?? []).length === 0 && (
											<TableRow>
												<TableCell
													colSpan={4}
													className="text-sm text-muted-foreground"
												>
													No enriched pathways returned.
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</ScrollArea>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default SampleDysregulationPanel;
