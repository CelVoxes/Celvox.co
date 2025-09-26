import { Card } from "@/components/ui/card";

interface FusionData {
	gene1: string;
	gene2: string;
	type: string;
	plot?: string;
	breakpoint1?: string;
	breakpoint2?: string;
	readSupport?: number;
	confidence?: number;
	transcripts?: string[];
}

interface FusionPanelProps {
	fusions: FusionData[];
}

export function FusionPanel({ fusions }: FusionPanelProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{fusions.map((fusion, index) => (
				<Card key={index} className="p-4">
					<h3 className="font-bold text-lg">
						{fusion.gene1} - {fusion.gene2}
					</h3>
					<div className="space-y-2 mt-2">
						<p className="text-sm text-gray-600">Type: {fusion.type}</p>
						{fusion.breakpoint1 && fusion.breakpoint2 && (
							<p className="text-sm text-gray-600">
								Breakpoints: {fusion.breakpoint1} | {fusion.breakpoint2}
							</p>
						)}
						{fusion.readSupport && (
							<p className="text-sm text-gray-600">
								Read Support: {fusion.readSupport}
							</p>
						)}
						{fusion.confidence && (
							<p className="text-sm text-gray-600">
								Confidence:{" "}
								{typeof fusion.confidence === "number"
									? fusion.confidence.toFixed(2)
									: fusion.confidence}
							</p>
						)}
						{fusion.transcripts && fusion.transcripts.length > 0 && (
							<div className="text-sm text-gray-600">
								<p>Transcripts:</p>
								<ul className="list-disc list-inside pl-2">
									{fusion.transcripts.map((transcript, i) => (
										<li key={i}>{transcript}</li>
									))}
								</ul>
							</div>
						)}
						{/* {fusion.plot && (
							<img
								src={fusion.plot}
								alt={`Fusion plot for ${fusion.gene1}-${fusion.gene2}`}
								className="mt-2 w-full"
							/>
						)} */}
					</div>
				</Card>
			))}
		</div>
	);
}
