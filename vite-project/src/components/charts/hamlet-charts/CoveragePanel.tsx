import { Card } from "@/components/ui/card";

interface ExonMetrics {
	median: number;
	min: number;
}

interface Exon {
	exon_num: number;
	metrics: ExonMetrics;
}

interface CoveragePanelProps {
	coverage: number[];
}

export function CoveragePanel({ coverage }: CoveragePanelProps) {
	return (
		<div className="space-y-4">
			{Object.entries(coverage).map(([gene, transcripts]) => (
				<Card key={gene} className="p-4">
					<h3 className="font-bold text-lg mb-2">{gene}</h3>
					{Object.entries(transcripts).map(([transcript, exons]) => (
						<div key={transcript} className="mt-4">
							<h4 className="font-medium text-sm text-gray-600 mb-2">
								{transcript}
							</h4>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
								{exons.map((exon: Exon, index: number) => (
									<div key={index} className="text-sm">
										<p>Exon {exon.exon_num}</p>
										<p>Median coverage: {exon.metrics.median.toFixed(1)}x</p>
										<p>Min coverage: {exon.metrics.min}x</p>
									</div>
								))}
							</div>
						</div>
					))}
				</Card>
			))}
		</div>
	);
}
