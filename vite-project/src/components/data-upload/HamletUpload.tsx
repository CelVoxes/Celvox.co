import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle } from "lucide-react";

// HAMLET data type based on the schema
export interface HamletData {
	metadata: {
		genes_of_interest: Array<{
			gene_id: string;
			gene_symbol: string;
			transcript_ids: string[];
		}>;
		pipeline_version: string;
		sample_name: string;
	};
	modules: {
		fusion: {
			events: Array<{
				gene1: string;
				gene2: string;
				discordant_mates: number;
				split_reads1: number;
				split_reads2: number;
				coverage1: number;
				coverage2: number;
			}>;
			metadata: {
				sample_name: string;
			};
		};
		itd: {
			flt3: {
				path: string;
				table: Array<{
					boundary_type: string;
					fuzziness: number;
					rose_end_anchor_pos: number;
					rose_end_count: number;
					rose_end_pos: number;
					rose_start_anchor_pos: number;
					rose_start_count: number;
					rose_start_pos: number;
					td_ends: number[];
					td_starts: number[];
				}>;
			};
			kmt2a: {
				path: string;
				table: Array<{
					boundary_type: string;
					fuzziness: number;
					rose_end_anchor_pos: number;
					rose_end_count: number;
					rose_end_pos: number;
					rose_start_anchor_pos: number;
					rose_start_count: number;
					rose_start_pos: number;
					td_ends: number[];
					td_starts: number[];
				}>;
			};
			metadata: {
				sample_name: string;
			};
		};
		snv_indels: {
			genes: Record<
				string,
				Array<{
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					FORMAT: Record<string, any>;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					INFO: Record<string, any>;
					seq_region_name: string;
					start: number;
					genotype: string;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					transcript_consequences: Array<any>;
					Existing_variation: Array<string>;
				}>
			>;
			stats: {
				aln: {
					num_aligned_bases: number;
					num_aligned_reads: number;
					num_aligned_reads_proper_pairs: number;
					num_total_bases: number;
					num_total_reads: number;
					pct_adapter: number;
					pct_aligned_bases_from_total: number;
					pct_aligned_reads_from_total: number;
					pct_aligned_reads_proper_pairs: number;
					pct_chimeras: number;
					rate_indel: number;
					rate_mismatch: number;
					strand_balance: number;
				};
				cov: Record<
					string,
					Record<
						string,
						Array<{
							chrom: string;
							end: number;
							exon_num: number;
							metrics: {
								avg: number;
								count: number;
								frac_cov_at_least: Record<string, number>;
								max: number;
								median: number;
								min: number;
								stdev: number;
							};
							start: number;
						}>
					>
				>;
				ins: {
					max_insert_size: number;
					median_absolute_deviation: number;
					median_insert_size: number;
					min_insert_size: number;
				};
				rna: {
					median_3prime_bias: number;
					median_5prime_bias: number;
					median_5prime_to_3prime_bias: number;
					median_cv_coverage: number;
					normalized_cov: number[];
					num_coding_bases: number;
					num_intergenic_bases: number;
					num_intronic_bases: number;
					num_mrna_bases: number;
					num_ribosomal_bases: number;
					num_utr_bases: number;
					pct_coding_bases: number;
					pct_intergenic_bases: number;
					pct_intronic_bases: number;
					pct_mrna_bases: number;
					pct_ribosomal_bases: number;
					pct_utr_bases: number;
				};
				var: {
					coding_consequences: Record<string, number>;
					num_deletions: number;
					num_insertions: number;
					num_snvs: number;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					per_chromosome: Record<string, any>;
					polyphen: {
						num_benign_variants: number;
						num_possibly_damaging_variants: number;
						num_probably_damaging_variants: number;
						num_unknown_variants: number;
					};
					sift: {
						num_deleterious_variants: number;
						num_tolerated_variants: number;
					};
				};
			};
			metadata: {
				sample_name: string;
			};
		};
		expression: {
			metadata: {
				sample_name: string;
			};
			"gene-expression": Record<
				string,
				{
					normalized: number | null;
					raw: number;
				}
			>;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			subtype: Record<string, any>;
			"cell-types": {
				data: Record<string, Record<string, number>>;
				plot: string;
			};
		};
	};
}

interface HamletUploadProps {
	onDataLoaded: (data: HamletData) => void;
	currentData?: HamletData;
}

export function HamletUpload({ onDataLoaded, currentData }: HamletUploadProps) {
	const { toast } = useToast();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isValidating, setIsValidating] = useState(false);
	const [validationErrors, setValidationErrors] = useState<string[]>([]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const validateJsonAgainstSchema = (jsonData: any): boolean => {
		const errors: string[] = [];

		// Basic structure validation
		if (!jsonData.metadata) {
			errors.push("Missing 'metadata' section");
		} else {
			if (
				!jsonData.metadata.genes_of_interest ||
				!Array.isArray(jsonData.metadata.genes_of_interest)
			) {
				errors.push("Missing or invalid 'genes_of_interest' in metadata");
			}
			if (!jsonData.metadata.pipeline_version) {
				errors.push("Missing 'pipeline_version' in metadata");
			}
			if (!jsonData.metadata.sample_name) {
				errors.push("Missing 'sample_name' in metadata");
			}
		}

		if (!jsonData.modules) {
			errors.push("Missing 'modules' section");
		} else {
			const requiredModules = ["fusion", "itd", "snv_indels", "expression"];
			for (const module of requiredModules) {
				if (!jsonData.modules[module]) {
					errors.push(`Missing '${module}' module`);
				}
			}
		}

		setValidationErrors(errors);
		return errors.length === 0;
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files && event.target.files.length > 0) {
			const file = event.target.files[0];
			setSelectedFile(file);
			setValidationErrors([]);
		}
	};

	const handleUpload = async () => {
		if (!selectedFile) {
			toast({
				title: "Error",
				description: "Please select a file first!",
				variant: "destructive",
			});
			return;
		}

		if (!selectedFile.name.endsWith(".json")) {
			toast({
				title: "Error",
				description: "Please upload a JSON file!",
				variant: "destructive",
			});
			return;
		}

		setIsValidating(true);
		try {
			const text = await selectedFile.text();
			const jsonData = JSON.parse(text);

			// Validate against schema
			if (validateJsonAgainstSchema(jsonData)) {
				toast({
					title: "Success",
					description: "HAMLET data loaded successfully!",
				});
				onDataLoaded(jsonData as HamletData);
			} else {
				toast({
					title: "Validation Error",
					description:
						"The uploaded file does not conform to the HAMLET schema.",
					variant: "destructive",
				});
			}
		} catch (error) {
			toast({
				title: "Error",
				description:
					error instanceof Error ? error.message : "Failed to parse JSON file.",
				variant: "destructive",
			});
		} finally {
			setIsValidating(false);
		}
	};

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Upload HAMLET Output</CardTitle>
				<CardDescription>
					Upload a HAMLET pipeline output JSON file to visualize genomic
					analysis results.
				</CardDescription>

				{/* Privacy Notice */}
				<p className="mt-3 mx-6 text-sm text-blue-700">
					🔒 HAMLET results are processed entirely on the browser. No files are
					uploaded to servers.
				</p>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col sm:flex-row gap-4 mb-6">
					<Input
						type="file"
						onChange={handleFileChange}
						accept=".json"
						className="flex-1"
					/>
					<Button
						onClick={handleUpload}
						disabled={!selectedFile || isValidating}
					>
						{isValidating ? "Validating..." : "Upload & Validate"}
					</Button>
				</div>

				{selectedFile && (
					<div className="mb-4">
						<p className="text-sm text-gray-600">
							Selected file:{" "}
							<span className="font-medium">{selectedFile.name}</span>
						</p>
					</div>
				)}

				{currentData && (
					<Alert className="mb-4">
						<CheckCircle className="h-4 w-4" />
						<AlertDescription>
							HAMLET data loaded for sample:{" "}
							<span className="font-medium">
								{currentData.metadata.sample_name}
							</span>
						</AlertDescription>
					</Alert>
				)}

				{validationErrors.length > 0 && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							<div className="space-y-1">
								<p className="font-medium">Validation errors:</p>
								<ul className="list-disc list-inside space-y-1">
									{validationErrors.map((error, index) => (
										<li key={index} className="text-sm">
											{error}
										</li>
									))}
								</ul>
							</div>
						</AlertDescription>
					</Alert>
				)}
			</CardContent>
		</Card>
	);
}
