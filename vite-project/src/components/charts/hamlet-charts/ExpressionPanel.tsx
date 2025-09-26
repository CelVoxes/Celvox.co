import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface GeneExpression {
	normalized: number | null;
	raw: number;
}

interface ExpressionData {
	[key: string]: GeneExpression;
}

interface ExpressionPanelProps {
	data: ExpressionData;
	genesOfInterest: Array<{
		gene_id: string;
		gene_symbol: string;
		transcript_ids: string[];
	}>;
}

export function ExpressionPanel({
	data,
	genesOfInterest,
}: ExpressionPanelProps) {
	// Create a map of gene_id to gene_symbol for easy lookup
	const geneIdToSymbol = genesOfInterest.reduce((acc, gene) => {
		acc[gene.gene_id] = gene.gene_symbol;
		return acc;
	}, {} as Record<string, string>);

	// Transform data for display
	const expressionEntries = Object.entries(data).map(
		([geneId, expression]) => ({
			geneId,
			geneSymbol: geneIdToSymbol[geneId] || geneId,
			normalized: expression.normalized,
			raw: expression.raw,
		})
	);

	// Sort by normalized expression (descending), then by raw expression
	const sortedEntries = expressionEntries.sort((a, b) => {
		if (a.normalized !== null && b.normalized !== null) {
			return b.normalized - a.normalized;
		}
		if (a.normalized === null && b.normalized !== null) return 1;
		if (a.normalized !== null && b.normalized === null) return -1;
		return b.raw - a.raw;
	});

	// Calculate some statistics
	const validNormalized = sortedEntries
		.filter((e) => e.normalized !== null)
		.map((e) => e.normalized!);
	const avgNormalized =
		validNormalized.length > 0
			? validNormalized.reduce((a, b) => a + b, 0) / validNormalized.length
			: null;
	const maxNormalized =
		validNormalized.length > 0 ? Math.max(...validNormalized) : null;
	const minNormalized =
		validNormalized.length > 0 ? Math.min(...validNormalized) : null;

	return (
		<div className="space-y-6">
			{/* Statistics Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-blue-600">
								{sortedEntries.length}
							</p>
							<p className="text-sm text-gray-600">Total Genes</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-green-600">
								{avgNormalized !== null ? avgNormalized.toFixed(2) : "N/A"}
							</p>
							<p className="text-sm text-gray-600">Avg Normalized</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-purple-600">
								{maxNormalized !== null ? maxNormalized.toFixed(2) : "N/A"}
							</p>
							<p className="text-sm text-gray-600">Max Normalized</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-orange-600">
								{minNormalized !== null ? minNormalized.toFixed(2) : "N/A"}
							</p>
							<p className="text-sm text-gray-600">Min Normalized</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Expression Data Table */}
			<Card>
				<CardHeader>
					<CardTitle>Gene Expression Values</CardTitle>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="all" className="space-y-4">
						<TabsList>
							<TabsTrigger value="all">All Genes</TabsTrigger>
							<TabsTrigger value="expressed">Highly Expressed</TabsTrigger>
							<TabsTrigger value="low">Low Expression</TabsTrigger>
						</TabsList>

						<TabsContent value="all">
							<div className="max-h-96 overflow-y-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Gene Symbol</TableHead>
											<TableHead>Gene ID</TableHead>
											<TableHead className="text-right">Raw Count</TableHead>
											<TableHead className="text-right">Normalized</TableHead>
											<TableHead>Expression Level</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{sortedEntries.map((entry) => (
											<TableRow key={entry.geneId}>
												<TableCell className="font-medium">
													{entry.geneSymbol}
												</TableCell>
												<TableCell className="text-sm text-gray-600">
													{entry.geneId}
												</TableCell>
												<TableCell className="text-right font-mono">
													{entry.raw.toLocaleString()}
												</TableCell>
												<TableCell className="text-right font-mono">
													{entry.normalized !== null
														? entry.normalized.toFixed(3)
														: "N/A"}
												</TableCell>
												<TableCell>
													{entry.normalized !== null ? (
														<Badge
															variant={
																entry.normalized > (avgNormalized || 0) + 1
																	? "default"
																	: entry.normalized < (avgNormalized || 0) - 1
																	? "secondary"
																	: "outline"
															}
														>
															{entry.normalized > (avgNormalized || 0) + 1
																? "High"
																: entry.normalized < (avgNormalized || 0) - 1
																? "Low"
																: "Medium"}
														</Badge>
													) : (
														<Badge variant="outline">Not normalized</Badge>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</TabsContent>

						<TabsContent value="expressed">
							<div className="max-h-96 overflow-y-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Gene Symbol</TableHead>
											<TableHead>Gene ID</TableHead>
											<TableHead className="text-right">Raw Count</TableHead>
											<TableHead className="text-right">Normalized</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{sortedEntries
											.filter(
												(entry) =>
													entry.normalized !== null &&
													entry.normalized > (avgNormalized || 0)
											)
											.slice(0, 50) // Show top 50
											.map((entry) => (
												<TableRow key={entry.geneId}>
													<TableCell className="font-medium">
														{entry.geneSymbol}
													</TableCell>
													<TableCell className="text-sm text-gray-600">
														{entry.geneId}
													</TableCell>
													<TableCell className="text-right font-mono">
														{entry.raw.toLocaleString()}
													</TableCell>
													<TableCell className="text-right font-mono">
														{entry.normalized!.toFixed(3)}
													</TableCell>
												</TableRow>
											))}
									</TableBody>
								</Table>
							</div>
						</TabsContent>

						<TabsContent value="low">
							<div className="max-h-96 overflow-y-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Gene Symbol</TableHead>
											<TableHead>Gene ID</TableHead>
											<TableHead className="text-right">Raw Count</TableHead>
											<TableHead className="text-right">Normalized</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{sortedEntries
											.filter(
												(entry) =>
													entry.normalized !== null &&
													entry.normalized < (avgNormalized || 0)
											)
											.slice(-50) // Show bottom 50
											.map((entry) => (
												<TableRow key={entry.geneId}>
													<TableCell className="font-medium">
														{entry.geneSymbol}
													</TableCell>
													<TableCell className="text-sm text-gray-600">
														{entry.geneId}
													</TableCell>
													<TableCell className="text-right font-mono">
														{entry.raw.toLocaleString()}
													</TableCell>
													<TableCell className="text-right font-mono">
														{entry.normalized!.toFixed(3)}
													</TableCell>
												</TableRow>
											))}
									</TableBody>
								</Table>
							</div>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}

