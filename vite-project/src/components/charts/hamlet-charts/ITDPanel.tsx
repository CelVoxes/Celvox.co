import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ITDGenomeView } from "./ITDGenomeView";

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

interface ITDPanelProps {
	flt3: ITDData;
	kmt2a: ITDData;
	sampleName: string;
}

export function ITDPanel({ flt3, kmt2a, sampleName }: ITDPanelProps) {
	const hasFLT3 = flt3.table.length > 0;
	const hasKMT2A = kmt2a.table.length > 0;

	const renderITDTable = (geneName: string, itdData: ITDData) => {
		if (itdData.table.length === 0) {
			return (
				<div className="text-center py-8 text-gray-500">
					No {geneName} ITDs detected in this sample
				</div>
			);
		}

		return (
			<div className="space-y-4">
				<div className="text-sm text-gray-600">
					<strong>Analysis Path:</strong> {itdData.path}
				</div>
				<div className="max-h-96 overflow-y-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Boundary Type</TableHead>
								<TableHead className="text-right">Fuzziness</TableHead>
								<TableHead className="text-right">Start Position</TableHead>
								<TableHead className="text-right">End Position</TableHead>
								<TableHead className="text-right">Start Count</TableHead>
								<TableHead className="text-right">End Count</TableHead>
								<TableHead>TD Starts</TableHead>
								<TableHead>TD Ends</TableHead>
								<TableHead>Confidence</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{itdData.table.map((event, index) => {
								// Calculate confidence based on counts and fuzziness
								const totalCount =
									event.rose_start_count + event.rose_end_count;
								const confidence = Math.max(
									0,
									Math.min(1, (totalCount - event.fuzziness) / 10)
								);

								return (
									<TableRow key={index}>
										<TableCell>
											<Badge variant="outline">{event.boundary_type}</Badge>
										</TableCell>
										<TableCell className="text-right font-mono">
											{event.fuzziness}
										</TableCell>
										<TableCell className="text-right font-mono">
											{event.rose_start_pos.toLocaleString()}
										</TableCell>
										<TableCell className="text-right font-mono">
											{event.rose_end_pos.toLocaleString()}
										</TableCell>
										<TableCell className="text-right font-mono">
											{event.rose_start_count}
										</TableCell>
										<TableCell className="text-right font-mono">
											{event.rose_end_count}
										</TableCell>
										<TableCell className="text-sm font-mono max-w-xs truncate">
											{event.td_starts.join(", ")}
										</TableCell>
										<TableCell className="text-sm font-mono max-w-xs truncate">
											{event.td_ends.join(", ")}
										</TableCell>
										<TableCell>
											<Badge
												variant={
													confidence > 0.8
														? "default"
														: confidence > 0.5
														? "secondary"
														: "outline"
												}
											>
												{(confidence * 100).toFixed(0)}%
											</Badge>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</div>
		);
	};

	const getITDSummary = () => {
		const flt3Count = flt3.table.length;
		const kmt2aCount = kmt2a.table.length;
		const totalITDs = flt3Count + kmt2aCount;

		return { flt3Count, kmt2aCount, totalITDs };
	};

	const summary = getITDSummary();

	return (
		<div className="space-y-6">
			{/* Summary Statistics */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-blue-600">
								{summary.totalITDs}
							</p>
							<p className="text-sm text-gray-600">Total ITDs Detected</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-red-600">
								{summary.flt3Count}
							</p>
							<p className="text-sm text-gray-600">FLT3 ITDs</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-green-600">
								{summary.kmt2aCount}
							</p>
							<p className="text-sm text-gray-600">KMT2A ITDs</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* ITD Analysis Tabs */}
			<Tabs defaultValue="genome" className="space-y-4">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="genome">🧬 Genome View</TabsTrigger>
					<TabsTrigger value="table">📋 Detailed Table</TabsTrigger>
				</TabsList>

				<TabsContent value="genome">
					<ITDGenomeView flt3={flt3} kmt2a={kmt2a} />
				</TabsContent>

				<TabsContent value="table">
					<Card>
						<CardHeader>
							<CardTitle>Internal Tandem Duplication Analysis</CardTitle>
							<p className="text-sm text-gray-600">Sample: {sampleName}</p>
						</CardHeader>
						<CardContent>
							{summary.totalITDs === 0 ? (
								<div className="text-center py-8 text-gray-500">
									<p className="text-lg">No ITDs detected in this sample</p>
									<p className="text-sm mt-2">
										Internal tandem duplications are genetic alterations
										commonly associated with AML
									</p>
								</div>
							) : (
								<Tabs
									defaultValue={hasFLT3 ? "flt3" : hasKMT2A ? "kmt2a" : "flt3"}
									className="space-y-4"
								>
									<TabsList>
										{hasFLT3 && (
											<TabsTrigger value="flt3">
												FLT3 ITDs ({summary.flt3Count})
											</TabsTrigger>
										)}
										{hasKMT2A && (
											<TabsTrigger value="kmt2a">
												KMT2A ITDs ({summary.kmt2aCount})
											</TabsTrigger>
										)}
									</TabsList>

									{hasFLT3 && (
										<TabsContent value="flt3">
											<div className="space-y-4">
												<div className="bg-red-50 border border-red-200 rounded-lg p-4">
													<h3 className="font-semibold text-red-800">
														FLT3 ITDs
													</h3>
													<p className="text-sm text-red-700 mt-1">
														FLT3 internal tandem duplications are among the most
														common genetic alterations in AML, often associated
														with poor prognosis and targeted therapy
														opportunities.
													</p>
												</div>
												{renderITDTable("FLT3", flt3)}
											</div>
										</TabsContent>
									)}

									{hasKMT2A && (
										<TabsContent value="kmt2a">
											<div className="space-y-4">
												<div className="bg-green-50 border border-green-200 rounded-lg p-4">
													<h3 className="font-semibold text-green-800">
														KMT2A ITDs
													</h3>
													<p className="text-sm text-green-700 mt-1">
														KMT2A (MLL) rearrangements and ITDs are associated
														with aggressive forms of leukemia, particularly in
														pediatric and therapy-related cases.
													</p>
												</div>
												{renderITDTable("KMT2A", kmt2a)}
											</div>
										</TabsContent>
									)}
								</Tabs>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
