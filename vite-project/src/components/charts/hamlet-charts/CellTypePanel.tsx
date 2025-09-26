import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chart } from "chart.js/auto";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CellTypeData {
	[cellType: string]: number;
}

interface CellTypePanelProps {
	data: {
		[key: string]: CellTypeData;
	};
	plot?: string;
}

export function CellTypePanel({ data, plot }: CellTypePanelProps) {
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const chartInstance = useRef<Chart | null>(null);

	// Get the first (and typically only) sample's cell type data
	const sampleKeys = Object.keys(data);
	const cellTypeData = sampleKeys.length > 0 ? data[sampleKeys[0]] : {};

	// Prepare data for chart
	const cellTypes = Object.keys(cellTypeData);
	const proportions = Object.values(cellTypeData);

	// Sort by proportion (descending)
	const sortedData = cellTypes
		.map((type, index) => ({ type, proportion: proportions[index] }))
		.sort((a, b) => b.proportion - a.proportion);

	useEffect(() => {
		if (chartRef.current && sortedData.length > 0) {
			// Destroy existing chart
			if (chartInstance.current) {
				chartInstance.current.destroy();
			}

			const ctx = chartRef.current.getContext("2d");
			if (ctx) {
				// Generate colors for cell types
				const colors = [
					"#FF6384",
					"#36A2EB",
					"#FFCE56",
					"#4BC0C0",
					"#9966FF",
					"#FF9F40",
					"#FF6384",
					"#C9CBCF",
					"#4BC0C0",
					"#FF6384",
					"#36A2EB",
					"#FFCE56",
					"#4BC0C0",
					"#9966FF",
					"#FF9F40",
				];

				chartInstance.current = new Chart(ctx, {
					type: "pie",
					data: {
						labels: sortedData.map((d) => d.type),
						datasets: [
							{
								data: sortedData.map((d) => d.proportion),
								backgroundColor: colors.slice(0, sortedData.length),
								borderColor: colors
									.slice(0, sortedData.length)
									.map((color) =>
										color.replace(")", ", 0.8)").replace("rgb", "rgba")
									),
								borderWidth: 2,
							},
						],
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: {
								position: "right",
								labels: {
									boxWidth: 12,
									font: {
										size: 11,
									},
								},
							},
							tooltip: {
								callbacks: {
									label: function (context) {
										const label = context.label || "";
										const value = context.parsed;
										return `${label}: ${(value * 100).toFixed(1)}%`;
									},
								},
							},
						},
					},
				}) as Chart;
			}
		}

		return () => {
			if (chartInstance.current) {
				chartInstance.current.destroy();
			}
		};
	}, [sortedData]);

	const totalProportion = sortedData.reduce(
		(sum, item) => sum + item.proportion,
		0
	);

	return (
		<div className="space-y-6">
			{/* Summary Statistics */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-blue-600">
								{cellTypes.length}
							</p>
							<p className="text-sm text-gray-600">Cell Types Detected</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-green-600">
								{sortedData[0]?.type || "N/A"}
							</p>
							<p className="text-sm text-gray-600">Most Abundant</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="text-center">
							<p className="text-2xl font-bold text-purple-600">
								{sortedData[0]
									? (sortedData[0].proportion * 100).toFixed(1) + "%"
									: "N/A"}
							</p>
							<p className="text-sm text-gray-600">Highest Proportion</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Chart and Table */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Pie Chart */}
				<Card>
					<CardHeader>
						<CardTitle>Cell Type Composition</CardTitle>
					</CardHeader>
					<CardContent>
						{sortedData.length > 0 ? (
							<div className="h-80">
								<canvas ref={chartRef} />
							</div>
						) : (
							<div className="h-80 flex items-center justify-center text-gray-500">
								No cell type data available
							</div>
						)}
					</CardContent>
				</Card>

				{/* Data Table */}
				<Card>
					<CardHeader>
						<CardTitle>Cell Type Proportions</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="max-h-80 overflow-y-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Cell Type</TableHead>
										<TableHead className="text-right">Proportion</TableHead>
										<TableHead className="text-right">Percentage</TableHead>
										<TableHead>Abundance</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{sortedData.map((item, index) => {
										const percentage =
											(item.proportion / totalProportion) * 100;
										return (
											<TableRow key={item.type}>
												<TableCell className="font-medium">
													{item.type}
												</TableCell>
												<TableCell className="text-right font-mono">
													{item.proportion.toFixed(4)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{percentage.toFixed(1)}%
												</TableCell>
												<TableCell>
													<Badge
														variant={
															index === 0
																? "default"
																: percentage > 20
																? "secondary"
																: "outline"
														}
													>
														{index === 0
															? "Highest"
															: percentage > 20
															? "Major"
															: percentage > 5
															? "Moderate"
															: "Minor"}
													</Badge>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Plot Image (if available) */}
			{plot && (
				<Card>
					<CardHeader>
						<CardTitle>Cell Type Visualization</CardTitle>
					</CardHeader>
					<CardContent>
						<img
							src={plot}
							alt="Cell type composition plot"
							className="w-full max-w-md mx-auto"
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
