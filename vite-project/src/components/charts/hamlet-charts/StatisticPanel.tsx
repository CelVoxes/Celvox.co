import { Card } from "@/components/ui/card";

interface StatisticPanelProps {
	data: {
		modules: {
			snv_indels: {
				stats: {
					aln: {
						num_aligned_reads: number;
						pct_aligned_reads_from_total: number;
						pct_aligned_reads_proper_pairs: number;
						strand_balance: number;
						num_total_reads: number;
						num_total_bases: number;
						num_aligned_bases: number;
					};
					rna: {
						pct_coding_bases: number;
						pct_mrna_bases: number;
						pct_utr_bases: number;
						pct_intronic_bases: number;
						pct_intergenic_bases: number;
						pct_ribosomal_bases: number;
						median_cv_coverage: number;
					};
					ins: {
						median_insert_size: number;
						median_absolute_deviation: number;
						max_insert_size: number;
						min_insert_size: number;
					};
					var: {
						num_snvs: number;
						num_deletions: number;
						num_insertions: number;
					};
				};
			};
		};
	};
}

export function StatisticPanel({ data }: StatisticPanelProps) {
	const stats = data.modules.snv_indels.stats;

	return (
		<div className="space-y-6">
			{/* Alignment Count Statistics */}
			<Card className="p-4">
				<h3 className="font-bold mb-4">Alignment Count Statistics</h3>
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="text-left border-b">
								<th className="pb-2">Metric</th>
								<th className="pb-2">Count</th>
								<th className="pb-2">% of total</th>
								<th className="pb-2">% of aligned</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							<tr>
								<td className="py-2">Total reads</td>
								<td>{stats.aln.num_total_reads.toLocaleString()}</td>
								<td>100%</td>
								<td>-</td>
							</tr>
							<tr>
								<td className="py-2">Reads aligned</td>
								<td>{stats.aln.num_aligned_reads.toLocaleString()}</td>
								<td>
									{(stats.aln.pct_aligned_reads_from_total * 100).toFixed(2)}%
								</td>
								<td>100%</td>
							</tr>
							<tr>
								<td className="py-2">Total bases</td>
								<td>{stats.aln.num_total_bases.toLocaleString()}</td>
								<td>100%</td>
								<td>-</td>
							</tr>
							<tr>
								<td className="py-2">Bases aligned</td>
								<td>{stats.aln.num_aligned_bases.toLocaleString()}</td>
								<td>
									{(
										(stats.aln.num_aligned_bases / stats.aln.num_total_bases) *
										100
									).toFixed(2)}
									%
								</td>
								<td>100%</td>
							</tr>
						</tbody>
					</table>
				</div>
			</Card>

			{/* Base-level Annotation Statistics */}
			<Card className="p-4">
				<h3 className="font-bold mb-4">Base-level Annotation Statistics</h3>
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="text-left border-b">
								<th className="pb-2">Metric</th>
								<th className="pb-2">% of aligned</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							<tr>
								<td className="py-2">Aligned to mRNA (CDS + UTR)</td>
								<td>{(stats.rna.pct_mrna_bases * 100).toFixed(2)}%</td>
							</tr>
							<tr>
								<td className="py-2">Aligned to CDS</td>
								<td>{(stats.rna.pct_coding_bases * 100).toFixed(2)}%</td>
							</tr>
							<tr>
								<td className="py-2">Aligned to UTR</td>
								<td>{(stats.rna.pct_utr_bases * 100).toFixed(2)}%</td>
							</tr>
							<tr>
								<td className="py-2">Aligned to introns</td>
								<td>{(stats.rna.pct_intronic_bases * 100).toFixed(2)}%</td>
							</tr>
							<tr>
								<td className="py-2">Aligned to intergenic regions</td>
								<td>{(stats.rna.pct_intergenic_bases * 100).toFixed(2)}%</td>
							</tr>
							<tr>
								<td className="py-2">Aligned to rRNA</td>
								<td>{(stats.rna.pct_ribosomal_bases * 100).toFixed(2)}%</td>
							</tr>
						</tbody>
					</table>
				</div>
			</Card>

			{/* Insert Size Statistics */}
			<Card className="p-4">
				<h3 className="font-bold mb-4">Insert Size Statistics</h3>
				<div className="space-y-2">
					<div className="flex justify-between">
						<span className="text-sm">Median</span>
						<span className="font-medium">
							{stats.ins.median_insert_size.toFixed(0)}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-sm">Median Absolute Deviation</span>
						<span className="font-medium">
							{stats.ins.median_absolute_deviation.toFixed(0)}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-sm">Maximum</span>
						<span className="font-medium">
							{stats.ins.max_insert_size.toLocaleString()}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-sm">Minimum</span>
						<span className="font-medium">{stats.ins.min_insert_size}</span>
					</div>
				</div>
			</Card>
		</div>
	);
}
