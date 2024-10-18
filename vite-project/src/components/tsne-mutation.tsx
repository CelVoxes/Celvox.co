import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import Chart, { TooltipItem } from "chart.js/auto";
import { fetchMutationTSNEData } from "@/utils/api";
import { Input } from "@/components/ui/input";
import debounce from "lodash/debounce";
import { scaleLinear } from "d3-scale";
import { interpolateRgb } from "d3-interpolate";
import zoomPlugin from "chartjs-plugin-zoom";

// Register the zoom plugin
Chart.register(zoomPlugin);

interface MutationTSNEData {
	sample_id: string;
	gene_id: string;
	variant: string;
	aa_position: string;
	VAF: number; // Changed from string to number
	ref: string;
	alt: string;
	study: string;
	cluster: string;
	X1: number;
	X2: number;
}

export function MutationTSNE() {
	const [data, setData] = useState<MutationTSNEData[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pointRadius, setPointRadius] = useState(4);
	const [selectedGene, setSelectedGene] = useState<string>("NPM1");
	const [availableGenes, setAvailableGenes] = useState<Set<string>>(new Set());
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const chartInstance = useRef<Chart | null>(null);

	const [geneFilter, setGeneFilter] = useState("");
	const [showSettings, setShowSettings] = useState(false);

	const fetchData = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetchMutationTSNEData();

			console.log(response);
			if (
				Array.isArray(response) &&
				response.length > 0 &&
				"sample_id" in response[0]
			) {
				setData(response as MutationTSNEData[]);
				const genes = [...new Set(response.map((item) => item.gene_id))];
				setAvailableGenes(new Set(genes));
			} else {
				throw new Error("Received invalid data structure from the server");
			}
		} catch (error) {
			console.error("Error fetching mutation t-SNE data:", error);
			setError(
				`Failed to load mutation t-SNE data: ${(error as Error).message}`
			);
		} finally {
			setIsLoading(false);
		}
	};

	const filteredGenes = useMemo(() => {
		if (!geneFilter) return Array.from(availableGenes).slice(0, 100);
		return Array.from(availableGenes)
			.filter((gene) => gene.toLowerCase().includes(geneFilter.toLowerCase()))
			.slice(0, 100);
	}, [availableGenes, geneFilter]);

	const debouncedSetGeneFilter = useMemo(
		() => debounce((value: string) => setGeneFilter(value), 300),
		[]
	);

	useEffect(() => {
		if (!chartRef.current) {
			console.error("Chart reference is null. Skipping chart creation.");
			return;
		}

		const ctx = chartRef.current.getContext("2d");

		if (!ctx) {
			console.error("Failed to get 2D context from canvas.");
			return;
		}

		if (chartInstance.current) {
			chartInstance.current.destroy();
		}

		// Get unique sample positions
		const uniqueSamples = Array.from(
			new Set(data.map((item) => item.sample_id))
		).map((sampleId) => {
			const sample = data.find((item) => item.sample_id === sampleId);
			return {
				x: sample!.X1,
				y: sample!.X2,
				sample: sampleId,
			};
		});

		// Filter data for selected gene
		const filteredData = selectedGene
			? data.filter((item) => item.gene_id === selectedGene)
			: [];

		// Create color scale for VAF
		const vafValues = filteredData.map((d) =>
			typeof d.VAF === "number" ? d.VAF : parseFloat(d.VAF as string) || 0
		);
		const vafExtent = [0, Math.max(...vafValues)];
		const colorScale = scaleLinear<string>()
			.domain(vafExtent)
			.range(["blue", "red"])
			.interpolate(interpolateRgb);

		chartInstance.current = new Chart(ctx, {
			type: "scatter",
			data: {
				datasets: [
					{
						label: "All Samples",
						data: uniqueSamples,
						backgroundColor: "rgba(200, 200, 200, 0.5)",
						pointRadius: pointRadius / 1.5,
						order: 2,
					},
					{
						label: "Selected Gene Mutations",
						data: filteredData.map((item) => ({
							x: item.X1,
							y: item.X2,
							sample: item.sample_id,
							gene: item.gene_id,
							variant: item.variant,
							vaf: item.VAF,
							aa_position: item.aa_position,
							ref: item.ref,
							alt: item.alt,
							study: item.study,
							cluster: item.cluster,
						})),
						backgroundColor: filteredData.map((item) => colorScale(item.VAF)),
						pointRadius: pointRadius,
						order: 1,
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
							boxWidth: 10,
							padding: 10,
							generateLabels: () => {
								// Create a color scale legend for VAF
								const values = data
									.map((item) =>
										typeof item.VAF === "number"
											? item.VAF
											: parseFloat(item.VAF as string)
									)
									.filter((value): value is number => !isNaN(value));

								const min = Math.min(...values);
								const max = Math.max(...values);
								return [
									{
										text: `${min.toFixed(2)}`,
										fillStyle: colorScale(min),
									},
									{ text: "", fillStyle: colorScale(min + (max - min) * 0.25) },
									{ text: "", fillStyle: colorScale(min + (max - min) * 0.5) },
									{ text: "", fillStyle: colorScale(min + (max - min) * 0.75) },
									{
										text: `${max.toFixed(2)}`,
										fillStyle: colorScale(max),
									},
								];
							},
						},
					},
					tooltip: {
						callbacks: {
							label: (context: TooltipItem<"scatter">): string[] => {
								const point = context.raw as {
									sample?: string;
									gene?: string;
									variant?: string;
									vaf?: number;
									aa_position?: string;
									ref?: string;
									alt?: string;
									study?: string;
									cluster?: string;
									x: number;
									y: number;
								};
								return Object.entries(point)
									.filter(
										([key, value]) =>
											value != null &&
											!["x", "y"].includes(key) &&
											key !== "sample"
									)
									.map(([key, value]) => `${key}: ${value}`);
							},
						},
						filter: (tooltipItem: TooltipItem<"scatter">) => {
							return (tooltipItem.raw as { gene: string }).gene !== undefined;
						},
					},
					zoom: {
						zoom: {
							wheel: {
								enabled: true,
							},
							pinch: {
								enabled: true,
							},
							mode: "xy",
						},
						pan: {
							enabled: true,
							mode: "xy",
						},
					},
				},

				scales: {
					x: {
						type: "linear",
						position: "bottom",
						title: {
							display: true,
							text: "t-SNE 1",
						},
						grid: {
							display: false,
						},
					},
					y: {
						type: "linear",
						position: "left",
						title: {
							display: true,
							text: "t-SNE 2",
						},
						grid: {
							display: false,
						},
					},
				},
			},
		});

		return () => {
			if (chartInstance.current) {
				chartInstance.current.destroy();
			}
		};
	}, [data, pointRadius, selectedGene]);

	return (
		<Card className="w-full h-full">
			<CardHeader>
				<CardTitle>Mutation t-SNE Visualization</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col h-[calc(100%-4rem)]">
				{error && <p className="text-red-500 mt-2">{error}</p>}
				<div className="flex-grow relative">
					<div className="h-[500px]">
						{data.length > 0 ? (
							<canvas ref={chartRef} className="w-full h-full"></canvas>
						) : (
							<div className="w-full h-full flex items-center justify-center text-gray-500">
								<p>Click "Load Data" to generate the plot</p>
							</div>
						)}
					</div>
				</div>
				<div className="flex flex-row space-x-2">
					<Input
						type="text"
						placeholder="Search genes..."
						onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
							debouncedSetGeneFilter(e.target.value)
						}
						className="w-[120px]"
					/>
					<Select onValueChange={setSelectedGene} value={selectedGene}>
						<SelectTrigger className="w-[120px]">
							<SelectValue placeholder="Select a gene" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="All">Select Gene</SelectItem>
							{filteredGenes.map((gene) => (
								<SelectItem key={gene} value={gene}>
									{gene}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex-grow"></div>
					<Button onClick={fetchData} disabled={isLoading}>
						{isLoading ? "Loading..." : "Load Data"}
					</Button>
					<Button
						variant="ghost"
						onClick={() => setShowSettings(!showSettings)}
					>
						⚙️
					</Button>
					<Button
						onClick={() => chartInstance.current?.resetZoom()}
						disabled={!chartInstance.current}
					>
						Reset Zoom
					</Button>
				</div>
				{showSettings && (
					<div className="flex items-center space-x-2 mt-2">
						<span>Point Size:</span>
						<Slider
							value={[pointRadius]}
							onValueChange={(value) => setPointRadius(value[0])}
							min={1}
							max={10}
							step={1}
							className="w-[100px]"
						/>
						<span>{pointRadius}</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default MutationTSNE;
