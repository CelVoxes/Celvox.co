import { useState, useEffect, useRef, useMemo } from "react";
import { fetchGeneExpressionData } from "../../utils/api";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import Chart from "chart.js/auto";
import { scaleLinear } from "d3-scale";
import { interpolateViridis } from "d3-scale-chromatic";
import zoomPlugin from "chartjs-plugin-zoom";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FixedSizeList as List } from "react-window";

Chart.register(zoomPlugin);

interface GeneExpressionData {
	sample_id: string;
	expression: number;
	X1: number;
	X2: number;
}

export function GeneExpressionTSNE() {
	const [geneExpressionData, setGeneExpressionData] = useState<
		GeneExpressionData[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const chartInstance = useRef<Chart | null>(null);
	const [selectedGene, setSelectedGene] = useState("NPM1");
	const [availableGenes, setAvailableGenes] = useState<string[]>([]);
	const [geneSearch, setGeneSearch] = useState("");
	const [isSelectOpen, setIsSelectOpen] = useState(false);

	const handleGeneSelection = (value: string) => {
		setSelectedGene(value);
		handleFetchData(value);
	};

	const handleFetchData = async (gene: string = selectedGene) => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetchGeneExpressionData(gene);
			if (response.error) {
				throw new Error(response.error);
			}

			setAvailableGenes(response.available_genes);

			const geneExpression = response.expression.map(
				(item: GeneExpressionData) => ({
					sample_id: item.sample_id,
					expression: item[gene as keyof GeneExpressionData],
					X1: item.X1,
					X2: item.X2,
				})
			);
			setGeneExpressionData(geneExpression);
			setSelectedGene(gene); // Ensure the selected gene is updated
		} catch (error) {
			console.error("Failed to load data:", error);
			setError(
				error instanceof Error
					? error.message
					: "Failed to load data. Please try again."
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (geneExpressionData.length > 0 && chartRef.current && !isLoading) {
			const ctx = chartRef.current.getContext("2d");

			const expressionValues = geneExpressionData.map(
				(item) => item.expression
			);
			const minValue = Math.min(...expressionValues);
			const maxValue = Math.max(...expressionValues);

			const colorScale = scaleLinear()
				.domain([minValue, maxValue])
				.range([0, 1]);

			if (chartInstance.current) {
				chartInstance.current.destroy();
			}

			chartInstance.current = new Chart(ctx as CanvasRenderingContext2D, {
				type: "scatter",
				data: {
					datasets: [
						{
							label: `Expression of ${selectedGene}`,
							data: geneExpressionData.map((item) => ({
								x: item.X1,
								y: item.X2,
								sample: item.sample_id,
								expression: item.expression,
							})),
							backgroundColor: geneExpressionData.map((item) =>
								interpolateViridis(colorScale(item.expression))
							),
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: "right",
							align: "start",
							labels: {
								generateLabels: () => {
									const values = geneExpressionData.map(
										(item) => item.expression
									);
									const min = Math.min(...values);
									const max = Math.max(...values);
									return [
										{
											text: `${min.toFixed(2)}`,
											fillStyle: interpolateViridis(0),
										},
										{ text: "", fillStyle: interpolateViridis(0.25) },
										{ text: "", fillStyle: interpolateViridis(0.5) },
										{ text: "", fillStyle: interpolateViridis(0.75) },
										{
											text: `${max.toFixed(2)}`,
											fillStyle: interpolateViridis(1),
										},
									];
								},
								usePointStyle: true,
								pointStyle: "rect",
								boxWidth: 30,
								boxHeight: 15,
							},
						},
						tooltip: {
							callbacks: {
								label: (context) => {
									const point = context.raw;
									return [
										`Sample: ${(point as { sample: string }).sample}`,
										`Expression: ${(
											point as { expression: number }
										).expression.toFixed(2)}`,
									];
								},
							},
						},
						zoom: {
							zoom: {
								wheel: { enabled: true },
								pinch: { enabled: true },
								mode: "xy",
							},
							pan: { enabled: true, mode: "xy" },
						},
					},
					scales: {
						x: {
							type: "linear",
							position: "bottom",
							title: { display: true, text: "t-SNE 1" },
							grid: { display: false },
						},
						y: {
							type: "linear",
							position: "left",
							title: { display: true, text: "t-SNE 2" },
							grid: { display: false },
						},
					},
				},
			});
		}
	}, [geneExpressionData, selectedGene, isLoading]);

	const filteredGenes = useMemo(() => {
		return availableGenes.filter((gene) =>
			gene.toLowerCase().includes(geneSearch.toLowerCase())
		);
	}, [availableGenes, geneSearch]);

	const VirtualizedSelectContent = () => (
		<List
			height={300}
			itemCount={filteredGenes.length}
			itemSize={35}
			width="100%"
		>
			{({ index, style }: { index: number; style: React.CSSProperties }) => (
				<SelectItem
					key={filteredGenes[index]}
					value={filteredGenes[index]}
					style={style}
				>
					{filteredGenes[index]}
				</SelectItem>
			)}
		</List>
	);

	return (
		<Card className="w-full h-full">
			<CardHeader>
				<CardTitle>Gene Expression t-SNE Visualization</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col h-[calc(100%-4rem)]">
				{error && <p className="text-red-500 mt-2">{error}</p>}
				<div className="flex-grow relative">
					<div className="h-[500px]">
						{geneExpressionData.length > 0 ? (
							<canvas ref={chartRef} className="w-full h-full"></canvas>
						) : (
							<div className="w-full h-full flex items-center justify-center text-gray-500">
								<p>Click "Fetch Data" to generate the plot</p>
							</div>
						)}
					</div>
				</div>
				<div className="flex items-center space-x-2">
					<div className="flex-grow">
						<Input
							type="text"
							placeholder="Search genes..."
							value={geneSearch}
							onChange={(e) => setGeneSearch(e.target.value)}
						/>
					</div>
					<div className="w-64">
						<Select
							onValueChange={handleGeneSelection}
							value={selectedGene}
							onOpenChange={(open) => setIsSelectOpen(open)}
							disabled={isLoading}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a gene">
									{selectedGene}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{isSelectOpen && <VirtualizedSelectContent />}
							</SelectContent>
						</Select>
					</div>
					<Button onClick={() => handleFetchData()} disabled={isLoading}>
						{isLoading ? "Loading..." : "Fetch Data"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
