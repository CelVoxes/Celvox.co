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
import { fetchAberrationsTSNEData } from "@/utils/api";
import { Input } from "@/components/ui/input";
import debounce from "lodash/debounce";
import { scaleLinear } from "d3-scale";
import { interpolateViridis } from "d3-scale-chromatic";
import zoomPlugin from "chartjs-plugin-zoom";

// Register the zoom plugin
Chart.register(zoomPlugin);

interface AberrationsTSNEData {
	sample_id: string;
	X1: number;
	X2: number;
	[key: string]: string | number;
}

export function AberrationsTSNE() {
	const [data, setData] = useState<AberrationsTSNEData[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pointRadius, setPointRadius] = useState(4);
	const [selectedAberration, setSelectedAberration] = useState<string>("");
	const [availableAberrations, setAvailableAberrations] = useState<Set<string>>(
		new Set()
	);
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const chartInstance = useRef<Chart | null>(null);

	const [aberrationFilter, setAberrationFilter] = useState("");
	const [showSettings, setShowSettings] = useState(false);

	const fetchData = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetchAberrationsTSNEData();

			if (
				Array.isArray(response) &&
				response.length > 0 &&
				"sample_id" in response[0]
			) {
				setData(response as AberrationsTSNEData[]);
				// Get all column names except sample_id and X1, X2 (t-SNE coordinates)
				const columns = Object.keys(response[0]).filter(
					(col) => !["sample_id", "X1", "X2"].includes(col)
				);
				setAvailableAberrations(new Set(columns));
			} else {
				throw new Error("Received invalid data structure from the server");
			}
		} catch (error) {
			console.error("Error fetching aberrations t-SNE data:", error);
			setError(
				`Failed to load aberrations t-SNE data: ${(error as Error).message}`
			);
		} finally {
			setIsLoading(false);
		}
	};

	const filteredAberrations = useMemo(() => {
		if (!aberrationFilter)
			return Array.from(availableAberrations).slice(0, 100);
		return Array.from(availableAberrations)
			.filter((aberration) =>
				aberration.toLowerCase().includes(aberrationFilter.toLowerCase())
			)
			.slice(0, 100);
	}, [availableAberrations, aberrationFilter]);

	const debouncedSetAberrationFilter = useMemo(
		() => debounce((value: string) => setAberrationFilter(value), 300),
		[]
	);

	useEffect(() => {
		if (!chartRef.current) {
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

		// Filter data for selected aberration
		const filteredData = selectedAberration
			? data.filter((item) => item[selectedAberration] === 1)
			: [];

		// Create color scale for presence/absence (though for aberrations it's binary)
		const colorScale = scaleLinear<number>().domain([0, 1]).range([0, 1]);

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
						label: `Samples with ${selectedAberration}`,
						data: filteredData.map((item) => ({
							x: item.X1,
							y: item.X2,
							sample: item.sample_id,
							aberration: selectedAberration,
							presence: item[selectedAberration],
						})),
						backgroundColor: filteredData.map(
							() => interpolateViridis(colorScale(1)) // Always 1 for presence
						),
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
							boxWidth: 20,
							boxHeight: 20,
							padding: 10,
							usePointStyle: true,
							pointStyle: "rectRounded",
							generateLabels: () => {
								if (!selectedAberration) {
									return [
										{
											text: "All Samples",
											fillStyle: "rgba(200, 200, 200, 0.5)",
										},
									];
								}
								return [
									{
										text: "All Samples",
										fillStyle: "rgba(200, 200, 200, 0.5)",
									},
									{
										text: `Samples with ${selectedAberration}`,
										fillStyle: interpolateViridis(colorScale(1)),
									},
								];
							},
						},
						title: {
							display: true,
							text: "Aberration Status",
						},
					},
					tooltip: {
						callbacks: {
							label: (context: TooltipItem<"scatter">): string[] => {
								const point = context.raw as {
									sample?: string;
									aberration?: string;
									presence?: number;
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
							return (
								(tooltipItem.raw as { aberration: string }).aberration !==
								undefined
							);
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
	}, [data, pointRadius, selectedAberration]);

	return (
		<Card className="w-full h-full">
			<CardHeader>
				<CardTitle>Aberrations t-SNE Visualization</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col h-[calc(100%-4rem)]">
				{error && <p className="text-red-500 mt-2">{error}</p>}
				<div className="flex-grow relative">
					<div className="h-[300px] sm:h-[400px] md:h-[500px]">
						{data.length > 0 ? (
							<canvas ref={chartRef} className="w-full h-full"></canvas>
						) : (
							<div className="w-full h-full flex items-center justify-center text-gray-500">
								<p>Click "Load Data" to generate the plot</p>
							</div>
						)}
					</div>
				</div>
				<div className="flex flex-col gap-4 mt-4">
					<div className="flex flex-col lg:flex-row gap-4">
						<div className="flex gap-2">
							<Input
								type="text"
								placeholder="Search aberrations..."
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									debouncedSetAberrationFilter(e.target.value)
								}
								className="w-full lg:w-[120px]"
							/>
							<Select
								onValueChange={(value) =>
									setSelectedAberration(value === "all" ? "" : value)
								}
								value={selectedAberration || "all"}
							>
								<SelectTrigger className="w-full lg:w-[100px]">
									<SelectValue placeholder="Select an aberration" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all"></SelectItem>
									{filteredAberrations.map((aberration) => (
										<SelectItem key={aberration} value={aberration}>
											{aberration}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex flex-wrap gap-2">
							<Button
								onClick={fetchData}
								disabled={isLoading}
								className="flex-1 lg:flex-none min-w-[100px]"
							>
								{isLoading ? "Loading..." : "Load Data"}
							</Button>
							<Button
								variant="ghost"
								onClick={() => setShowSettings(!showSettings)}
								className="flex-none"
							>
								⚙️
							</Button>
							<Button
								onClick={() => chartInstance.current?.resetZoom()}
								disabled={!chartInstance.current}
								className="flex-1 lg:flex-none min-w-[100px]"
							>
								Reset Zoom
							</Button>
						</div>
					</div>

					{/* Settings section */}
					{showSettings && (
						<div className="flex flex-col lg:flex-row items-start lg:items-center gap-2">
							<span>Point Size:</span>
							<div className="flex items-center gap-2 w-full lg:w-auto">
								<Slider
									value={[pointRadius]}
									onValueChange={(value) => setPointRadius(value[0])}
									min={1}
									max={10}
									step={1}
									className="w-full lg:w-[100px]"
								/>
								<span className="min-w-[20px] text-center">{pointRadius}</span>
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default AberrationsTSNE;
