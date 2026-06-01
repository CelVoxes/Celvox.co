import { Fragment, useState } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const METADATA_KEYS = new Set(["_row", "_source", "_subtype", "_disease"]);

type DeconvolutionSample = {
	[cellType: string]: number | string | undefined;
	_row: string;
	_source?: string;
	_subtype?: string;
	_disease?: string;
};

interface DeconvolutionTableProps {
	data: Record<string, DeconvolutionSample> | null;
}

function getCellTypes(samples: DeconvolutionSample[]) {
	const keys = new Set<string>();
	samples.forEach((sample) => {
		Object.keys(sample).forEach((key) => {
			if (!METADATA_KEYS.has(key) && Number.isFinite(Number(sample[key]))) {
				keys.add(key);
			}
		});
	});
	return Array.from(keys);
}

function formatPercent(value: number | string | undefined) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(1)}%` : "-";
}

function getDominantEstimate(sample: DeconvolutionSample, cellTypes: string[]) {
	return cellTypes
		.map((cellType) => ({
			cellType,
			value: Number(sample[cellType]),
		}))
		.filter((item) => Number.isFinite(item.value))
		.sort((a, b) => b.value - a.value)[0];
}

export function DeconvolutionTable({ data }: DeconvolutionTableProps) {
	const [expandedRow, setExpandedRow] = useState<string | null>(null);

	if (!data) return null;

	const samples = Object.values(data).filter((s) => s._source !== "reference");
	const cellTypes = getCellTypes(samples);

	const exportToCsv = () => {
		if (!data) return;

		const header = [
			"Sample",
			"Dominant estimate",
			"Dominant %",
			...cellTypes.map((type) => `${type}%`),
		];

		const rows = samples.map((sample) => {
			const dominant = getDominantEstimate(sample, cellTypes);
			return [
				sample._row,
				dominant?.cellType ?? "",
				dominant ? (dominant.value * 100).toFixed(1) : "",
				...cellTypes.map((cellType) =>
					formatPercent(sample[cellType]).replace("%", "")
				),
			];
		});

		const csvContent = [
			header.join(","),
			...rows.map((row) => row.join(",")),
		].join("\n");

		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const link = document.createElement("a");
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		const now = new Date();
		const timestamp = now.toISOString().split("T")[0];
		link.setAttribute("download", `deconvolution_results_${timestamp}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		<div className="w-full">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<p className="text-xs text-muted-foreground">
					Percentages are shown for uploaded samples. The dominant estimate is
					the largest cell-state fraction per sample.
				</p>
				<Button
					onClick={exportToCsv}
					variant="outline"
					size="sm"
					className="flex items-center gap-2"
				>
					<Download className="h-4 w-4" />
					Export CSV
				</Button>
			</div>
			<Table className="border-collapse">
				<TableHeader>
					<TableRow className="bg-muted/50">
						<TableHead className="w-[220px] font-semibold text-left">
							Sample
						</TableHead>
						<TableHead className="font-semibold text-left">
							Dominant estimate
						</TableHead>
						<TableHead className="font-semibold text-right">
							Dominant %
						</TableHead>
						{cellTypes.map((cellType) => (
							<TableHead
								key={cellType}
								className="hidden lg:table-cell font-semibold text-right"
							>
								{cellType}
							</TableHead>
						))}
						<TableHead className="w-[50px] lg:hidden"></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{samples.map((sample) => {
						const dominant = getDominantEstimate(sample, cellTypes);
						return (
							<Fragment key={sample._row}>
								<TableRow
									className="hover:bg-muted/40 cursor-pointer border-b text-left"
									onClick={() =>
										setExpandedRow(
											expandedRow === sample._row ? null : sample._row
										)
									}
								>
									<TableCell className="font-medium">{sample._row}</TableCell>
									<TableCell>{dominant?.cellType ?? "-"}</TableCell>
									<TableCell className="text-right">
										{dominant ? formatPercent(dominant.value) : "-"}
									</TableCell>
									{cellTypes.map((cellType) => (
										<TableCell
											key={cellType}
											className="hidden lg:table-cell text-right"
										>
											{formatPercent(sample[cellType])}
										</TableCell>
									))}
									<TableCell className="lg:hidden text-center">
										{expandedRow === sample._row ? (
											<ChevronUp className="ml-auto h-4 w-4" />
										) : (
											<ChevronDown className="ml-auto h-4 w-4" />
										)}
									</TableCell>
								</TableRow>
								{expandedRow === sample._row && (
									<TableRow className="lg:hidden bg-muted/30">
										<TableCell colSpan={4} className="p-4">
											{cellTypes.map((cellType) => (
												<div
													key={cellType}
													className="flex justify-between py-1"
												>
													<span className="font-medium">{cellType}:</span>
													<span>{formatPercent(sample[cellType])}</span>
												</div>
											))}
										</TableCell>
									</TableRow>
								)}
							</Fragment>
						);
					})}
				</TableBody>
			</Table>
			<p className="text-sm text-muted-foreground mt-4 text-left">
				Disclaimer: Cell type estimation may not be fully accurate and depends
				on the reference set used for the deconvolution.
			</p>
		</div>
	);
}
