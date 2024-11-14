import { useState, useEffect, useMemo } from "react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectTrigger,
	SelectValue,
	SelectItem,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { fetchKNNDEG, fetchSampleDataNames } from "@/utils/api";
import {
	Chart as ChartJS,
	LinearScale,
	PointElement,
	LineElement,
	Tooltip,
	Legend,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import zoomPlugin from "chartjs-plugin-zoom";
import { ScrollArea } from "../ui/scroll-area";
// import { ScrollArea } from "../ui/scroll-area";

interface DEGResult {
	_row: string;
	logFC: number;
	logFDR: number;
	AveExpr: number;
	t: number;
	"P.Value": number;
	"adj.P.Val": number;
	B: number;
}

type VolcanoPoint = {
	_row: string;
	logFC: number;
	logFDR: number;
	direction: "up" | "down" | "ns";
};

// Register ChartJS components
ChartJS.register(
	LinearScale,
	PointElement,
	LineElement,
	Tooltip,
	Legend,
	zoomPlugin
);

interface SortConfig {
	key: keyof DEGResult;
	direction: "asc" | "desc";
}

export function KNNReportExpression() {
	const [kValue, setKValue] = useState(20);
	const [selectedSample, setSelectedSample] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [degResults, setDegResults] = useState<DEGResult[] | null>(null);
	const [samples, setSamples] = useState<string[]>([]);
	const [sortConfig, setSortConfig] = useState<SortConfig>({
		key: "logFDR",
		direction: "desc",
	});

	useEffect(() => {
		fetchSampleDataNames().then(setSamples).catch(console.error);
	}, []);

	const volcanoData = useMemo(() => {
		if (!degResults)
			return {
				maxNegLogP: 0,
				maxOrMinLogFC: 4,
				up: [],
				down: [],
			};

		// Only process significant genes (adj.P.Val < 0.05)
		const significantPoints: VolcanoPoint[] = degResults
			.filter((item) => item["adj.P.Val"] < 0.05)
			.map((item) => ({
				_row: item._row,
				logFC: item.logFC,
				logFDR: item.logFDR,
				direction: item.logFC > 0 ? "up" : ("down" as "up" | "down"),
			}));

		const { maxNegLogP, maxOrMinLogFC } = significantPoints.reduce(
			(acc, p) => ({
				maxNegLogP: Math.max(acc.maxNegLogP, p.logFDR),
				maxOrMinLogFC: Math.max(acc.maxOrMinLogFC, Math.abs(p.logFC)),
			}),
			{ maxNegLogP: 0, maxOrMinLogFC: 0 }
		);

		console.log(significantPoints);

		return {
			maxNegLogP: Math.ceil(maxNegLogP),
			maxOrMinLogFC: Math.ceil(maxOrMinLogFC),
			up: significantPoints.filter((p) => p.direction === "up"),
			down: significantPoints.filter((p) => p.direction === "down"),
		};
	}, [degResults]);

	const handleRunAnalysis = async () => {
		setIsLoading(true);
		setError(null);
		try {
			if (!selectedSample) {
				throw new Error("Please select a sample");
			}

			const apiResponse = await fetchKNNDEG(kValue, selectedSample);
			console.log("API Response:", apiResponse);
			setDegResults(apiResponse);
		} catch (error) {
			console.error(
				"Failed to perform differential expression analysis:",
				error
			);
			setError("Failed to analyze gene expression data. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleSort = (key: keyof DEGResult) => {
		setSortConfig((current) => ({
			key,
			direction:
				current.key === key && current.direction === "desc" ? "asc" : "desc",
		}));
	};

	const sortedResults = useMemo(() => {
		if (!degResults) return [];

		return [...degResults].sort((a, b) => {
			if (sortConfig.direction === "asc") {
				return a[sortConfig.key] > b[sortConfig.key] ? 1 : -1;
			}
			return a[sortConfig.key] < b[sortConfig.key] ? 1 : -1;
		});
	}, [degResults, sortConfig]);

	return (
		<Card className="w-full">
			<CardHeader className="p-4 sm:p-6">
				<CardTitle>KNN Differential Expression Analysis</CardTitle>
				<CardDescription>
					Analyzes differential gene expression between your sample and its
					K-nearest neighbors, identifying genes that are significantly up or
					down-regulated compared to the reference database.
				</CardDescription>
			</CardHeader>
			<CardContent className="p-4 sm:p-6">
				<div className="flex flex-col space-y-4 mb-6">
					<div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
						<span className="w-24">K Value:</span>
						<div className="flex-1 flex items-center space-x-4">
							<Slider
								value={[kValue]}
								onValueChange={(value) => setKValue(value[0])}
								min={1}
								max={50}
								step={1}
								className="w-full"
							/>
							<span>{kValue}</span>
						</div>
					</div>
					<div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
						<span className="w-24">Sample:</span>
						<Select
							onValueChange={setSelectedSample}
							value={selectedSample || undefined}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select a sample" />
							</SelectTrigger>
							<SelectContent>
								{samples.map((sample) => (
									<SelectItem key={sample} value={sample}>
										{sample}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex justify-center">
						<Button
							onClick={handleRunAnalysis}
							disabled={isLoading}
							className="w-[200px]"
						>
							{isLoading ? "Analyzing..." : "Run Analysis"}
						</Button>
					</div>
				</div>

				{error && <p className="text-red-500 mb-4">{error}</p>}

				{degResults && (
					<>
						{/* Summary Stats */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
							<Card>
								<CardHeader>
									<CardTitle>Total Genes</CardTitle>
									<CardDescription>{degResults.length}</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>Significant Genes</CardTitle>
									<CardDescription>
										{degResults.filter((r) => r["adj.P.Val"] < 0.05).length}
									</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>Up-regulated</CardTitle>
									<CardDescription>
										{
											degResults.filter(
												(r) => r["adj.P.Val"] < 0.05 && r.logFC > 0
											).length
										}
									</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>Down-regulated</CardTitle>
									<CardDescription>
										{
											degResults.filter(
												(r) => r["adj.P.Val"] < 0.05 && r.logFC < 0
											).length
										}
									</CardDescription>
								</CardHeader>
							</Card>
						</div>

						{/* DEG Results Table */}
						<Card className="mb-6">
							<CardHeader>
								<CardTitle>Top Differential Genes</CardTitle>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-[400px] w-full">
									<div className="relative w-full min-w-[600px]">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead
														onClick={() => handleSort("_row")}
														className="cursor-pointer hover:bg-gray-100 w-[25%] sticky top-0 bg-white"
													>
														<div className="flex items-center justify-between">
															<span>Gene</span>
															{sortConfig.key === "_row" && (
																<span>
																	{sortConfig.direction === "desc" ? "↓" : "↑"}
																</span>
															)}
														</div>
													</TableHead>
													<TableHead
														onClick={() => handleSort("logFC")}
														className="cursor-pointer hover:bg-gray-100 w-[25%] sticky top-0 bg-white"
													>
														<div className="flex items-center justify-between">
															<span>Log2 FC</span>
															{sortConfig.key === "logFC" && (
																<span>
																	{sortConfig.direction === "desc" ? "↓" : "↑"}
																</span>
															)}
														</div>
													</TableHead>
													<TableHead
														onClick={() => handleSort("AveExpr")}
														className="cursor-pointer hover:bg-gray-100 w-[25%] sticky top-0 bg-white"
													>
														<div className="flex items-center justify-between">
															<span>Avg Expression</span>
															{sortConfig.key === "AveExpr" && (
																<span>
																	{sortConfig.direction === "desc" ? "↓" : "↑"}
																</span>
															)}
														</div>
													</TableHead>
													<TableHead
														onClick={() => handleSort("logFDR")}
														className="cursor-pointer hover:bg-gray-100 w-[25%] sticky top-0 bg-white"
													>
														<div className="flex items-center justify-between">
															<span>-log10(FDR)</span>
															{sortConfig.key === "logFDR" && (
																<span>
																	{sortConfig.direction === "desc" ? "↓" : "↑"}
																</span>
															)}
														</div>
													</TableHead>
												</TableRow>
											</TableHeader>

											<TableBody>
												{sortedResults.slice(0, 100).map((result) => (
													<TableRow
														key={result._row}
														className={
															result.logFDR > -Math.log10(0.05)
																? result.logFC > 0
																	? "bg-red-50"
																	: "bg-blue-50"
																: ""
														}
													>
														<TableCell className="w-[25%]">
															{result._row}
														</TableCell>
														<TableCell className="w-[25%]">
															{result.logFC.toFixed(2)}
														</TableCell>
														<TableCell className="w-[25%]">
															{result.AveExpr.toFixed(2)}
														</TableCell>
														<TableCell className="w-[25%]">
															{result.logFDR.toFixed(2)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</ScrollArea>
							</CardContent>
						</Card>

						{degResults && (
							<Card className="mb-6">
								<CardHeader>
									<CardTitle>Volcano Plot</CardTitle>
									<CardDescription>
										Log2 fold change vs -log10(adjusted p-value). Red points
										indicate significantly up-regulated genes, blue points
										indicate significantly down-regulated genes.
									</CardDescription>
								</CardHeader>
								<CardContent className="h-[400px] sm:h-[500px]">
									<Scatter
										options={{
											responsive: true,
											maintainAspectRatio: false,
											animation: {
												duration: 0,
											},
											parsing: false,
											normalized: true,
											scales: {
												x: {
													title: {
														display: true,
														text: "Log2 Fold Change",
													},
													min: -volcanoData.maxOrMinLogFC,
													max: volcanoData.maxOrMinLogFC,
												},
												y: {
													title: {
														display: true,
														text: "-log10(FDR)",
													},
													min: 0,
													max: volcanoData.maxNegLogP,
												},
											},
											plugins: {
												zoom: {
													pan: {
														enabled: true,
														mode: "xy",
														threshold: 2,
													},
													zoom: {
														wheel: {
															enabled: true,
															speed: 0.1,
														},
														pinch: {
															enabled: true,
														},
														mode: "xy",
													},
												},
												tooltip: {
													enabled: true,
													intersect: false,
													mode: "nearest",
													callbacks: {
														label: (context) => {
															const point = context.raw as {
																x: number;
																y: number;
																gene: string;
															};
															return [
																`Gene: ${point.gene}`,
																`Log2 FC: ${point.x.toFixed(2)}`,
																`-log10(FDR): ${point.y.toFixed(2)}`,
															];
														},
													},
												},
												legend: {
													display: true,
												},
											},
											elements: {
												point: {
													radius: 3,
													hoverRadius: 4,
												},
											},
											hover: {
												intersect: false,
												mode: "nearest",
											},
										}}
										data={{
											datasets: [
												{
													label: "Up-regulated",
													data: volcanoData.up.map((p) => ({
														x: p.logFC,
														y: p.logFDR,
														gene: p._row,
													})),
													backgroundColor: "rgba(255, 0, 0, 0.7)",
												},
												{
													label: "Down-regulated",
													data: volcanoData.down.map((p) => ({
														x: p.logFC,
														y: p.logFDR,
														gene: p._row,
													})),
													backgroundColor: "rgba(0, 0, 255, 0.7)",
												},
											],
										}}
									/>
								</CardContent>
							</Card>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default KNNReportExpression;
