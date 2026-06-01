import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	HamletUpload,
	HamletData,
} from "@/components/data-upload/HamletUpload";
import { GenomicSummary } from "@/components/charts/hamlet-charts/GenomicSummary";
import { ExpressionPanel } from "@/components/charts/hamlet-charts/ExpressionPanel";
import { CellTypePanel } from "@/components/charts/hamlet-charts/CellTypePanel";
import { ITDPanel } from "@/components/charts/hamlet-charts/ITDPanel";
import { SubtypePanel } from "@/components/charts/hamlet-charts/SubtypePanel";

const HAMLET_AI_SUMMARY_KEY = "hamlet-ai-summary-v1";

const buildHamletAiSummary = (data: HamletData) => {
	const sampleName = data.metadata.sample_name;
	const pipelineVersion = data.metadata.pipeline_version;

	const fusions = Array.isArray(data.modules.fusion.events)
		? data.modules.fusion.events
				.slice(0, 15)
				.map((event) => ({
					gene_pair: `${event.gene1}-${event.gene2}`,
					discordant_mates: event.discordant_mates,
					split_reads1: event.split_reads1,
					split_reads2: event.split_reads2,
				}))
		: [];

	const flt3Count = Array.isArray(data.modules.itd.flt3.table)
		? data.modules.itd.flt3.table.length
		: 0;
	const kmt2aCount = Array.isArray(data.modules.itd.kmt2a.table)
		? data.modules.itd.kmt2a.table.length
		: 0;

	const cellTypeMatrix = data.modules.expression["cell-types"].data ?? {};
	const selectedCellTypeRow =
		cellTypeMatrix[sampleName] ?? Object.values(cellTypeMatrix)[0] ?? {};
	const topCellTypes = Object.entries(selectedCellTypeRow)
		.map(([cellType, value]) => ({
			cell_type: cellType,
			fraction: typeof value === "number" ? value : Number(value),
		}))
		.filter((row) => Number.isFinite(row.fraction))
		.sort((a, b) => b.fraction - a.fraction)
		.slice(0, 10)
		.map((row) => ({
			cell_type: row.cell_type,
			fraction: row.fraction,
			percent: Number((row.fraction * 100).toFixed(2)),
		}));

	const subtype = data.modules.expression.subtype;
	const subtypeSnapshot =
		subtype && typeof subtype === "object"
			? Object.entries(subtype as Record<string, unknown>)
					.slice(0, 20)
					.reduce<Record<string, unknown>>((acc, [key, value]) => {
						if (
							typeof value === "string" ||
							typeof value === "number" ||
							typeof value === "boolean"
						) {
							acc[key] = value;
						}
						return acc;
					}, {})
			: {};

	const varStats = data.modules.snv_indels.stats.var;
	const polyphen = varStats.polyphen;
	const sift = varStats.sift;

	return {
		status: "ok",
		sample_name: sampleName,
		pipeline_version: pipelineVersion,
		fusion_event_count: Array.isArray(data.modules.fusion.events)
			? data.modules.fusion.events.length
			: 0,
		top_fusions: fusions,
		itd: {
			flt3_event_count: flt3Count,
			kmt2a_event_count: kmt2aCount,
		},
		variants: {
			num_snvs: varStats.num_snvs,
			num_insertions: varStats.num_insertions,
			num_deletions: varStats.num_deletions,
			polyphen,
			sift,
		},
		cell_types: {
			dominant_cell_type: topCellTypes[0]?.cell_type ?? null,
			top_cell_types: topCellTypes,
		},
		subtype_snapshot: subtypeSnapshot,
	};
};

export function HamletDashboard() {
	const [hamletData, setHamletData] = useState<HamletData | null>(null);

	const handleDataLoaded = (data: HamletData) => {
		setHamletData(data);
	};

	useEffect(() => {
		if (!hamletData || typeof window === "undefined") return;
		try {
			const summary = buildHamletAiSummary(hamletData);
			window.sessionStorage.setItem(HAMLET_AI_SUMMARY_KEY, JSON.stringify(summary));
		} catch (error) {
			console.warn("Failed to cache HAMLET summary for AI tab", error);
		}
	}, [hamletData]);

	if (!hamletData) {
		return (
			<div className="space-y-6">
				<HamletUpload onDataLoaded={handleDataLoaded} />
				<Card className="w-full">
					<CardHeader>
						<CardTitle>HAMLET Analysis Dashboard</CardTitle>
						<p className="text-sm text-gray-600">Developmental</p>
					</CardHeader>
					<CardContent className="p-8 text-center">
						<p className="text-lg text-gray-600">
							Upload a HAMLET output file to begin exploring genomic analysis
							results.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<HamletUpload onDataLoaded={handleDataLoaded} currentData={hamletData} />

			<Card>
				<CardHeader>
					<CardTitle>HAMLET Analysis Dashboard</CardTitle>
					<p className="text-sm text-gray-600">
						Sample:{" "}
						<span className="font-medium">
							{hamletData.metadata.sample_name}
						</span>{" "}
						| Pipeline Version:{" "}
						<span className="font-medium">
							{hamletData.metadata.pipeline_version}
						</span>
					</p>
				</CardHeader>
			</Card>

			<Tabs defaultValue="genomic" className="space-y-4">
				<TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
					<TabsTrigger value="genomic">Genomic Analysis</TabsTrigger>
					<TabsTrigger value="expression">Gene Expression</TabsTrigger>
					<TabsTrigger value="celltypes">Cell Types</TabsTrigger>
					<TabsTrigger value="itd">Internal Tandem Duplications</TabsTrigger>
					<TabsTrigger value="subtype">AML Subtype</TabsTrigger>
				</TabsList>

				<TabsContent value="genomic">
					<GenomicSummary data={hamletData} />
				</TabsContent>

				<TabsContent value="expression">
					<ExpressionPanel
						data={hamletData.modules.expression["gene-expression"]}
						genesOfInterest={hamletData.metadata.genes_of_interest}
					/>
				</TabsContent>

				<TabsContent value="celltypes">
					<CellTypePanel
						data={{
							[hamletData.metadata.sample_name]: hamletData.modules.expression[
								"cell-types"
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
							].data as any,
						}}
						plot={hamletData.modules.expression["cell-types"].plot}
					/>
				</TabsContent>

				<TabsContent value="itd">
					<ITDPanel
						flt3={hamletData.modules.itd.flt3}
						kmt2a={hamletData.modules.itd.kmt2a}
						sampleName={hamletData.metadata.sample_name}
					/>
				</TabsContent>

				<TabsContent value="subtype">
					<SubtypePanel
						subtype={hamletData.modules.expression.subtype}
						sampleName={hamletData.metadata.sample_name}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
