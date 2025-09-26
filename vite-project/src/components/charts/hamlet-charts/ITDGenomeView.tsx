import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ITDEvent {
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
}

interface ITDData {
	path: string;
	table: ITDEvent[];
}

interface ITDGenomeViewProps {
	flt3: ITDData;
	kmt2a: ITDData;
}

// Chromosome lengths (approximate, in base pairs)
const CHROMOSOME_LENGTHS: Record<string, number> = {
	"1": 248956422,
	"2": 242193529,
	"3": 198295559,
	"4": 190214555,
	"5": 181538259,
	"6": 170805979,
	"7": 159345973,
	"8": 145138636,
	"9": 138394717,
	"10": 133797422,
	"11": 135086622,
	"12": 133275309,
	"13": 114364328,
	"14": 107043718,
	"15": 101991189,
	"16": 90338345,
	"17": 83257441,
	"18": 80373285,
	"19": 58617616,
	"20": 64444167,
	"21": 46709983,
	"22": 50818468,
	X: 156040895,
	Y: 57227415,
};

// Known gene locations (approximate)
const GENE_LOCATIONS: Record<
	string,
	{ chr: string; start: number; end: number }
> = {
	FLT3: { chr: "13", start: 28577411, end: 28674729 },
	KMT2A: { chr: "11", start: 118436945, end: 118552255 },
};

export function ITDGenomeView({ flt3, kmt2a }: ITDGenomeViewProps) {
	// Collect all ITD events with gene information
	const allITDs = [
		...flt3.table.map((itd) => ({ ...itd, gene: "FLT3" as const })),
		...kmt2a.table.map((itd) => ({ ...itd, gene: "KMT2A" as const })),
	];

	// Group ITDs by chromosome
	const itdByChromosome: Record<
		string,
		Array<ITDEvent & { gene: "FLT3" | "KMT2A" }>
	> = {};

	allITDs.forEach((itd) => {
		const geneLocation = GENE_LOCATIONS[itd.gene];
		if (geneLocation) {
			const chr = geneLocation.chr;
			if (!itdByChromosome[chr]) {
				itdByChromosome[chr] = [];
			}
			itdByChromosome[chr].push(itd);
		}
	});

	const renderChromosome = (
		chr: string,
		itds: Array<ITDEvent & { gene: "FLT3" | "KMT2A" }>
	) => {
		const chrLength = CHROMOSOME_LENGTHS[chr];
		if (!chrLength) return null;

		const scale = 600 / chrLength; // Scale to fit in 600px width

		return (
			<div key={chr} className="mb-6">
				<div className="flex items-center gap-2 mb-2">
					<h4 className="font-semibold text-sm">Chromosome {chr}</h4>
					<Badge variant="outline" className="text-xs">
						{chrLength.toLocaleString()} bp
					</Badge>
				</div>

				{/* Chromosome bar */}
				<div className="relative">
					{/* Centromere (approximate position) */}
					<div
						className="h-4 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 rounded-full relative"
						style={{ width: "600px" }}
					>
						{/* Centromere constriction */}
						<div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-4 bg-blue-400 rounded-sm"></div>
					</div>

					{/* Gene locations */}
					{Object.entries(GENE_LOCATIONS).map(([gene, location]) => {
						if (location.chr === chr) {
							const position = ((location.start + location.end) / 2) * scale;
							const geneColor = gene === "FLT3" ? "bg-red-500" : "bg-green-500";

							return (
								<div
									key={gene}
									className={`absolute -top-2 w-2 h-6 ${geneColor} rounded-sm shadow-sm`}
									style={{ left: `${position}px` }}
									title={`${gene} gene location`}
								>
									<div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700 whitespace-nowrap">
										{gene}
									</div>
								</div>
							);
						}
						return null;
					})}

					{/* ITD locations */}
					{itds.map((itd, index) => {
						const position = itd.rose_start_pos * scale;
						const isFLT3 = itd.gene === "FLT3";
						const isFuzzy = itd.boundary_type === "fuzzy";

						return (
							<div
								key={`${itd.gene}-${index}`}
								className={`absolute -top-1 w-3 h-3 ${
									isFLT3 ? "bg-red-600" : "bg-green-600"
								} ${
									isFuzzy ? "rounded-md" : "rounded-full"
								} shadow-lg border-2 border-white ${
									isFuzzy ? "border-dashed" : ""
								}`}
								style={{ left: `${Math.max(0, Math.min(597, position))}px` }}
								title={`${itd.gene} ITD Details:
• Boundary Type: ${itd.boundary_type}
• Fuzziness: ${itd.fuzziness}
• Start Position: ${itd.rose_start_pos.toLocaleString()} bp
• End Position: ${itd.rose_end_pos.toLocaleString()} bp
• Start Count: ${itd.rose_start_count}
• End Count: ${itd.rose_end_count}
• TD Starts: ${itd.td_starts.join(", ")}
• TD Ends: ${itd.td_ends.join(", ")}
• Confidence: ${(
									Math.max(
										0,
										Math.min(
											1,
											(itd.rose_start_count +
												itd.rose_end_count -
												itd.fuzziness) /
												10
										)
									) * 100
								).toFixed(1)}%`}
							>
								{/* Pulsing animation for recent ITDs */}
								<div
									className={`absolute inset-0 ${
										isFLT3 ? "bg-red-400" : "bg-green-400"
									} rounded-full animate-ping opacity-20`}
								></div>
							</div>
						);
					})}
				</div>

				{/* Legend */}
				<div className="mt-3 text-xs text-gray-600">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 bg-red-500 rounded-full"></div>
							<span>FLT3 ITD (exact)</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 bg-green-500 rounded-full"></div>
							<span>KMT2A ITD (exact)</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 bg-red-500 rounded-md border border-dashed border-white"></div>
							<span>FLT3 ITD (fuzzy)</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 bg-green-500 rounded-md border border-dashed border-white"></div>
							<span>KMT2A ITD (fuzzy)</span>
						</div>
					</div>
					<div className="flex items-center gap-1 mt-2">
						<div className="w-2 h-4 bg-blue-300 rounded-sm"></div>
						<span>Gene location</span>
					</div>
				</div>
			</div>
		);
	};

	const chromosomesWithITDs = Object.keys(itdByChromosome).sort((a, b) => {
		// Sort chromosomes numerically, with X and Y at the end
		const aNum = parseInt(a);
		const bNum = parseInt(b);
		if (isNaN(aNum) && isNaN(bNum)) return a.localeCompare(b);
		if (isNaN(aNum)) return 1;
		if (isNaN(bNum)) return -1;
		return aNum - bNum;
	});

	return (
		<div className="space-y-6">
			{/* Summary */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-blue-600">
								{allITDs.length}
							</p>
							<p className="text-sm text-gray-600">Total ITDs Detected</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-red-600">
								{flt3.table.length}
							</p>
							<p className="text-sm text-gray-600">FLT3 ITDs</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-green-600">
								{kmt2a.table.length}
							</p>
							<p className="text-sm text-gray-600">KMT2A ITDs</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Genome Visualization */}
			<Card>
				<CardHeader>
					<CardTitle>ITD Locations on Genome</CardTitle>
					<p className="text-sm text-gray-600">
						Visualization of Internal Tandem Duplication positions relative to
						gene locations
					</p>
				</CardHeader>
				<CardContent>
					{chromosomesWithITDs.length > 0 ? (
						<div className="space-y-6">
							{chromosomesWithITDs.map((chr) =>
								renderChromosome(chr, itdByChromosome[chr])
							)}
						</div>
					) : (
						<div className="text-center py-8 text-gray-500">
							<p>No ITD locations to visualize</p>
							<p className="text-sm mt-2">
								ITDs must be associated with known gene locations to appear on
								the genome view
							</p>
						</div>
					)}

					{/* Additional Info */}
					<div className="mt-6 p-4 bg-gray-50 rounded-lg">
						<h4 className="font-medium text-sm mb-2">
							Understanding the Genome View:
						</h4>
						<ul className="text-xs text-gray-600 space-y-1">
							<li>
								• <strong>Blue bars</strong> represent chromosomes with
								approximate centromere positions
							</li>
							<li>
								• <strong>Colored markers</strong> show gene locations (FLT3 =
								red, KMT2A = green)
							</li>
							<li>
								• <strong>Circular dots</strong> = exact boundary ITDs,{" "}
								<strong>Square dots</strong> = fuzzy boundary ITDs
							</li>
							<li>
								• <strong>Hover over ITDs</strong> for complete details:
								boundary type, fuzziness, positions, counts, and confidence
							</li>
							<li>
								• <strong>Fuzzy boundaries</strong> indicate regions of
								uncertainty in ITD breakpoint determination
							</li>
						</ul>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
