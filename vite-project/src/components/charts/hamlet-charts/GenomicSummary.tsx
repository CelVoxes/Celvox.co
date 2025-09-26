import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FusionPanel } from "@/components/charts/hamlet-charts/FusionPanel";
import { VariantPanel } from "@/components/charts/hamlet-charts/VariantPanel";
// import { CoveragePanel } from "@/components/charts/hamlet-charts/CoveragePanel";
// import { StatisticPanel } from "@/components/charts/hamlet-charts/StatisticPanel";
import { ResultsOverview } from "@/components/charts/hamlet-charts/ResultsOverview";
import { HamletData } from "@/components/data-upload/HamletUpload";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface GenomicSummaryProps {
	data: HamletData;
}

// Transform HAMLET fusion events to the format expected by FusionPanel
const transformFusions = (
	fusions: HamletData["modules"]["fusion"]["events"]
) => {
	return fusions.map((fusion) => ({
		gene1: fusion.gene1,
		gene2: fusion.gene2,
		type: "fusion", // HAMLET doesn't specify fusion type in the schema
		readSupport:
			fusion.split_reads1 + fusion.split_reads2 + fusion.discordant_mates,
		confidence: Math.min(
			1,
			(fusion.split_reads1 + fusion.split_reads2 + fusion.discordant_mates) / 10
		), // Simple confidence calculation
	}));
};

export function GenomicSummary({ data }: GenomicSummaryProps) {
	const hasFusions = data.modules?.fusion?.events?.length > 0;
	const hasVariants = data.modules?.snv_indels?.stats?.var;
	const hasCoverage =
		data.modules?.snv_indels?.stats?.cov &&
		Object.keys(data.modules.snv_indels.stats.cov).length > 0;
	const hasStats =
		data.modules?.snv_indels?.stats?.aln &&
		data.modules?.snv_indels?.stats?.rna &&
		data.modules?.snv_indels?.stats?.var;

	// Default to the first available tab
	// State for expandable gene coverage sections
	const [expandedGenes, setExpandedGenes] = useState<Set<string>>(new Set());

	const toggleGeneExpansion = (gene: string) => {
		const newExpanded = new Set(expandedGenes);
		if (newExpanded.has(gene)) {
			newExpanded.delete(gene);
		} else {
			newExpanded.add(gene);
		}
		setExpandedGenes(newExpanded);
	};

	return (
		<div className="max-w-7xl mx-auto p-4">
			<Card>
				<CardHeader>
					<CardTitle>Genomic Analysis Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="overview" className="space-y-4">
						<TabsList>
							<TabsTrigger value="overview">📊 Overview</TabsTrigger>
							{hasStats && <TabsTrigger value="stats">Statistics</TabsTrigger>}
							{hasVariants && (
								<TabsTrigger value="variants">Variants</TabsTrigger>
							)}
							{hasFusions && <TabsTrigger value="fusions">Fusions</TabsTrigger>}
							{hasCoverage && (
								<TabsTrigger value="coverage">Coverage</TabsTrigger>
							)}
						</TabsList>

						<TabsContent value="overview">
							<ResultsOverview data={data} />
						</TabsContent>

						{hasStats && (
							<TabsContent value="stats">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<Card className="p-4">
										<h3 className="font-bold mb-4">Alignment Statistics</h3>
										<div className="space-y-2">
											<div className="flex justify-between">
												<span className="text-sm">Total Reads</span>
												<span className="font-medium">
													{data.modules.snv_indels.stats.aln.num_total_reads?.toLocaleString() ||
														"N/A"}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-sm">Aligned Reads</span>
												<span className="font-medium">
													{data.modules.snv_indels.stats.aln.num_aligned_reads?.toLocaleString() ||
														"N/A"}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-sm">Proper Pairs (%)</span>
												<span className="font-medium">
													{data.modules.snv_indels.stats.aln.pct_aligned_reads_proper_pairs?.toFixed(
														1
													) || "N/A"}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-sm">Strand Balance</span>
												<span className="font-medium">
													{data.modules.snv_indels.stats.aln.strand_balance?.toFixed(
														2
													) || "N/A"}
												</span>
											</div>
										</div>
									</Card>

									<Card className="p-4">
										<h3 className="font-bold mb-4">RNA Statistics</h3>
										<div className="space-y-2">
											<div className="flex justify-between">
												<span className="text-sm">Coding Bases (%)</span>
												<span className="font-medium">
													{data.modules.snv_indels.stats.rna.pct_coding_bases?.toFixed(
														1
													) || "N/A"}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-sm">mRNA Bases (%)</span>
												<span className="font-medium">
													{data.modules.snv_indels.stats.rna.pct_mrna_bases?.toFixed(
														1
													) || "N/A"}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-sm">Median CV Coverage</span>
												<span className="font-medium">
													{data.modules.snv_indels.stats.rna.median_cv_coverage?.toFixed(
														2
													) || "N/A"}
												</span>
											</div>
										</div>
									</Card>
								</div>
							</TabsContent>
						)}

						{hasVariants && (
							<TabsContent value="variants">
								<VariantPanel data={data.modules.snv_indels.stats.var} />
							</TabsContent>
						)}

						{hasFusions && (
							<TabsContent value="fusions">
								<FusionPanel
									fusions={transformFusions(data.modules.fusion.events)}
								/>
							</TabsContent>
						)}

						{hasCoverage && (
							<TabsContent value="coverage">
								<div className="space-y-6">
									{Object.entries(data.modules.snv_indels.stats.cov).map(
										([gene, transcripts], _geneIndex) => {
											const isExpanded = expandedGenes.has(gene);
											const transcriptCount = Object.keys(transcripts).length;
											const totalExons = Object.values(transcripts).reduce(
												(sum, exons) => sum + exons.length,
												0
											);

											return (
												<Card key={gene} className="overflow-hidden">
													<div
														className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
														onClick={() => toggleGeneExpansion(gene)}
													>
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-3">
																{isExpanded ? (
																	<ChevronDown className="w-5 h-5 text-blue-600" />
																) : (
																	<ChevronRight className="w-5 h-5 text-blue-600" />
																)}
																<h3 className="font-bold text-lg text-blue-900">
																	{gene} - Coverage Analysis
																</h3>
															</div>
															<div className="text-sm text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
																{transcriptCount} transcript
																{transcriptCount !== 1 ? "s" : ""}, {totalExons}{" "}
																exon{totalExons !== 1 ? "s" : ""}
															</div>
														</div>
													</div>
													{isExpanded && (
														<div className="p-0">
															{Object.entries(transcripts).map(
																([transcript, exons], _transcriptIndex) => (
																	<div
																		key={transcript}
																		className="border-b border-gray-100 last:border-b-0"
																	>
																		<div className="px-6 py-3 bg-gray-50 border-b">
																			<h4 className="font-semibold text-sm text-gray-700">
																				Transcript: {transcript}
																			</h4>
																		</div>
																		<div className="overflow-x-auto">
																			<table className="w-full text-sm">
																				<thead className="bg-gray-100">
																					<tr>
																						<th className="px-4 py-2 text-left font-semibold text-gray-700">
																							Index
																						</th>
																						<th className="px-4 py-2 text-left font-semibold text-gray-700">
																							Location
																						</th>
																						<th className="px-4 py-2 text-left font-semibold text-gray-700">
																							Start
																						</th>
																						<th className="px-4 py-2 text-left font-semibold text-gray-700">
																							End
																						</th>
																						<th className="px-4 py-2 text-right font-semibold text-gray-700">
																							Median
																						</th>
																						<th className="px-4 py-2 text-right font-semibold text-gray-700">
																							Avg
																						</th>
																						<th className="px-4 py-2 text-right font-semibold text-gray-700">
																							Stdev
																						</th>
																						<th className="px-4 py-2 text-center font-semibold text-gray-700">
																							Frac ≥10x
																						</th>
																						<th className="px-4 py-2 text-center font-semibold text-gray-700">
																							Frac ≥20x
																						</th>
																						<th className="px-4 py-2 text-center font-semibold text-gray-700">
																							Frac ≥30x
																						</th>
																					</tr>
																				</thead>
																				<tbody>
																					{exons.map((exon, exonIndex) => {
																						const coverageAt10x =
																							exon.metrics.frac_cov_at_least?.[
																								"10"
																							] || 0;
																						const coverageAt20x =
																							exon.metrics.frac_cov_at_least?.[
																								"20"
																							] || 0;
																						const coverageAt30x =
																							exon.metrics.frac_cov_at_least?.[
																								"30"
																							] || 0;

																						return (
																							<tr
																								key={exonIndex}
																								className="border-b border-gray-50 hover:bg-blue-50/30"
																							>
																								<td className="px-4 py-2 font-mono text-gray-600">
																									{exonIndex + 1}
																								</td>
																								<td className="px-4 py-2 font-mono text-gray-800">
																									{exon.chrom}:
																									{exon.start.toLocaleString()}-
																									{exon.end.toLocaleString()}
																								</td>
																								<td className="px-4 py-2 font-mono text-gray-600">
																									{exon.start.toLocaleString()}
																								</td>
																								<td className="px-4 py-2 font-mono text-gray-600">
																									{exon.end.toLocaleString()}
																								</td>
																								<td className="px-4 py-2 text-right font-mono font-medium">
																									{exon.metrics.median.toFixed(
																										1
																									)}
																									x
																								</td>
																								<td className="px-4 py-2 text-right font-mono">
																									{exon.metrics.avg.toFixed(1)}x
																								</td>
																								<td className="px-4 py-2 text-right font-mono text-gray-600">
																									{exon.metrics.stdev.toFixed(
																										1
																									)}
																									x
																								</td>
																								<td className="px-4 py-2 text-center">
																									<span
																										className={`px-2 py-1 rounded-full text-xs font-medium ${
																											coverageAt10x >= 0.8
																												? "bg-green-100 text-green-800"
																												: coverageAt10x >= 0.5
																												? "bg-yellow-100 text-yellow-800"
																												: "bg-red-100 text-red-800"
																										}`}
																									>
																										{(
																											coverageAt10x * 100
																										).toFixed(0)}
																										%
																									</span>
																								</td>
																								<td className="px-4 py-2 text-center">
																									<span
																										className={`px-2 py-1 rounded-full text-xs font-medium ${
																											coverageAt20x >= 0.8
																												? "bg-green-100 text-green-800"
																												: coverageAt20x >= 0.5
																												? "bg-yellow-100 text-yellow-800"
																												: "bg-red-100 text-red-800"
																										}`}
																									>
																										{(
																											coverageAt20x * 100
																										).toFixed(0)}
																										%
																									</span>
																								</td>
																								<td className="px-4 py-2 text-center">
																									<span
																										className={`px-2 py-1 rounded-full text-xs font-medium ${
																											coverageAt30x >= 0.8
																												? "bg-green-100 text-green-800"
																												: coverageAt30x >= 0.5
																												? "bg-yellow-100 text-yellow-800"
																												: "bg-red-100 text-red-800"
																										}`}
																									>
																										{(
																											coverageAt30x * 100
																										).toFixed(0)}
																										%
																									</span>
																								</td>
																							</tr>
																						);
																					})}
																				</tbody>
																			</table>
																		</div>
																	</div>
																)
															)}
														</div>
													)}
												</Card>
											);
										}
									)}

									{/* Coverage Summary */}
									<Card className="bg-gradient-to-r from-gray-50 to-blue-50">
										<CardHeader>
											<CardTitle className="text-lg">
												Coverage Quality Guide
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
												<div>
													<h4 className="font-semibold text-green-700 mb-2">
														🟢 Good Coverage (≥80%)
													</h4>
													<p className="text-gray-600">
														High confidence regions suitable for variant calling
														and analysis.
													</p>
												</div>
												<div>
													<h4 className="font-semibold text-yellow-700 mb-2">
														🟡 Moderate Coverage (50-79%)
													</h4>
													<p className="text-gray-600">
														Acceptable for most analyses but may miss
														low-frequency variants.
													</p>
												</div>
												<div>
													<h4 className="font-semibold text-red-700 mb-2">
														🔴 Low Coverage (&lt;50%)
													</h4>
													<p className="text-gray-600">
														Insufficient coverage may lead to false negatives in
														variant detection.
													</p>
												</div>
											</div>
											<div className="mt-4 p-3 bg-blue-50 rounded-lg">
												<h4 className="font-semibold text-blue-800 mb-1">
													Understanding Coverage Metrics:
												</h4>
												<ul className="text-xs text-blue-700 space-y-1">
													<li>
														<strong>Index:</strong> Sequential exon numbering
													</li>
													<li>
														<strong>Location:</strong> Genomic coordinates
														(chromosome:start-end)
													</li>
													<li>
														<strong>Frac ≥10x, ≥20x, ≥30x:</strong> Fraction of
														bases covered at least at these depths
													</li>
													<li>
														<strong>Median/Avg/Stdev:</strong> Central tendency
														and variability of coverage
													</li>
												</ul>
											</div>
										</CardContent>
									</Card>
								</div>
							</TabsContent>
						)}
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
