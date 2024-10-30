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
	const [windowWidth, setWindowWidth] = useState(window.innerWidth);

	useEffect(() => {
		const handleResize = () => {
			setWindowWidth(window.innerWidth);
		};

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

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
			const isMobile = windowWidth < 768;

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
					indexAxis: "y",
					scales: {
						x: {
							stacked: true,
							title: {
								display: true,
								text: "Percentage",
								font: {
									size: isMobile ? 10 : 12,
								},
							},
							max: 100,
						},
						y: {
							stacked: true,
							title: {
								display: true,
								text: "Samples",
								font: {
									size: isMobile ? 10 : 12,
								},
							},
							ticks: {
								autoSkip: false,
								maxRotation: 0,
								minRotation: 0,
								padding: 5,
								font: {
									size: isMobile ? 8 : 10,
								},
							},
							afterFit: (scaleInstance) => {
								scaleInstance.height = samples.length * 25;
							},
						},
					},
					plugins: {
						legend: {
							position: isMobile ? "bottom" : "right",
							align: "start",
							labels: {
								boxWidth: isMobile ? 10 : 15,
								font: {
									size: isMobile ? 8 : 10,
								},
								padding: isMobile ? 8 : 10,
							},
						},
						title: {
							display: true,
							text: "Cell Type Distribution Across Samples",
							font: {
								size: isMobile ? 12 : 14,
							},
						},
					},
					layout: {
						padding: {
							right: isMobile ? 10 : 150,
							left: isMobile ? 10 : 20,
							bottom: isMobile ? 50 : 10,
						},
					},
				},
			};

			chartInstance.current = new Chart(ctx as ChartItem, config);
		}
	}, [deconvolutionData, windowWidth]);

	return (
		<Card className="w-full h-full">
			<CardHeader className="space-y-1.5 p-4 sm:p-6">
				<CardTitle className="text-lg sm:text-xl">
					Deconvolution Analysis
				</CardTitle>
			</CardHeader>
			<CardContent className="p-4 sm:p-6">
				{error && <p className="text-red-500 mb-4">{error}</p>}
				<div
					className="relative overflow-y-auto overflow-x-hidden"
					style={{ height: "calc(80vh - 200px)", minHeight: "400px" }}
				>
					{!deconvolutionData && (
						<div className="flex justify-center items-center h-full absolute inset-0">
							<p className="text-muted-foreground text-sm sm:text-base">
								Click "Run Deconvolution" to generate plot.
							</p>
						</div>
					)}
					<canvas ref={chartRef} className="w-full"></canvas>
				</div>
				<div className="mt-4 flex justify-center sm:justify-start">
					<Button
						onClick={handleRunDeconvolution}
						disabled={isLoading}
						className="w-full sm:w-auto"
					>
						{isLoading ? "Running..." : "Run Deconvolution"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default DeconvolutionChart;
