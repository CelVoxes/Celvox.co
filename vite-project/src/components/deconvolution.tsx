import { useState, useEffect, useRef } from "react";
import { fetchDeconvolutionData } from "@/utils/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chart, ChartItem, ChartConfiguration } from "chart.js/auto";
import { useToast } from "@/hooks/use-toast";
import { interpolateRainbow } from "d3-scale-chromatic";

interface SampleData {
	[cellType: string]: number | string;
	_row: string;
}

interface DeconvolutionData {
	[sampleId: string]: SampleData;
}

export function DeconvolutionChart() {
	const [deconvolutionData, setDeconvolutionData] =
		useState<DeconvolutionData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const chartInstance = useRef<Chart | null>(null);
	const { toast } = useToast();

	const handleRunDeconvolution = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await fetchDeconvolutionData();
			setDeconvolutionData(data.deconvolution);
			toast({
				title: "Deconvolution Complete",
				description: data.message,
				duration: 5000,
			});
		} catch (error) {
			console.error("Failed to load deconvolution data:", error);
			setError("Failed to load deconvolution data. Please try again.");
			toast({
				title: "Error",
				description: "Failed to load deconvolution data. Please try again.",
				variant: "destructive",
				duration: 5000,
			});
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (deconvolutionData && chartRef.current) {
			const ctx = chartRef.current.getContext("2d");

			if (chartInstance.current) {
				chartInstance.current.destroy();
			}

			const samples = Object.values(deconvolutionData);
			const sampleNames = samples.map((sample) => sample._row);
			const cellTypes = Object.keys(samples[0]).filter((key) => key !== "_row");

			// Generate a color palette
			const colorPalette = cellTypes.map((_, i) =>
				interpolateRainbow(i / (cellTypes.length - 1))
			);

			const datasets = cellTypes.map((cellType, index) => ({
				label: cellType,
				data: samples.map((sample) => (sample[cellType] as number) * 100),
				backgroundColor: colorPalette[index],
				borderColor: colorPalette[index],
				borderWidth: 1,
			}));

			const config: ChartConfiguration = {
				type: "bar",
				data: {
					labels: sampleNames,
					datasets: datasets,
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					indexAxis: "y", // This makes the bars horizontal
					scales: {
						x: {
							stacked: true,
							title: {
								display: true,
								text: "Percentage",
							},
							max: 100,
						},
						y: {
							stacked: true,
							title: {
								display: true,
								text: "Samples",
							},
							ticks: {
								autoSkip: false,
								maxRotation: 0,
								minRotation: 0,
								padding: 5,
							},
						},
					},
					plugins: {
						legend: {
							position: "right",
							align: "start",
							labels: {
								boxWidth: 15,
								font: {
									size: 10,
								},
							},
						},
						title: {
							display: true,
							text: "Cell Type Distribution Across Samples",
						},
					},
					layout: {
						padding: {
							right: 150,
							left: 20, // Add left padding to accommodate longer sample names
						},
					},
				},
			};

			chartInstance.current = new Chart(ctx as ChartItem, config);
		}
	}, [deconvolutionData]);

	return (
		<Card className="w-full h-full">
			<CardHeader>
				<CardTitle>Deconvolution Analysis</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col h-[calc(100%-4rem)]">
				{error && <p className="text-red-500 mt-2">{error}</p>}
				<div className="flex-grow relative">
					{!deconvolutionData && (
						<div className="flex justify-center items-center h-full absolute inset-0">
							<p className="text-gray-500 mt-2">
								Click "Run Deconvolution" to generate plot.
							</p>
						</div>
					)}
					<canvas ref={chartRef} className="w-full h-full"></canvas>
				</div>
				<div className="flex-1 flex-wrap gap-4 mb-4 items-center">
					<Button onClick={handleRunDeconvolution} disabled={isLoading}>
						{isLoading ? "Running..." : "Run Deconvolution"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default DeconvolutionChart;
