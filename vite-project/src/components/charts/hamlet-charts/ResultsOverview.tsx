import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HamletData } from "@/components/data-upload/HamletUpload";

interface ResultsOverviewProps {
	data: HamletData;
}

interface VariantSummary {
	gene: string;
	hgvs: string;
	database: string;
	identifiers: string[];
	vaf: number;
	annotation: string;
	exon: string;
	refAlt: string;
	totalReads: number;
	position: string;
	consequence: string;
}

export function ResultsOverview({ data }: ResultsOverviewProps) {
	// Extract variants from all genes
	const variants: VariantSummary[] = [];

	if (data.modules.snv_indels.genes) {
		Object.entries(data.modules.snv_indels.genes).forEach(
			([geneSymbol, geneVariants]) => {
				geneVariants.forEach((variant) => {
					// Extract comprehensive HGVS-like description
					const hgvsParts: string[] = [];

					// Genomic HGVS
					let genomicHgvs = `${variant.seq_region_name}:g.${variant.start}`;
					if (variant.INFO?.REF && variant.INFO?.ALT) {
						genomicHgvs += `${variant.INFO.REF}>${variant.INFO.ALT}`;
					}
					hgvsParts.push(genomicHgvs);

					// Add transcript-level HGVS if available
					if (
						variant.transcript_consequences &&
						variant.transcript_consequences.length > 0
					) {
						variant.transcript_consequences.forEach(
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							(tc: Record<string, any>) => {
								if (tc.hgvsc) {
									hgvsParts.push(tc.hgvsc);
								}
								if (tc.hgvsp) {
									hgvsParts.push(tc.hgvsp);
								}
							}
						);
					}

					// Join all HGVS parts with line breaks for display
					const hgvs = hgvsParts.join("\n");

					// Extract VAF from FORMAT if available
					let vaf = 0;
					if (variant.FORMAT?.AF) {
						vaf = Array.isArray(variant.FORMAT.AF)
							? variant.FORMAT.AF[0]
							: variant.FORMAT.AF;
					} else if (variant.FORMAT?.AD && variant.FORMAT?.DP) {
						// Calculate VAF from allele depth if available
						const ad = Array.isArray(variant.FORMAT.AD)
							? variant.FORMAT.AD
							: [variant.FORMAT.AD];
						const dp = variant.FORMAT.DP;
						if (ad.length > 1 && dp > 0) {
							vaf = ad[1] / dp; // Alternate allele fraction
						}
					}

					// Extract consequence and exon info
					let consequence = "Unknown";
					let exon = "N/A";
					if (
						variant.transcript_consequences &&
						variant.transcript_consequences.length > 0
					) {
						const tc = variant.transcript_consequences[0];
						if (tc.consequence_terms && tc.consequence_terms.length > 0) {
							consequence = tc.consequence_terms[0];
						}
						if (tc.exon) {
							exon = tc.exon;
						}
					}

					// Extract database identifiers
					const identifiers: string[] = [];

					// Add colocated variants (COSMIC, dbSNP, etc.)
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					if ((variant as any).colocated_variants) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(variant as any).colocated_variants.forEach((cv: any) => {
							if (cv.id) {
								identifiers.push(cv.id);
							}
							// Also check var_synonyms
							if (cv.var_synonyms) {
								if (
									cv.var_synonyms.COSMIC &&
									Array.isArray(cv.var_synonyms.COSMIC)
								) {
									identifiers.push(...cv.var_synonyms.COSMIC);
								}
								if (
									cv.var_synonyms.dbSNP &&
									Array.isArray(cv.var_synonyms.dbSNP)
								) {
									identifiers.push(...cv.var_synonyms.dbSNP);
								}
							}
						});
					}

					// Also check Existing_variation as fallback
					if (variant.Existing_variation) {
						const existingVars = Array.isArray(variant.Existing_variation)
							? variant.Existing_variation
							: [variant.Existing_variation];
						identifiers.push(...existingVars);
					}

					// Add dbSNP RS ID if available (check multiple possible fields)
					if (variant.INFO?.dbSNP_RS) {
						const rsId = variant.INFO.dbSNP_RS.toString().startsWith("rs")
							? variant.INFO.dbSNP_RS
							: `rs${variant.INFO.dbSNP_RS}`;
						identifiers.push(rsId);
					}
					// Also check for RS, rs_id, or other dbSNP fields
					if (variant.INFO?.RS) {
						const rsId = variant.INFO.RS.toString().startsWith("rs")
							? variant.INFO.RS
							: `rs${variant.INFO.RS}`;
						identifiers.push(rsId);
					}
					if (variant.INFO?.rs_id) {
						const rsId = variant.INFO.rs_id.toString().startsWith("rs")
							? variant.INFO.rs_id
							: `rs${variant.INFO.rs_id}`;
						identifiers.push(rsId);
					}

					// Add COSMIC ID if available (check multiple possible fields)
					if (variant.INFO?.COSMIC) {
						const cosmicId = variant.INFO.COSMIC.toString().startsWith("COSV")
							? variant.INFO.COSMIC
							: `COSV${variant.INFO.COSMIC}`;
						identifiers.push(cosmicId);
					}
					// Also check for cosmic_id, COSM, or other COSMIC fields
					if (variant.INFO?.cosmic_id) {
						const cosmicId = variant.INFO.cosmic_id
							.toString()
							.startsWith("COSV")
							? variant.INFO.cosmic_id
							: `COSV${variant.INFO.cosmic_id}`;
						identifiers.push(cosmicId);
					}
					if (variant.INFO?.COSM) {
						const cosmicId = variant.INFO.COSM.toString().startsWith("COSV")
							? variant.INFO.COSM
							: `COSV${variant.INFO.COSM}`;
						identifiers.push(cosmicId);
					}

					// Check for any other ID fields in INFO that might contain database identifiers
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const info = variant.INFO as Record<string, any>;
					if (info) {
						Object.keys(info).forEach((key) => {
							const value = info[key];
							if (value && typeof value === "string") {
								// Only accept known database identifier patterns
								if (
									value.startsWith("COSV") ||
									value.startsWith("rs") ||
									value.startsWith("COSM")
								) {
									identifiers.push(value);
								}
							} else if (value && Array.isArray(value)) {
								// Handle array values
								value.forEach((item) => {
									if (
										item &&
										typeof item === "string" &&
										(item.startsWith("COSV") ||
											item.startsWith("rs") ||
											item.startsWith("COSM"))
									) {
										identifiers.push(item);
									}
								});
							}
						});
					}

					// Remove duplicates
					const uniqueIdentifiers = [...new Set(identifiers)];

					// Determine database based on found identifiers
					let database = "Unknown";
					let hasDbSNP = false;
					let hasCOSMIC = false;

					// Check INFO fields first
					if (
						variant.INFO?.dbSNP_RS ||
						variant.INFO?.RS ||
						variant.INFO?.rs_id
					) {
						hasDbSNP = true;
					}
					if (
						variant.INFO?.COSMIC ||
						variant.INFO?.cosmic_id ||
						variant.INFO?.COSM
					) {
						hasCOSMIC = true;
					}

					// Also check identifiers for database patterns
					uniqueIdentifiers.forEach((id) => {
						if (id.startsWith("rs")) {
							hasDbSNP = true;
						}
						if (id.startsWith("COSV") || id.startsWith("COSM")) {
							hasCOSMIC = true;
						}
					});

					// Determine database type
					if (hasDbSNP && hasCOSMIC) {
						database = "Multiple";
					} else if (hasDbSNP) {
						database = "dbSNP";
					} else if (hasCOSMIC) {
						database = "COSMIC";
					} else if (uniqueIdentifiers.length > 0) {
						database = "Other";
					}

					// Extract ref/alt counts from FORMAT.AD (Allelic Depths)
					let refAlt = "N/A";

					if (variant.FORMAT?.AD) {
						const ad = Array.isArray(variant.FORMAT.AD)
							? variant.FORMAT.AD
							: [variant.FORMAT.AD];

						// Filter out NaN and non-numeric values, convert to numbers
						const numericAD: number[] = ad
							.map((val) => {
								if (typeof val === "string") {
									const parsed = parseInt(val, 10);
									return isNaN(parsed) ? null : parsed;
								}
								return typeof val === "number" ? val : null;
							})
							.filter((val): val is number => val !== null && !isNaN(val));

						if (numericAD.length >= 2) {
							const refCount = numericAD[0];
							const altCount = numericAD[1];
							refAlt = `${refCount}/${altCount}`;
						} else if (numericAD.length === 1) {
							// Only one valid value, assume it's ref count and calculate alt from total
							const refCount = numericAD[0];
							const totalReads = variant.FORMAT?.DP || 0;
							const altCount = Math.max(0, totalReads - refCount);
							refAlt = `${refCount}/${altCount}`;
						}
					}

					// Get total reads
					const totalReads = variant.FORMAT?.DP || 0;

					variants.push({
						gene: geneSymbol,
						hgvs,
						database,
						identifiers: uniqueIdentifiers,
						vaf,
						annotation: consequence,
						exon,
						refAlt,
						totalReads,
						position: `${
							variant.seq_region_name
						}:${variant.start.toLocaleString()}`,
						consequence,
					});
				});
			}
		);
	}

	// Sort variants by gene, then by position
	variants.sort((a, b) => {
		if (a.gene !== b.gene) return a.gene.localeCompare(b.gene);
		return a.position.localeCompare(b.position);
	});

	return (
		<div className="space-y-6">
			{/* Summary Statistics */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-blue-600">
								{variants.length}
							</p>
							<p className="text-sm text-gray-600">Total Variants</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-green-600">
								{new Set(variants.map((v) => v.gene)).size}
							</p>
							<p className="text-sm text-gray-600">Genes Affected</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-purple-600">
								{variants.filter((v) => v.database !== "Unknown").length}
							</p>
							<p className="text-sm text-gray-600">Annotated Variants</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-orange-600">
								{variants.filter((v) => v.vaf > 0.05).length}
							</p>
							<p className="text-sm text-gray-600">High VAF (≥5%)</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Variants Table */}
			<Card>
				<CardHeader>
					<CardTitle>Variants Overview</CardTitle>
					<p className="text-sm text-gray-600">
						Comprehensive summary of all detected variants
					</p>
				</CardHeader>
				<CardContent>
					{variants.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="bg-gray-100">
									<tr>
										<th className="px-4 py-2 text-left font-semibold text-gray-700">
											Gene
										</th>
										<th className="px-4 py-2 text-left font-semibold text-gray-700">
											HGVS Description
										</th>
										<th className="px-4 py-2 text-left font-semibold text-gray-700">
											Database identifiers
										</th>
										<th className="px-4 py-2 text-center font-semibold text-gray-700">
											VAF
										</th>
										<th className="px-4 py-2 text-left font-semibold text-gray-700">
											Annotation/Exon
										</th>
										<th className="px-4 py-2 text-left font-semibold text-gray-700">
											Ref/Alt (Total)
										</th>
									</tr>
								</thead>
								<tbody>
									{variants.map((variant) => (
										<tr
											key={`${variant.gene}-${variant.position}`}
											className="border-b border-gray-50 hover:bg-blue-50/30 align-top"
										>
											<td className="px-4 py-3 font-medium text-blue-700 align-top">
												{variant.gene}
											</td>
											<td className="px-4 py-3 font-mono text-sm text-gray-800 align-top">
												<div className="whitespace-pre-line text-xs leading-tight max-w-xs break-words">
													{variant.hgvs}
												</div>
											</td>
											<td className="px-4 py-3 text-sm align-top">
												{variant.identifiers.length > 0 ? (
													<div className="space-y-1">
														{variant.identifiers.map((id, i) => {
															// Create clickable links for database identifiers
															let linkUrl = null;
															if (id.startsWith("rs")) {
																linkUrl = `https://www.ncbi.nlm.nih.gov/snp/${id}`;
															} else if (id.startsWith("COSV")) {
																linkUrl = `https://cancer.sanger.ac.uk/cosmic/search?q=${id}`;
															} else if (id.startsWith("COSM")) {
																linkUrl = `https://cancer.sanger.ac.uk/cosmic/search?q=${id}`;
															}

															return (
																<div key={i}>
																	{linkUrl ? (
																		<a
																			href={linkUrl}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="font-mono text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded text-blue-800 hover:text-blue-900 transition-colors inline-block"
																			title={`Search ${id} in ${
																				id.startsWith("rs") ? "dbSNP" : "COSMIC"
																			}`}
																		>
																			{id}
																		</a>
																	) : (
																		<span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded inline-block">
																			{id}
																		</span>
																	)}
																</div>
															);
														})}
													</div>
												) : (
													<span className="text-xs text-gray-400">
														No identifiers
													</span>
												)}
											</td>
											<td className="px-4 py-3 text-center align-top">
												<span
													className={`px-2 py-1 rounded-full text-xs font-medium ${
														variant.vaf >= 0.5
															? "bg-red-100 text-red-800"
															: variant.vaf >= 0.1
															? "bg-yellow-100 text-yellow-800"
															: variant.vaf >= 0.05
															? "bg-blue-100 text-blue-800"
															: "bg-gray-100 text-gray-800"
													}`}
												>
													{variant.vaf > 0
														? `${(variant.vaf * 100).toFixed(1)}%`
														: "N/A"}
												</span>
											</td>
											<td className="px-4 py-3 text-sm align-top">
												<div className="capitalize">
													{variant.annotation.replace(/_/g, " ")}
												</div>
												{variant.exon !== "N/A" && (
													<div className="text-xs text-gray-600 mt-1">
														Exon {variant.exon}
													</div>
												)}
											</td>
											<td className="px-4 py-3 font-mono text-sm align-top">
												<div>{variant.refAlt}</div>
												{variant.totalReads > 0 && (
													<div className="text-xs text-gray-600 mt-1">
														({variant.totalReads} reads)
													</div>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="text-center py-8 text-gray-500">
							<p className="text-lg">No variants detected</p>
							<p className="text-sm mt-2">
								This sample appears to have no detected variants in the analyzed
								genes.
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* VAF Legend */}
			{variants.length > 0 && (
				<Card className="bg-gradient-to-r from-gray-50 to-blue-50">
					<CardHeader>
						<CardTitle className="text-lg">
							Variant Allele Frequency (VAF) Guide
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-gray-100 rounded"></div>
								<span>Low (&lt;5%)</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-blue-100 rounded"></div>
								<span>Moderate (5-10%)</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-yellow-100 rounded"></div>
								<span>High (10-50%)</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-red-100 rounded"></div>
								<span>Very High (≥50%)</span>
							</div>
						</div>
						<div className="mt-4 p-3 bg-white rounded-lg border">
							<h4 className="font-semibold text-blue-800 mb-1">
								Understanding VAF:
							</h4>
							<p className="text-xs text-blue-700">
								VAF indicates the proportion of sequencing reads that carry the
								variant allele. Higher VAF values suggest stronger variant
								presence, but interpretation depends on sample type and analysis
								context.
							</p>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
