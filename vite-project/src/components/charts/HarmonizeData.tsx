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
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleCard, CollapsibleCardContent, CollapsibleCardTrigger } from "../ui/collapsible-card";
import { Spinner } from "../ui/spinner";
import { RefreshCcw, Sparkles } from "lucide-react";

const firstValue = <T,>(value: T | T[] | undefined | null): T | undefined => {
	return Array.isArray(value) ? value[0] : (value ?? undefined);
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

	useEffect(() => {
		const loadSamples = async () => {
			try {
				const sampleData = await fetchSampleDataNames();
				if (sampleData && sampleData.length > 0) {
					console.log("Sample data:", sampleData);
					setSamples(sampleData.slice(1));
					onDataChanged?.();
				}
			} catch (error) {
				console.error("Error fetching samples:", error);
				toast({
					title: "Error",
					description: "Failed to fetch sample data. Please try again.",
					variant: "destructive",
				});
			}

			try {
				const harmonizedData = await fetchHarmonizedDataNames();
				if (harmonizedData) {
					console.log("Harmonized data:", harmonizedData);
					setHarmonizedSamples(harmonizedData);
					onDataChanged?.();
				} else {
					setHarmonizedSamples([]);
				}
			} catch (error) {
				console.error("Error fetching harmonized data:", error);
				setHarmonizedSamples([]);
			}

			try {
				const manifest = await fetchHarmonizationManifest();
				if (manifest && !manifest.error) {
					setHarmonizationManifest(manifest);
				} else {
					setHarmonizationManifest(null);
				}
			} catch {
				setHarmonizationManifest(null);
			}
		};

		loadSamples();
	}, []);
	const cardClass = embedded
		? "border-border/60 shadow-none bg-background/70"
		: "";

	if (harmonizedSamples === null) {
		return (
			<CollapsibleCard disabled={true} className={cardClass}>
				<CollapsibleCardTrigger>
					<div className="flex items-center justify-between gap-3 px-6">
						<div className="flex items-center gap-2">
							<Sparkles className="h-4 w-4 text-primary" />
							<CardTitle>Harmonize Data</CardTitle>
						</div>
						<Spinner />
					</div>
				</CollapsibleCardTrigger>
			</CollapsibleCard>
		);
	}

	const filteredSamples = samples.filter((sample) =>
		sample.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const unharmonizedSamples = filteredSamples.filter(
		(sample) => !harmonizedSamples.includes(sample)
	);
	const totalSamples = samples.length;
	const harmonizedCount = samples.filter((sample) =>
		harmonizedSamples.includes(sample)
	).length;
	const isEmptySetup = totalSamples === 0;

	const handleSelectAll = () => {
		setSelectedSamples(unharmonizedSamples);
	};

	const handleSelectNone = () => {
		setSelectedSamples([]);
	};

	const referenceOptions: { value: ReferenceDiseaseId; label: string }[] = [
		{ value: "aml", label: "AML" },
		{ value: "ball", label: "B-ALL" },
		{ value: "tall", label: "T-ALL" },
	];

	const toggleReferenceDisease = (disease: ReferenceDiseaseId) => {
		if (!onDiseasesChange) return;
		const exists = diseases.includes(disease);
		if (exists) {
			const next = diseases.filter((d) => d !== disease);
			onDiseasesChange(next.length > 0 ? next : [disease]);
			return;
		}
		const order: ReferenceDiseaseId[] = ["aml", "ball", "tall"];
		onDiseasesChange(
			[...diseases, disease].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
		);
	};

	const handleHarmonize = async () => {
		const alreadyHarmonized = selectedSamples.filter((sample) =>
			harmonizedSamples.includes(sample)
		);

		if (alreadyHarmonized.length > 0) {
			toast({
				title: "Warning",
				description:
					"Some selected samples are already harmonized. Please deselect them before continuing.",
				variant: "destructive",
			});
			return;
		}

		setIsHarmonizing(true);
		try {
			await fetchHarmonizedData(selectedSamples, diseases);
			const updatedHarmonizedData = await fetchHarmonizedDataNames();
			setHarmonizedSamples(updatedHarmonizedData || []);
			const manifest = await fetchHarmonizationManifest().catch(() => null);
			setHarmonizationManifest(manifest && !manifest.error ? manifest : null);
			onDataChanged?.();
			setSelectedSamples([]);
			toast({
				title: "Success",
				description: "Data harmonization completed successfully.",
				variant: "default",
			});
		} catch (error) {
			console.error("Error harmonizing data:", error);
			toast({
				title: "Error",
				description: "Failed to harmonize data. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsHarmonizing(false);
		}
	};

	return (
		<CollapsibleCard disabled={harmonizedSamples?.length == 0} className={cardClass}>
			<CollapsibleCardTrigger>
				<div className="flex items-center justify-between gap-3 px-6">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						<CardTitle>Harmonize Data</CardTitle>
					</div>
					<div className="hidden sm:flex items-center gap-2">
						{totalSamples > 0 && (
							<>
								<Badge variant="outline" className="font-medium">
									{totalSamples} uploaded
								</Badge>
								<Badge variant="secondary" className="font-medium">
									{harmonizedCount} harmonized
								</Badge>
							</>
						)}
					</div>
				</div>
			</CollapsibleCardTrigger>
			<CollapsibleCardContent>
				<CardHeader>
					<CardDescription>
						Align uploaded samples to the reference dataset so downstream
						comparisons and reports use harmonized expression values.
					</CardDescription>
					<div className="pt-1">
						<div className="mb-2 flex flex-wrap items-center gap-1.5">
							<Button
								type="button"
								variant={
									diseases.length === referenceOptions.length
										? "default"
										: "outline"
								}
								size="sm"
								className="h-8 text-xs"
								onClick={() =>
									onDiseasesChange?.(referenceOptions.map((d) => d.value))
								}
								disabled={!onDiseasesChange}
							>
								All
							</Button>
							{referenceOptions.map((option) => (
								<Button
									key={option.value}
									type="button"
									variant={
										diseases.includes(option.value) ? "default" : "outline"
									}
									size="sm"
									className="h-8 text-xs"
									onClick={() => toggleReferenceDisease(option.value)}
									disabled={!onDiseasesChange}
								>
									{option.label}
								</Button>
							))}
						</div>
						<Badge variant="outline" className="font-medium">
							Reference cohort:{" "}
							{diseases.length === 3
								? "Pan-Leukemia (AML + B-ALL + T-ALL)"
								: diseases
										.map((d) =>
											d === "aml" ? "AML" : d === "ball" ? "B-ALL" : "T-ALL",
										)
										.join(" + ")}
						</Badge>
					</div>
					{totalSamples > 0 && (
						<div className="flex flex-wrap gap-2 pt-1">
						<Badge variant="outline" className="font-medium">
							{totalSamples} total sample{totalSamples === 1 ? "" : "s"}
						</Badge>
						<Badge variant="outline" className="font-medium">
							{filteredSamples.length} visible
						</Badge>
						<Badge variant="secondary" className="font-medium">
							{unharmonizedSamples.length} ready
						</Badge>
						</div>
					)}
					{isEmptySetup ? (
						<div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
							Upload sample data first, then return here to harmonize.
						</div>
					) : (
						<>
					<div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
						<Input
							placeholder="Search samples..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="sm:max-w-[320px] bg-background"
						/>
						<div className="flex gap-2">
							<Button
								variant="outline"
								onClick={handleSelectAll}
								className="whitespace-nowrap flex-1 sm:flex-none"
								disabled={unharmonizedSamples.length === 0}
							>
								Select Visible ({unharmonizedSamples.length})
							</Button>
							<Button
								variant="outline"
								onClick={handleSelectNone}
								className="whitespace-nowrap flex-1 sm:flex-none"
							>
								Clear
							</Button>
						</div>
					</div>
						</>
					)}
				</CardHeader>
				{!isEmptySetup && (
				<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
					<div className="text-sm text-muted-foreground">
						{selectedSamples.length} selected
					</div>
					<div className="text-xs text-muted-foreground">
						Harmonized: {harmonizedCount} / {totalSamples}
					</div>
				</div>
				)}
				{!isEmptySetup && (
				<ScrollArea className="h-[400px] w-full rounded-md border bg-background/60 p-4">
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
						{filteredSamples.map((sample) => {
							const isHarmonized = harmonizedSamples.includes(sample);
							return (
								<div
									key={sample}
									className={`flex items-center space-x-2 rounded-md border px-2 py-2 ${
										isHarmonized
											? "border-border/50 bg-muted/20"
											: "border-border/60 hover:bg-muted/20"
									}`}
								>
									<Checkbox
										id={sample}
										checked={selectedSamples.includes(sample)}
										disabled={isHarmonized}
										onCheckedChange={(checked) => {
											if (checked) {
												setSelectedSamples([...selectedSamples, sample]);
											} else {
												setSelectedSamples(
													selectedSamples.filter((s) => s !== sample)
												);
											}
										}}
									/>
									<label
										htmlFor={sample}
										className={`text-xs cursor-pointer truncate ${
											isHarmonized
												? "text-muted-foreground line-through"
												: "hover:text-primary"
										}`}
									>
										{sample}
										{isHarmonized && " (harmonized)"}
									</label>
								</div>
							);
						})}
						{filteredSamples.length === 0 && searchTerm && (
							<div className="col-span-full text-center text-muted-foreground py-8">
								No samples found matching "{searchTerm}"
							</div>
						)}
						{filteredSamples.length === 0 && !searchTerm && totalSamples === 0 && (
							<div className="col-span-full text-center text-muted-foreground py-8">
								Upload sample data first, then return here to harmonize.
							</div>
						)}
						{filteredSamples.length > 0 && unharmonizedSamples.length === 0 && (
							<div className="col-span-full rounded-md border border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
								All visible samples are already harmonized.
							</div>
						)}
					</div>
				</ScrollArea>
				)}
				{!isEmptySetup && (
				<div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
					<div className="text-xs text-muted-foreground">
						Harmonize selected unharmonized samples before t-SNE, KNN, and CNV
						comparisons.
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => {
								setSearchTerm("");
								setSelectedSamples([]);
							}}
						>
							<RefreshCcw className="mr-2 h-4 w-4" />
							Reset
						</Button>
						<Button
							onClick={handleHarmonize}
							disabled={
								selectedSamples.length === 0 ||
								isHarmonizing ||
								selectedSamples.some((sample) => harmonizedSamples.includes(sample))
							}
						>
							{isHarmonizing
								? "Harmonizing..."
								: `Harmonize (${selectedSamples.length})`}
						</Button>
					</div>
				</div>
				)}
				{harmonizationManifest && (
					<div className="mt-4 rounded-md border border-border/60 bg-background/60 p-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="text-sm font-medium">Harmonization QC (last run)</div>
							<div className="text-xs text-muted-foreground">
								{String(firstValue(harmonizationManifest.timestamp_utc) ?? "")}
							</div>
						</div>
						<div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
							<div className="rounded border border-border/50 px-2 py-2">
								<div className="text-muted-foreground">Reference</div>
								<div className="font-medium break-words">
									{String(
										firstValue(harmonizationManifest.disease_selection_key) ??
											"unknown",
									)}
								</div>
							</div>
							<div className="rounded border border-border/50 px-2 py-2">
								<div className="text-muted-foreground">Common genes</div>
								<div className="font-medium">
									{String(
										firstValue(harmonizationManifest.overlap?.common_gene_count) ??
											"n/a",
									)}
								</div>
							</div>
							<div className="rounded border border-border/50 px-2 py-2">
								<div className="text-muted-foreground">Uploaded overlap</div>
								<div className="font-medium">
									{typeof firstValue(
										harmonizationManifest.overlap?.uploaded_overlap_fraction,
									) ===
									"number"
										? `${(
												(firstValue(
													harmonizationManifest.overlap?.uploaded_overlap_fraction,
												) as number) * 100
										  ).toFixed(1)}%`
										: "n/a"}
								</div>
							</div>
							<div className="rounded border border-border/50 px-2 py-2">
								<div className="text-muted-foreground">Batches</div>
								<div className="font-medium">
									{String(firstValue(harmonizationManifest.batches?.unique) ?? "n/a")} groups
								</div>
							</div>
						</div>
						<div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2 text-xs">
							<div className="rounded border border-border/50 px-2 py-2">
								<div className="text-muted-foreground mb-1">
									Reference metadata missing (core)
								</div>
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline" className="text-[11px]">
										study:{" "}
										{String(
											firstValue(
												harmonizationManifest.metadata_alignment
													?.missing_core_counts?.study,
											) ?? "n/a",
										)}
									</Badge>
									<Badge variant="outline" className="text-[11px]">
										sex:{" "}
										{String(
											firstValue(
												harmonizationManifest.metadata_alignment
													?.missing_core_counts?.sex,
											) ?? "n/a",
										)}
									</Badge>
									<Badge variant="outline" className="text-[11px]">
										subtype:{" "}
										{String(
											firstValue(
												harmonizationManifest.metadata_alignment
													?.missing_core_counts?.subtype,
											) ?? "n/a",
										)}
									</Badge>
								</div>
							</div>
							<div className="rounded border border-border/50 px-2 py-2">
								<div className="text-muted-foreground mb-1">
									Reference disease mix
								</div>
								<div className="flex flex-wrap gap-1">
									{Object.entries(
										(harmonizationManifest.reference?.disease_counts ?? {}) as Record<
											string,
											unknown
										>
									).map(([key, value]) => (
										<Badge key={key} variant="secondary" className="text-[11px]">
											{key}: {String(firstValue(value as any) ?? value)}
										</Badge>
									))}
								</div>
							</div>
						</div>
						{(() => {
							const warningsRaw = harmonizationManifest.warnings;
							const warningList = Array.isArray(warningsRaw)
								? warningsRaw.map((w) => String(firstValue(w as any) ?? w))
								: [];
							return warningList.length > 0 ? (
								<div className="mt-2 rounded border border-amber-300/60 bg-amber-50/60 px-2 py-2 text-xs text-amber-900">
									<div className="font-medium mb-1">Warnings</div>
									<div className="space-y-1">
										{warningList.map((w, i) => (
											<div key={`${i}-${w}`}>- {w}</div>
										))}
									</div>
								</div>
							) : null;
						})()}
					</div>
				)}
			</CollapsibleCardContent>
		</CollapsibleCard>
	);
}
