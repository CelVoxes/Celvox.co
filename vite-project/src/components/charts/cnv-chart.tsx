import { useState, useEffect, useRef } from "react";
import { fetchCNVData, fetchHarmonizedDataNames } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Chart, { TooltipItem, ChartConfiguration } from "chart.js/auto";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import zoomPlugin from "chartjs-plugin-zoom";

// Register the zoom plugin
Chart.register(zoomPlugin);

// Interface for CNV data
interface CNVDataItem {
	gene_id: string;
	chromosome: string;
	start_position: number;
	end_position: number;
	cnv_score: number;
	cnv_z_score: number;
	is_significant_cnv: boolean;
	is_amplification: boolean;
	is_deletion: boolean;
	genomic_position: number;
	mean_expression: number;
	log2_expression: number;
}

interface CNVDataResponse {
	genome_expression: CNVDataItem[];
	sample_count: number;
	gene_count: number;
	chromosomes: string[];
	bin_size: number;
}

export function CNVChart() {
	const [cnvData, setCnvData] = useState<CNVDataItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedChromosomes, setSelectedChromosomes] = useState<string[]>([
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"10",
		"11",
		"12",
		"13",
		"14",
		"15",
		"16",
		"17",
		"18",
		"19",
		"20",
		"21",
		"22",
		"X",
		"Y",
	]);
	const [showSignificantOnly, setShowSignificantOnly] = useState(false);
	const [pointRadius, setPointRadius] = useState(2);
	const [showSettings, setShowSettings] = useState(false);
	const [selectedSample, setSelectedSample] = useState<string>("");
	const [availableSamples, setAvailableSamples] = useState<string[]>([]);
	const [sampleSearchTerm, setSampleSearchTerm] = useState<string>("");
	const [showSampleDropdown, setShowSampleDropdown] = useState<boolean>(false);
	const geneChartRef = useRef<HTMLCanvasElement | null>(null);
	const regionalChartRef = useRef<HTMLCanvasElement | null>(null);
	const chromosomeChartRef = useRef<HTMLCanvasElement | null>(null);
	const geneChartInstance = useRef<Chart | null>(null);
	const regionalChartInstance = useRef<Chart | null>(null);
	const chromosomeChartInstance = useRef<Chart | null>(null);

	// Function to render gene-level CNV scatter plot
	const renderGeneLevelChart = () => {
		if (!cnvData || cnvData.length === 0 || !geneChartRef.current) return;

		const ctx = geneChartRef.current.getContext("2d");
		if (!ctx) return;

		// Filter data based on selected chromosomes and significance
		const filteredData = cnvData
			.filter(
				(item) =>
					selectedChromosomes.includes(item.chromosome) &&
					!isNaN(item.cnv_score)
			)
			.filter((item) => !showSignificantOnly || item.is_significant_cnv);

		// Sort by chromosome and position for proper visualization
		filteredData.sort((a, b) => {
			// Sort by chromosome order first
			const chrOrder = [
				"1",
				"2",
				"3",
				"4",
				"5",
				"6",
				"7",
				"8",
				"9",
				"10",
				"11",
				"12",
				"13",
				"14",
				"15",
				"16",
				"17",
				"18",
				"19",
				"20",
				"21",
				"22",
				"X",
				"Y",
			];
			const chrA = chrOrder.indexOf(a.chromosome);
			const chrB = chrOrder.indexOf(b.chromosome);

			if (chrA !== chrB) {
				return chrA - chrB;
			}
			// Same chromosome, sort by position
			return a.start_position - b.start_position;
		});

		const uniqueChromosomes = [
			...new Set(filteredData.map((item) => item.chromosome)),
		];
		const chromosomeOrder = [
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
			"10",
			"11",
			"12",
			"13",
			"14",
			"15",
			"16",
			"17",
			"18",
			"19",
			"20",
			"21",
			"22",
			"X",
			"Y",
		];

		// Calculate chromosome start positions for proper genomic spacing
		const chromosomeStarts: { [key: string]: number } = {};
		let currentPosition = 0;
		const chromosomeSpacing = 50000000; // 50Mb space between chromosomes

		chromosomeOrder.forEach((chr) => {
			if (selectedChromosomes.includes(chr)) {
				chromosomeStarts[chr] = currentPosition;
				const chrData = filteredData.filter((item) => item.chromosome === chr);
				if (chrData.length > 0) {
					// Calculate the range for this chromosome
					const minPos = Math.min(
						...chrData.map((item) => item.start_position)
					);
					const maxPos = Math.max(
						...chrData.map((item) => item.start_position)
					);
					const chrWidth = maxPos - minPos;
					currentPosition += chrWidth + chromosomeSpacing;
				}
			}
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const datasets: any[] = [];

		// Group data by chromosome for better visualization
		uniqueChromosomes.forEach((chromosome) => {
			const chrData = filteredData.filter(
				(item) => item.chromosome === chromosome
			);

			if (chrData.length > 0) {
				// Sort chromosome data by position
				chrData.sort((a, b) => a.start_position - b.start_position);

				// Calculate genomic coordinate positioning
				const chrStart = chromosomeStarts[chromosome] || 0;

				// Individual gene points dataset positioned by actual genomic coordinates
				datasets.push({
					label: `Chr ${chromosome}`,
					data: chrData.map((item) => ({
						x: chrStart + item.start_position,
						y: item.cnv_score,
						gene: item.gene_id,
						chromosome: item.chromosome,
						cnv_z_score: item.cnv_z_score,
						is_significant: item.is_significant_cnv,
						is_amplification: item.is_amplification,
						is_deletion: item.is_deletion,
						absolute_position: item.start_position,
					})),
					backgroundColor: chrData.map((item) => {
						if (item.is_amplification) return "rgba(255, 0, 0, 0.8)"; // Red for amplifications
						if (item.is_deletion) return "rgba(0, 0, 255, 0.8)"; // Blue for deletions
						return "rgba(128, 128, 128, 0.6)"; // Gray for neutral
					}),
					borderColor: chrData.map((item) => {
						if (item.is_amplification) return "rgba(255, 0, 0, 1)";
						if (item.is_deletion) return "rgba(0, 0, 255, 1)";
						return "rgba(128, 128, 128, 0.8)";
					}),
					borderWidth: 1,
					pointRadius: pointRadius,
					pointHoverRadius: pointRadius + 2,
					showLine: false, // Only show points, not connecting lines
				});
			}
		});

		const config: ChartConfiguration<"scatter"> = {
			type: "scatter",
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: "nearest",
					intersect: false,
				},
				plugins: {
					zoom: {
						pan: {
							enabled: true,
							mode: "x",
						},
						zoom: {
							wheel: {
								enabled: true,
							},
							pinch: {
								enabled: true,
							},
							mode: "x",
						},
					},
					tooltip: {
						callbacks: {
							title: (context: TooltipItem<"scatter">[]) => {
								const item = context[0];
								const data = item.raw as {
									gene: string;
									chromosome: string;
									absolute_position: number;
								};
								return `Gene: ${data.gene} (Chr ${
									data.chromosome
								}:${data.absolute_position.toLocaleString()})`;
							},
							label: (context: TooltipItem<"scatter">) => {
								const data = context.raw as {
									y: number;
									cnv_z_score: number;
									is_amplification: boolean;
									is_deletion: boolean;
								};
								return [
									`CNV Score: ${data.y.toFixed(3)}`,
									`Z-Score: ${data.cnv_z_score.toFixed(3)}`,
									`Type: ${
										data.is_amplification
											? "Amplification"
											: data.is_deletion
											? "Deletion"
											: "Neutral"
									}`,
								];
							},
						},
					},
				},
				scales: {
					x: {
						type: "linear",
						position: "bottom",
						title: {
							display: true,
							text: "Genomic Position (with chromosome spacing)",
						},
						ticks: {
							callback: (value) => {
								// Convert back to chromosome positions for display
								for (const chr of chromosomeOrder) {
									if (selectedChromosomes.includes(chr)) {
										const chrStart = chromosomeStarts[chr] || 0;
										const chrData = filteredData.filter(
											(item) => item.chromosome === chr
										);
										if (chrData.length > 0) {
											const chrWidth =
												Math.max(
													...chrData.map((item) => Number(item.start_position))
												) -
												Math.min(
													...chrData.map((item) => Number(item.start_position))
												);
											const numValue = Number(value);
											if (
												numValue >= chrStart &&
												numValue <= chrStart + chrWidth
											) {
												const relativePos = numValue - chrStart;
												return `${chr}:${relativePos.toLocaleString()}`;
											}
										}
									}
								}
								return value.toString();
							},
						},
					},
					y: {
						title: {
							display: true,
							text: "CNV Score (log2 ratio)",
						},
					},
				},
			},
		};

		// Destroy existing chart
		if (geneChartInstance.current) {
			geneChartInstance.current.destroy();
		}

		// Create new chart
		geneChartInstance.current = new Chart(ctx, config);
	};

	// Function to render regional smoothed CNV plot
	const renderRegionalChart = () => {
		if (!cnvData || cnvData.length === 0 || !regionalChartRef.current) return;

		const ctx = regionalChartRef.current.getContext("2d");
		if (!ctx) return;

		// Filter data based on selected chromosomes
		const filteredData = cnvData.filter(
			(item) =>
				selectedChromosomes.includes(item.chromosome) && !isNaN(item.cnv_score)
		);

		// Sort by chromosome and position
		filteredData.sort((a, b) => {
			const chrOrder = [
				"1",
				"2",
				"3",
				"4",
				"5",
				"6",
				"7",
				"8",
				"9",
				"10",
				"11",
				"12",
				"13",
				"14",
				"15",
				"16",
				"17",
				"18",
				"19",
				"20",
				"21",
				"22",
				"X",
				"Y",
			];
			const chrA = chrOrder.indexOf(a.chromosome);
			const chrB = chrOrder.indexOf(b.chromosome);
			if (chrA !== chrB) return chrA - chrB;
			return a.start_position - b.start_position;
		});

		const chromosomeOrder = [
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
			"10",
			"11",
			"12",
			"13",
			"14",
			"15",
			"16",
			"17",
			"18",
			"19",
			"20",
			"21",
			"22",
			"X",
			"Y",
		];

		// Calculate chromosome start positions for proper genomic spacing (same as gene-level chart)
		const chromosomeStarts: { [key: string]: number } = {};
		let currentPosition = 0;
		const chromosomeSpacing = 50000000; // 50Mb space between chromosomes

		chromosomeOrder.forEach((chr) => {
			if (selectedChromosomes.includes(chr)) {
				chromosomeStarts[chr] = currentPosition;
				const chrData = filteredData.filter((item) => item.chromosome === chr);
				if (chrData.length > 0) {
					// Calculate the range for this chromosome
					const minPos = Math.min(
						...chrData.map((item) => item.start_position)
					);
					const maxPos = Math.max(
						...chrData.map((item) => item.start_position)
					);
					const chrWidth = maxPos - minPos;
					currentPosition += chrWidth + chromosomeSpacing;
				}
			}
		});

		const datasets: any[] = [];
		const windowSize = 20; // Moving average window size

		// Process each chromosome
		selectedChromosomes.forEach((chromosome) => {
			const chrData = filteredData.filter(
				(item) => item.chromosome === chromosome
			);
			if (chrData.length < windowSize) return; // Skip if not enough data

			// Get chromosome start position
			const chrStart = chromosomeStarts[chromosome] || 0;

			// Calculate moving average
			const smoothedData: any[] = [];
			for (let i = 0; i <= chrData.length - windowSize; i++) {
				const window = chrData.slice(i, i + windowSize);
				const avgCNV =
					window.reduce((sum, gene) => sum + gene.cnv_score, 0) / windowSize;
				const avgZScore =
					window.reduce((sum, gene) => sum + gene.cnv_z_score, 0) / windowSize;
				const centerGene = chrData[i + Math.floor(windowSize / 2)];

				smoothedData.push({
					x: chrStart + centerGene.start_position, // Use chromosome spacing like gene-level chart
					y: avgCNV,
					cnv_score: avgCNV,
					cnv_z_score: avgZScore,
					chromosome: chromosome,
					start_position: centerGene.start_position,
					gene_count: windowSize,
					is_significant: Math.abs(avgZScore) > 2,
					is_amplification: avgZScore > 2,
					is_deletion: avgZScore < -2,
					absolute_position: centerGene.start_position,
				});
			}

			datasets.push({
				label: `Chr ${chromosome} (smoothed)`,
				data: smoothedData,
				borderColor:
					chromosome === "1"
						? "#FF6B6B"
						: chromosome === "2"
						? "#4ECDC4"
						: chromosome === "3"
						? "#45B7D1"
						: chromosome === "4"
						? "#96CEB4"
						: chromosome === "5"
						? "#FECA57"
						: chromosome === "6"
						? "#FF9FF3"
						: chromosome === "7"
						? "#54A0FF"
						: chromosome === "8"
						? "#5F27CD"
						: chromosome === "9"
						? "#00D2D3"
						: chromosome === "10"
						? "#FF9F43"
						: chromosome === "11"
						? "#C44569"
						: chromosome === "12"
						? "#6C5CE7"
						: chromosome === "13"
						? "#A29BFE"
						: chromosome === "14"
						? "#FD79A8"
						: chromosome === "15"
						? "#E17055"
						: chromosome === "16"
						? "#00B894"
						: chromosome === "17"
						? "#FDCB6E"
						: chromosome === "18"
						? "#E84393"
						: chromosome === "19"
						? "#6C5CE7"
						: chromosome === "20"
						? "#A8E6CF"
						: chromosome === "21"
						? "#FFD3A5"
						: chromosome === "22"
						? "#FFAAA5"
						: chromosome === "X"
						? "#DDA0DD"
						: "#808080",
				backgroundColor:
					chromosome === "1"
						? "rgba(255, 107, 107, 0.1)"
						: chromosome === "2"
						? "rgba(78, 205, 196, 0.1)"
						: chromosome === "3"
						? "rgba(69, 183, 209, 0.1)"
						: chromosome === "4"
						? "rgba(150, 206, 180, 0.1)"
						: chromosome === "5"
						? "rgba(254, 202, 87, 0.1)"
						: chromosome === "6"
						? "rgba(255, 159, 243, 0.1)"
						: chromosome === "7"
						? "rgba(84, 160, 255, 0.1)"
						: chromosome === "8"
						? "rgba(95, 39, 205, 0.1)"
						: chromosome === "9"
						? "rgba(0, 210, 211, 0.1)"
						: chromosome === "10"
						? "rgba(255, 159, 67, 0.1)"
						: chromosome === "11"
						? "rgba(196, 69, 105, 0.1)"
						: chromosome === "12"
						? "rgba(108, 92, 231, 0.1)"
						: chromosome === "13"
						? "rgba(162, 155, 254, 0.1)"
						: chromosome === "14"
						? "rgba(253, 121, 168, 0.1)"
						: chromosome === "15"
						? "rgba(225, 112, 85, 0.1)"
						: chromosome === "16"
						? "rgba(0, 184, 148, 0.1)"
						: chromosome === "17"
						? "rgba(253, 203, 110, 0.1)"
						: chromosome === "18"
						? "rgba(232, 67, 147, 0.1)"
						: chromosome === "19"
						? "rgba(108, 92, 231, 0.1)"
						: chromosome === "20"
						? "rgba(168, 230, 207, 0.1)"
						: chromosome === "21"
						? "rgba(255, 211, 165, 0.1)"
						: chromosome === "22"
						? "rgba(255, 170, 165, 0.1)"
						: chromosome === "X"
						? "rgba(221, 160, 221, 0.1)"
						: "rgba(128, 128, 128, 0.1)",
				borderWidth: 2,
				fill: true,
				tension: 0.1,
				pointRadius: 0,
				pointHoverRadius: 4,
			});
		});

		const config: ChartConfiguration<"line"> = {
			type: "line",
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: "nearest",
					intersect: false,
				},
				plugins: {
					zoom: {
						pan: {
							enabled: true,
							mode: "x",
						},
						zoom: {
							wheel: {
								enabled: true,
							},
							pinch: {
								enabled: true,
							},
							mode: "x",
						},
					},
					tooltip: {
						callbacks: {
							title: (context) => {
								const item = context[0];
								const data = item.raw as {
									chromosome: string;
									absolute_position: number;
								};
								return `Gene: Chr ${
									data.chromosome
								}:${data.absolute_position.toLocaleString()}`;
							},
							label: (context) => {
								const data = context.raw as {
									y: number;
									cnv_z_score: number;
									gene_count: number;
									is_amplification: boolean;
									is_deletion: boolean;
								};
								return [
									`Smoothed CNV: ${data.y.toFixed(3)}`,
									`Z-Score: ${data.cnv_z_score.toFixed(3)}`,
									`Genes in window: ${data.gene_count}`,
									`Type: ${
										data.is_amplification
											? "Amplification"
											: data.is_deletion
											? "Deletion"
											: "Neutral"
									}`,
								];
							},
						},
					},
				},
				scales: {
					x: {
						type: "linear",
						position: "bottom",
						title: {
							display: true,
							text: "Genomic Position (with chromosome spacing)",
						},
						ticks: {
							callback: (value) => {
								// Convert back to chromosome positions for display
								for (const chr of chromosomeOrder) {
									if (selectedChromosomes.includes(chr)) {
										const chrStart = chromosomeStarts[chr] || 0;
										const chrData = filteredData.filter(
											(item) => item.chromosome === chr
										);
										if (chrData.length > 0) {
											const chrWidth =
												Math.max(
													...chrData.map((item) => Number(item.start_position))
												) -
												Math.min(
													...chrData.map((item) => Number(item.start_position))
												);
											const numValue = Number(value);
											if (
												numValue >= chrStart &&
												numValue <= chrStart + chrWidth
											) {
												const relativePos = numValue - chrStart;
												return `${chr}:${relativePos.toLocaleString()}`;
											}
										}
									}
								}
								return value.toString();
							},
						},
					},
					y: {
						title: {
							display: true,
							text: "Smoothed CNV Score (log2 ratio)",
						},
					},
				},
			},
		};

		// Destroy existing chart
		if (regionalChartInstance.current) {
			regionalChartInstance.current.destroy();
		}

		// Create new chart
		regionalChartInstance.current = new Chart(ctx, config);
	};

	// Function to render chromosome-level summary
	const renderChromosomeChart = () => {
		if (!cnvData || cnvData.length === 0 || !chromosomeChartRef.current) return;

		const ctx = chromosomeChartRef.current.getContext("2d");
		if (!ctx) return;

		// Calculate chromosome-level statistics
		const chromosomeStats = selectedChromosomes.map((chromosome) => {
			const chrData = cnvData.filter(
				(item) => item.chromosome === chromosome && !isNaN(item.cnv_score)
			);
			const totalGenes = chrData.length;
			const significantGenes = chrData.filter(
				(item) => item.is_significant_cnv
			).length;
			const amplifications = chrData.filter(
				(item) => item.is_amplification
			).length;
			const deletions = chrData.filter((item) => item.is_deletion).length;
			const avgCNV =
				chrData.length > 0
					? chrData.reduce((sum, item) => sum + item.cnv_score, 0) /
					  chrData.length
					: 0;

			return {
				chromosome,
				totalGenes,
				significantGenes,
				amplifications,
				deletions,
				avgCNV,
				significantPercentage:
					totalGenes > 0 ? (significantGenes / totalGenes) * 100 : 0,
			};
		});

		const config: ChartConfiguration = {
			type: "bar",
			data: {
				labels: chromosomeStats.map((stat) => `Chr ${stat.chromosome}`),
				datasets: [
					{
						label: "Average CNV Score",
						data: chromosomeStats.map((stat) => stat.avgCNV),
						backgroundColor: chromosomeStats.map((stat) =>
							stat.avgCNV > 0.2
								? "rgba(255, 99, 132, 0.8)"
								: stat.avgCNV < -0.2
								? "rgba(54, 162, 235, 0.8)"
								: "rgba(128, 128, 128, 0.8)"
						),
						borderColor: chromosomeStats.map((stat) =>
							stat.avgCNV > 0.2
								? "rgba(255, 99, 132, 1)"
								: stat.avgCNV < -0.2
								? "rgba(54, 162, 235, 1)"
								: "rgba(128, 128, 128, 1)"
						),
						borderWidth: 1,
						yAxisID: "y",
					},
					{
						label: "Significant Genes (%)",
						data: chromosomeStats.map((stat) => stat.significantPercentage),
						backgroundColor: "rgba(255, 206, 86, 0.8)",
						borderColor: "rgba(255, 206, 86, 1)",
						borderWidth: 1,
						yAxisID: "y1",
						type: "line",
						pointRadius: 6,
						pointHoverRadius: 8,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: "index",
					intersect: false,
				},
				plugins: {
					tooltip: {
						callbacks: {
							afterLabel: (context) => {
								const stat = chromosomeStats[context.dataIndex];
								return [
									`Total Genes: ${stat.totalGenes}`,
									`Amplifications: ${stat.amplifications}`,
									`Deletions: ${stat.deletions}`,
									`Significant: ${
										stat.significantGenes
									} (${stat.significantPercentage.toFixed(1)}%)`,
								];
							},
						},
					},
				},
				scales: {
					x: {
						title: {
							display: true,
							text: "Chromosome",
						},
					},
					y: {
						type: "linear",
						display: true,
						position: "left",
						title: {
							display: true,
							text: "Average CNV Score",
						},
					},
					y1: {
						type: "linear",
						display: true,
						position: "right",
						title: {
							display: true,
							text: "Significant Genes (%)",
						},
						min: 0,
						max: 50,
						grid: {
							drawOnChartArea: false,
						},
					},
				},
			},
		};

		// Destroy existing chart
		if (chromosomeChartInstance.current) {
			chromosomeChartInstance.current.destroy();
		}

		// Create new chart
		chromosomeChartInstance.current = new Chart(ctx, config);
	};

	const handleFetchCNVData = async () => {
		setIsLoading(true);
		setError(null);
		try {
			// First, get available samples
			const sampleData = await fetchHarmonizedDataNames();
			setAvailableSamples(sampleData);

			// If no sample is selected and we have samples available, select the first one
			if (!selectedSample && sampleData.length > 0) {
				setSelectedSample(sampleData[0]);
				setSampleSearchTerm(sampleData[0]);
			}

			// Fetch CNV data for the selected sample
			const sampleToFetch =
				selectedSample || (sampleData.length > 0 ? sampleData[0] : "");
			if (sampleToFetch) {
				const data: CNVDataResponse = await fetchCNVData(
					[sampleToFetch],
					false
				); // Use harmonized sample names directly
				setCnvData(data?.genome_expression || []);
			} else {
				setCnvData([]);
			}
		} catch (error) {
			console.error("Failed to load CNV data:", error);
			setError("Failed to load CNV data. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleSampleChange = async (sample: string) => {
		setSelectedSample(sample);
		setIsLoading(true);
		setError(null);
		try {
			const data: CNVDataResponse = await fetchCNVData([sample], false); // Use harmonized sample names directly
			setCnvData(data?.genome_expression || []);
		} catch (error) {
			console.error("Failed to load CNV data for sample:", error);
			setError("Failed to load CNV data. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		handleFetchCNVData();
	}, []); // Only run once on mount

	// useEffect for gene-level chart
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		renderGeneLevelChart();
		return () => {
			if (geneChartInstance.current) {
				geneChartInstance.current.destroy();
			}
		};
	}, [cnvData, selectedChromosomes, showSignificantOnly, pointRadius]);

	// useEffect for regional chart
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		renderRegionalChart();
		return () => {
			if (regionalChartInstance.current) {
				regionalChartInstance.current.destroy();
			}
		};
	}, [cnvData, selectedChromosomes]);

	// useEffect for chromosome summary chart
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		renderChromosomeChart();
		return () => {
			if (chromosomeChartInstance.current) {
				chromosomeChartInstance.current.destroy();
			}
		};
	}, [cnvData, selectedChromosomes]);

	const toggleChromosome = (chromosome: string) => {
		setSelectedChromosomes((prev) =>
			prev.includes(chromosome)
				? prev.filter((c) => c !== chromosome)
				: [...prev, chromosome]
		);
	};

	const availableChromosomes = [
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"10",
		"11",
		"12",
		"13",
		"14",
		"15",
		"16",
		"17",
		"18",
		"19",
		"20",
		"21",
		"22",
		"X",
		"Y",
	];

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Copy Number Variation (CNV) Analysis</CardTitle>
					<div className="flex gap-2 flex-wrap items-center">
						<Button
							onClick={handleFetchCNVData}
							disabled={isLoading}
							className="w-auto"
						>
							{isLoading ? "Loading..." : "Load CNV Data"}
						</Button>

						{availableSamples.length > 0 && (
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium">Sample:</label>
								<div className="relative w-64">
									{/* Combined Searchable Select */}
									<div
										className="relative w-full"
										onClick={() =>
											!isLoading && setShowSampleDropdown(!showSampleDropdown)
										}
									>
										<div className="flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500">
											<span
												className={`text-sm ${
													selectedSample
														? "text-gray-900 dark:text-gray-100"
														: "text-gray-500 dark:text-gray-400"
												}`}
											>
												{selectedSample || "Select a sample..."}
											</span>
											<svg
												className={`w-4 h-4 transition-transform ${
													showSampleDropdown ? "rotate-180" : ""
												}`}
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										</div>

										{/* Combined Search and Select Dropdown */}
										{showSampleDropdown && (
											<div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 mt-1">
												{/* Search Input inside dropdown */}
												<div className="p-2 border-b border-gray-200 dark:border-gray-700">
													<Input
														type="text"
														placeholder="Search samples..."
														value={sampleSearchTerm}
														onChange={(e) => {
															setSampleSearchTerm(e.target.value);
															e.stopPropagation(); // Prevent dropdown from closing
														}}
														onClick={(e) => e.stopPropagation()}
														className="w-full text-sm"
														autoFocus
													/>
												</div>

												{/* Filtered Results */}
												<div className="max-h-48 overflow-y-auto">
													{sampleSearchTerm
														? // Show filtered results when searching
														  availableSamples
																.filter((sample) =>
																	sample
																		.toLowerCase()
																		.includes(sampleSearchTerm.toLowerCase())
																)
																.slice(0, 20)
																.map((sample) => (
																	<div
																		key={sample}
																		className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm ${
																			selectedSample === sample
																				? "bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
																				: ""
																		}`}
																		onClick={(e) => {
																			e.stopPropagation();
																			handleSampleChange(sample);
																			setSampleSearchTerm("");
																			setShowSampleDropdown(false);
																		}}
																	>
																		{sample}
																	</div>
																))
														: // Show all samples when not searching
														  availableSamples.map((sample) => (
																<div
																	key={sample}
																	className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm ${
																		selectedSample === sample
																			? "bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
																			: ""
																	}`}
																	onClick={(e) => {
																		e.stopPropagation();
																		handleSampleChange(sample);
																		setShowSampleDropdown(false);
																	}}
																>
																	{sample}
																</div>
														  ))}

													{/* No results message */}
													{sampleSearchTerm &&
														availableSamples.filter((sample) =>
															sample
																.toLowerCase()
																.includes(sampleSearchTerm.toLowerCase())
														).length === 0 && (
															<div className="px-3 py-2 text-sm text-gray-500">
																No samples found
															</div>
														)}
												</div>
											</div>
										)}
									</div>
								</div>
							</div>
						)}

						<Button
							onClick={() => setShowSettings(!showSettings)}
							variant="outline"
							className="w-auto"
						>
							{showSettings ? "Hide Settings" : "Show Settings"}
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{error && (
						<div className="text-red-600 dark:text-red-500 font-medium mb-4">
							{error}
						</div>
					)}

					{showSettings && (
						<div className="mb-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
							<h3 className="font-semibold mb-3">Visualization Settings</h3>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
								<div>
									<label className="block text-sm font-medium mb-2">
										Point Size
									</label>
									<Slider
										value={[pointRadius]}
										onValueChange={(value) => setPointRadius(value[0])}
										min={1}
										max={10}
										step={1}
										className="w-full"
									/>
									<span className="text-xs text-gray-500">{pointRadius}px</span>
								</div>

								<div className="flex items-center space-x-2">
									<Checkbox
										id="significant-only"
										checked={showSignificantOnly}
										onCheckedChange={(checked) =>
											setShowSignificantOnly(checked === true)
										}
									/>
									<label
										htmlFor="significant-only"
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										Show only significant CNVs (|z| &gt; 2)
									</label>
								</div>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Chromosomes to Display
								</label>
								<div className="grid grid-cols-4 md:grid-cols-6 gap-2">
									{availableChromosomes.map((chr) => (
										<div key={chr} className="flex items-center space-x-2">
											<Checkbox
												id={`chr-${chr}`}
												checked={selectedChromosomes.includes(chr)}
												onCheckedChange={() => toggleChromosome(chr)}
											/>
											<label
												htmlFor={`chr-${chr}`}
												className="text-xs font-medium leading-none"
											>
												{chr}
											</label>
										</div>
									))}
								</div>
							</div>
						</div>
					)}

					<Tabs defaultValue="gene-level" className="w-full">
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="gene-level">Gene Level</TabsTrigger>
							<TabsTrigger value="regional">Regional View</TabsTrigger>
							<TabsTrigger value="chromosome">Chromosome Summary</TabsTrigger>
						</TabsList>

						<TabsContent value="gene-level" className="space-y-4">
							<div className="text-sm text-gray-600 dark:text-gray-400">
								<p>
									This plot shows individual gene copy number variation (CNV)
									scores positioned by their actual genomic coordinates. Genes
									that are adjacent on chromosomes appear adjacent in the
									visualization, making it easy to spot chromosomal
									abnormalities affecting multiple nearby genes. Each dot
									represents one gene's CNV score calculated as log2(expression
									/ reference median).
								</p>
							</div>

							<div className="relative h-96 w-full">
								<canvas ref={geneChartRef} />
							</div>
						</TabsContent>

						<TabsContent value="regional" className="space-y-4">
							<div className="text-sm text-gray-600 dark:text-gray-400">
								<p>
									This regional view shows smoothed CNV patterns using a moving
									average (20-gene window) to identify contiguous chromosomal
									segments with consistent copy number changes. This helps
									reveal true CNV regions rather than individual gene noise.
								</p>
							</div>

							<div className="relative h-96 w-full">
								<canvas ref={regionalChartRef} />
							</div>
						</TabsContent>

						<TabsContent value="chromosome" className="space-y-4">
							<div className="text-sm text-gray-600 dark:text-gray-400">
								<p>
									This chromosome-level summary provides an overview of CNV
									patterns across all selected chromosomes, showing average CNV
									scores and the percentage of significant genes per chromosome.
								</p>
							</div>

							<div className="relative h-96 w-full">
								<canvas ref={chromosomeChartRef} />
							</div>
						</TabsContent>
					</Tabs>

					{cnvData && cnvData.length > 0 && (
						<div className="mt-4 space-y-2">
							{/* Summary Statistics */}
							<div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded">
								<h4 className="font-medium mb-2">CNV Summary</h4>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
									<div>
										<span className="font-medium">Total Genes:</span>{" "}
										{
											cnvData.filter(
												(item) =>
													selectedChromosomes.includes(item.chromosome) &&
													!isNaN(item.cnv_score)
											).length
										}
									</div>
									<div>
										<span className="font-medium">Chromosomes:</span>{" "}
										{selectedChromosomes.length}
									</div>
									<div>
										<span className="font-medium text-red-600">
											Amplifications:
										</span>{" "}
										{
											cnvData.filter(
												(item) =>
													selectedChromosomes.includes(item.chromosome) &&
													item.is_amplification
											).length
										}
									</div>
									<div>
										<span className="font-medium text-blue-600">
											Deletions:
										</span>{" "}
										{
											cnvData.filter(
												(item) =>
													selectedChromosomes.includes(item.chromosome) &&
													item.is_deletion
											).length
										}
									</div>
								</div>
							</div>

							{/* Per-Chromosome Statistics */}
							<div className="text-sm text-gray-600 dark:text-gray-400">
								<h4 className="font-medium mb-2">Per-Chromosome Breakdown</h4>
								<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
									{selectedChromosomes.map((chr) => {
										const chrGenes = cnvData.filter(
											(item) => item.chromosome === chr
										);
										const amps = chrGenes.filter(
											(item) => item.is_amplification
										).length;
										const dels = chrGenes.filter(
											(item) => item.is_deletion
										).length;
										const total = chrGenes.length;

										return (
											<div
												key={chr}
												className="bg-gray-50 dark:bg-gray-800 p-2 rounded"
											>
												<div className="font-medium">Chr {chr}</div>
												<div>Total: {total}</div>
												<div className="text-red-600">Amp: {amps}</div>
												<div className="text-blue-600">Del: {dels}</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
