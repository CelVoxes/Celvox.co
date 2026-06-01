import { useState, useEffect } from "react";
import {
	fetchHarmonizedData,
	fetchHarmonizationManifest,
	fetchSampleDataNames,
	fetchHarmonizedDataNames,
} from "@/utils/api";
import type { ReferenceDiseaseId } from "@/utils/api";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "../ui/spinner";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, RefreshCcw, Sparkles } from "lucide-react";

type ReferenceDatabaseOption = {
	id: ReferenceDiseaseId;
	disease: ReferenceDiseaseId;
	lineage: string;
};

const REFERENCE_DATABASE_OPTIONS: ReferenceDatabaseOption[] = [
	{ id: "aml",  disease: "aml",  lineage: "AML"   },
	{ id: "ball", disease: "ball", lineage: "B-ALL" },
	{ id: "tall", disease: "tall", lineage: "T-ALL" },
];

const REFERENCE_DISEASE_ORDER: ReferenceDiseaseId[] = ["aml", "ball", "tall"];

const REFERENCE_PRESETS = [
	{ label: "Pan-Leukemia", description: "AML + B-ALL + T-ALL", diseases: REFERENCE_DISEASE_ORDER },
	{ label: "Myeloid",      description: "AML only",            diseases: ["aml"] as ReferenceDiseaseId[] },
	{ label: "Lymphoid",     description: "B-ALL + T-ALL",       diseases: ["ball", "tall"] as ReferenceDiseaseId[] },
];

const areDiseasesEqual = (left: ReferenceDiseaseId[], right: ReferenceDiseaseId[]) => {
	const normalize = (values: ReferenceDiseaseId[]) => [...values].sort().join("|");
	return normalize(left) === normalize(right);
};

const firstValue = <T,>(value: T | T[] | undefined | null): T | undefined =>
	Array.isArray(value) ? value[0] : (value ?? undefined);

const normalizeHarmonizedSamples = (names: string[] | null | undefined): string[] => {
	if (!Array.isArray(names)) return [];
	return names
		.map((name) => String(name))
		.filter((name) => name.length > 0 && name !== "gene_id")
		.filter((name) => name.endsWith("_sample_data"))
		.map((name) => name.replace(/_sample_data$/i, ""));
};

export function HarmonizeData({
	onDataChanged,
	embedded = false,
	diseases = ["aml"],
	onDiseasesChange,
}: {
	onDataChanged?: () => void;
	embedded?: boolean;
	diseases?: ReferenceDiseaseId[];
	onDiseasesChange?: (diseases: ReferenceDiseaseId[]) => void;
} = {}) {
	const [samples, setSamples] = useState<string[]>([]);
	const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	const { toast } = useToast();
	const [isHarmonizing, setIsHarmonizing] = useState(false);
	const [harmonizedSamples, setHarmonizedSamples] = useState<string[] | null>(null);
	const [harmonizationManifest, setHarmonizationManifest] = useState<any | null>(null);
	const [isCollapsed, setIsCollapsed] = useState(false);

	useEffect(() => {
		const loadSamples = async () => {
			try {
				const sampleData = await fetchSampleDataNames();
				if (sampleData && sampleData.length > 0) {
					setSamples(sampleData.slice(1));
					onDataChanged?.();
				}
			} catch (error) {
				console.error("Error fetching samples:", error);
				toast({ title: "Error", description: "Failed to fetch sample data.", variant: "destructive" });
			}

			try {
				const harmonizedData = await fetchHarmonizedDataNames();
				setHarmonizedSamples(harmonizedData ? normalizeHarmonizedSamples(harmonizedData) : []);
				if (harmonizedData) onDataChanged?.();
			} catch {
				setHarmonizedSamples([]);
			}

			try {
				const manifest = await fetchHarmonizationManifest();
				setHarmonizationManifest(manifest && !manifest.error ? manifest : null);
			} catch {
				setHarmonizationManifest(null);
			}
		};

		loadSamples();
	}, []);

	const cardClass = embedded ? "border-border/60 shadow-none bg-background/70" : "";

	if (harmonizedSamples === null) {
		return (
			<Card className={cardClass}>
				<CardHeader className="cursor-default select-none">
					<CardTitle className="flex items-center justify-between gap-2">
						<span className="flex items-center gap-2">
							<Sparkles className="h-4 w-4 text-primary" />
							Harmonize Data
						</span>
						<Spinner />
					</CardTitle>
				</CardHeader>
			</Card>
		);
	}

	const filteredSamples = samples.filter((s) =>
		s.toLowerCase().includes(searchTerm.toLowerCase())
	);
	const unharmonizedSamples = filteredSamples.filter((s) => !harmonizedSamples.includes(s));
	const totalSamples = samples.length;
	const harmonizedCount = samples.filter((s) => harmonizedSamples.includes(s)).length;
	const isEmptySetup = totalSamples === 0;
	const activePreset = REFERENCE_PRESETS.find((p) => areDiseasesEqual(p.diseases, diseases));

	const selectPreset = (next: ReferenceDiseaseId[]) => {
		if (!onDiseasesChange) return;
		onDiseasesChange(REFERENCE_DISEASE_ORDER.filter((d) => next.includes(d)));
	};

	const handleHarmonize = async () => {
		const alreadyHarmonized = selectedSamples.filter((s) => harmonizedSamples.includes(s));
		if (alreadyHarmonized.length > 0) {
			toast({
				title: "Warning",
				description: "Some selected samples are already harmonized. Deselect them first.",
				variant: "destructive",
			});
			return;
		}

		setIsHarmonizing(true);
		try {
			await fetchHarmonizedData(selectedSamples, diseases);
			const updatedNames = await fetchHarmonizedDataNames();
			setHarmonizedSamples(normalizeHarmonizedSamples(updatedNames));
			const manifest = await fetchHarmonizationManifest().catch(() => null);
			setHarmonizationManifest(manifest && !manifest.error ? manifest : null);
			onDataChanged?.();
			setSelectedSamples([]);
			toast({ title: "Success", description: "Harmonization completed." });
		} catch (error) {
			console.error("Error harmonizing data:", error);
			toast({ title: "Error", description: "Failed to harmonize data.", variant: "destructive" });
		} finally {
			setIsHarmonizing(false);
		}
	};

	return (
		<Card className={cardClass}>
			<CardHeader
				className="cursor-pointer select-none"
				onClick={() => setIsCollapsed((prev) => !prev)}
			>
				<CardTitle className="flex items-center justify-between gap-2">
					<span className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						Harmonize Data
					</span>
					<span className="flex items-center gap-2">
						{!isCollapsed && totalSamples > 0 && (
							<span className="hidden sm:flex items-center gap-2">
								<Badge variant="outline" className="font-medium">{totalSamples} uploaded</Badge>
								<Badge variant="secondary" className="font-medium">{harmonizedCount} harmonized</Badge>
							</span>
						)}
						{isCollapsed ? (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						)}
					</span>
				</CardTitle>
			</CardHeader>

			{!isCollapsed && (
			<CardContent className="pt-0 space-y-4">
				<CardDescription>
					Align uploaded samples to the reference dataset for downstream comparisons.
				</CardDescription>

				{/* Preset selector */}
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs text-muted-foreground">Reference context:</span>
					{REFERENCE_PRESETS.map((preset) => (
						<Button
							key={preset.label}
							type="button"
							variant={areDiseasesEqual(preset.diseases, diseases) ? "default" : "outline"}
							size="sm"
							className="h-7 text-xs"
							onClick={() => selectPreset(preset.diseases)}
							disabled={!onDiseasesChange}
							title={preset.description}
						>
							{preset.label}
						</Button>
					))}
					<span className="text-xs text-muted-foreground ml-1">
						{activePreset ? `· ${activePreset.description}` : `· ${REFERENCE_DATABASE_OPTIONS.filter(o => diseases.includes(o.disease)).map(o => o.lineage).join(", ")}`}
					</span>
				</div>

				{isEmptySetup ? (
					<div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
						Upload sample data first, then return here to harmonize.
					</div>
				) : (
					<div className="space-y-3">
						{/* Search + select controls */}
						<div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
							<Input
								placeholder="Search samples..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="sm:max-w-[280px] bg-background"
							/>
							<div className="flex gap-2 text-xs text-muted-foreground items-center">
								<button
									onClick={() => setSelectedSamples(unharmonizedSamples)}
									disabled={unharmonizedSamples.length === 0}
									className={cn("hover:text-foreground transition-colors", unharmonizedSamples.length === 0 && "opacity-40 cursor-not-allowed")}
								>
									Select all ({unharmonizedSamples.length})
								</button>
								<span>·</span>
								<button onClick={() => setSelectedSamples([])} className="hover:text-foreground transition-colors">
									Clear
								</button>
							</div>
						</div>

						{/* Sample grid */}
						<ScrollArea className="h-[280px] w-full rounded-md border bg-background/60 p-3">
							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
								{filteredSamples.map((sample) => {
									const isHarmonized = harmonizedSamples.includes(sample);
									return (
										<div
											key={sample}
											className={cn(
												"flex items-center gap-2 rounded-md border px-2 py-2",
												isHarmonized
													? "border-border/40 bg-muted/10"
													: "border-border/60 hover:bg-muted/20 cursor-pointer"
											)}
											onClick={() => {
												if (isHarmonized) return;
												setSelectedSamples((prev) =>
													prev.includes(sample)
														? prev.filter((s) => s !== sample)
														: [...prev, sample]
												);
											}}
										>
											<Checkbox
												id={sample}
												checked={selectedSamples.includes(sample)}
												disabled={isHarmonized}
												onCheckedChange={(checked) => {
													if (isHarmonized) return;
													setSelectedSamples((prev) =>
														checked ? [...prev, sample] : prev.filter((s) => s !== sample)
													);
												}}
											/>
											<label
												htmlFor={sample}
												title={sample}
												className={cn(
													"text-xs leading-tight break-all",
													isHarmonized ? "text-muted-foreground line-through" : "cursor-pointer hover:text-primary"
												)}
											>
												{sample}
											</label>
										</div>
									);
								})}
								{filteredSamples.length === 0 && searchTerm && (
									<div className="col-span-full text-center text-muted-foreground py-6 text-sm">
										No samples match "{searchTerm}"
									</div>
								)}
								{filteredSamples.length > 0 && unharmonizedSamples.length === 0 && (
									<div className="col-span-full text-center text-muted-foreground py-4 text-sm">
										All samples are already harmonized.
									</div>
								)}
							</div>
						</ScrollArea>

						{/* Action row */}
						<div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
							<div className="text-xs text-muted-foreground">
								{selectedSamples.length > 0
									? `${selectedSamples.length} selected`
									: `${harmonizedCount} / ${totalSamples} harmonized`}
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => { setSearchTerm(""); setSelectedSamples([]); }}
								>
									<RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
									Reset
								</Button>
								<Button
									size="sm"
									onClick={handleHarmonize}
									disabled={
										selectedSamples.length === 0 ||
										isHarmonizing ||
										selectedSamples.some((s) => harmonizedSamples.includes(s))
									}
								>
									{isHarmonizing ? "Harmonizing…" : `Harmonize (${selectedSamples.length})`}
								</Button>
							</div>
						</div>

						{/* QC strip */}
						{harmonizationManifest && (
							<div className="rounded-md border border-border/60 bg-muted/10 p-3 space-y-2">
								<div className="flex flex-wrap items-center justify-between gap-1">
									<span className="text-xs font-medium">QC · last run</span>
									<span className="text-xs text-muted-foreground">
										{String(firstValue(harmonizationManifest.timestamp_utc) ?? "")}
									</span>
								</div>
								<div className="flex flex-wrap gap-2 text-xs">
									<Badge variant="outline">
										ref: {String(firstValue(harmonizationManifest.disease_selection_key) ?? "—")}
									</Badge>
									<Badge variant="outline">
										genes: {String(firstValue(harmonizationManifest.overlap?.common_gene_count) ?? "—")}
									</Badge>
									<Badge variant="outline">
										overlap:{" "}
										{typeof firstValue(harmonizationManifest.overlap?.uploaded_overlap_fraction) === "number"
											? `${((firstValue(harmonizationManifest.overlap.uploaded_overlap_fraction) as number) * 100).toFixed(1)}%`
											: "—"}
									</Badge>
									<Badge variant="outline">
										batches: {String(firstValue(harmonizationManifest.batches?.unique) ?? "—")}
									</Badge>
								</div>
								{(() => {
									const warningsRaw = harmonizationManifest.warnings;
									const warnings = Array.isArray(warningsRaw)
										? warningsRaw.map((w) => String(firstValue(w as any) ?? w))
										: [];
									return warnings.length > 0 ? (
										<div className="rounded border border-amber-300/60 bg-amber-50/60 px-2 py-1.5 text-xs text-amber-900">
											{warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
										</div>
									) : null;
								})()}
							</div>
						)}
					</div>
				)}
			</CardContent>
			)}
		</Card>
	);
}
