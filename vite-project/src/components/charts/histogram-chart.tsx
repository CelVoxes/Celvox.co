import { useRef, useEffect, useMemo } from "react";
import {
	Chart as ChartJS,
	ChartOptions,
	LineElement,
	PointElement,
	LinearScale,
	Tooltip,
	ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip);

interface PDFChartProps {
	data: { x: number; y: number }[];
	attribute: string;
}

export const PDFChart: React.FC<PDFChartProps> = ({ data, attribute }) => {
	const chartRef = useRef<ChartJS<"line">>(null);

	const { processedData, median } = useMemo(() => {
		const totalCount = data.reduce((sum, d) => sum + d.y, 0);
		const sortedData = [...data].sort((a, b) => a.x - b.x);
		const minX = sortedData[0].x;
		const maxX = sortedData[sortedData.length - 1].x;
		const range = maxX - minX;
		const bandwidth = range / Math.sqrt(totalCount);

		// Calculate median for discrete data
		let cumulativeCount = 0;
		const medianThreshold = totalCount / 2;
		let median = 0;

		for (const dataPoint of sortedData) {
			cumulativeCount += dataPoint.y;
			if (cumulativeCount >= medianThreshold) {
				median = dataPoint.x;
				break;
			}
		}

		// Generate PDF using kernel density estimation
		const pdfData = sortedData.map((d) => {
			const density = sortedData.reduce((sum, di) => {
				const u = (d.x - di.x) / bandwidth;
				return (
					sum +
					((di.y / totalCount) * Math.exp(-0.5 * u * u)) /
						(bandwidth * Math.sqrt(2 * Math.PI))
				);
			}, 0);
			return { x: d.x, y: density };
		});

		return { processedData: pdfData, median };
	}, [data]);

	console.log("PDFChart props:", { data: processedData, attribute });
	console.log(
		"Data points:",
		processedData
			.map((d) => `(${d.x.toFixed(2)}, ${d.y.toFixed(4)})`)
			.join(", ")
	);

	const chartData: ChartData<"line"> = {
		datasets: [
			{
				label: "Probability Density",
				data: processedData,
				borderColor: "rgba(75, 192, 192, 1)",
				backgroundColor: "rgba(75, 192, 192, 0.2)",
				fill: true,
				tension: 0.4,
			},
		],
	};

	console.log("Chart data:", JSON.stringify(chartData, null, 2));

	const options: ChartOptions<"line"> = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: false,
			},
			title: {
				display: true,
				text: `Distribution of ${attribute}`,
				font: {
					size: 16,
					weight: "bold",
				},
			},
			tooltip: {
				callbacks: {
					title: (context) => `Value: ${context[0].parsed.x.toFixed(2)}`,
					label: (context) => `Density: ${context.parsed.y.toFixed(4)}`,
				},
			},
		},
		scales: {
			x: {
				type: "linear",
				title: {
					display: true,
					text: attribute,
					font: {
						weight: "bold",
					},
				},
				ticks: {
					callback: (value) => Number(value).toFixed(0),
				},
			},
			y: {
				title: {
					display: true,
					text: "Probability Density",
					font: {
						weight: "bold",
					},
				},
				beginAtZero: true,
			},
		},
	};

	console.log("Chart options:", JSON.stringify(options, null, 2));

	useEffect(() => {
		const chart = chartRef.current;
		if (chart) {
			const drawMedianLine = () => {
				const ctx = chart.ctx;
				const yAxis = chart.scales.y;
				const xAxis = chart.scales.x;

				const medianPosition = xAxis.getPixelForValue(median);

				console.log("Median line position:", medianPosition);

				// Draw median line
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(medianPosition, yAxis.bottom);
				ctx.lineTo(medianPosition, yAxis.top);
				ctx.lineWidth = 2;
				ctx.strokeStyle = "rgba(255, 0, 0, 0.75)";
				ctx.stroke();

				// Draw median label
				ctx.textAlign = "center";
				ctx.fillStyle = "rgba(255, 0, 0, 0.75)";
				ctx.fillText(
					`Median: ${median.toFixed(2)}`,
					medianPosition,
					yAxis.top - 10
				);
				ctx.restore();
			};

			chart.options.animation = {
				onComplete: drawMedianLine,
			};
			chart.update();
		}
	}, [processedData, median]);

	return (
		<div style={{ position: "relative", height: "300px", width: "100%" }}>
			<Line ref={chartRef} data={chartData} options={options} />
		</div>
	);
};
