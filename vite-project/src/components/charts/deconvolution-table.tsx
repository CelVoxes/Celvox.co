import { Fragment } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface DeconvolutionTableProps {
	data: {
		[sampleId: string]: {
			[cellType: string]: number | string;
			_row: string;
		};
	} | null;
}

export function DeconvolutionTable({ data }: DeconvolutionTableProps) {
	const [expandedRow, setExpandedRow] = useState<string | null>(null);

	if (!data) return null;

	const samples = Object.values(data);
	const cellTypes = Object.keys(samples[0]).filter((key) => key !== "_row");

	const exportToCsv = () => {
		if (!data) return;

		// Create CSV header
		const header = ["Sample", ...cellTypes.map((type) => `${type}%`)];

		// Create CSV rows
		const rows = samples.map((sample) => [
			sample._row,
			...cellTypes.map((cellType) =>
				((sample[cellType] as number) * 100).toFixed(2)
			),
		]);

		// Combine header and rows
		const csvContent = [
			header.join(","),
			...rows.map((row) => row.join(",")),
		].join("\n");

		// Create and trigger download
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
		<div className="overflow-x-auto w-full flex justify-center">
			<div className="max-w-[1200px] w-full">
				<div className="flex justify-end mb-4">
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
						<TableRow className="bg-slate-100">
							<TableHead className="w-[200px] font-semibold text-left">
								Sample
							</TableHead>
							{cellTypes.map((cellType) => (
								<TableHead
									key={cellType}
									className="hidden md:table-cell font-semibold text-center"
								>
									{cellType}%
								</TableHead>
							))}
							<TableHead className="w-[50px] md:hidden"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{samples.map((sample) => (
							<Fragment key={sample._row}>
								<TableRow
									className="hover:bg-slate-50 cursor-pointer border-b text-left"
									onClick={() =>
										setExpandedRow(
											expandedRow === sample._row ? null : sample._row
										)
									}
								>
									<TableCell className="font-medium">{sample._row}</TableCell>
									{cellTypes.map((cellType) => (
										<TableCell
											key={cellType}
											className="hidden md:table-cell text-center"
										>
											{((sample[cellType] as number) * 100).toFixed(2)}
										</TableCell>
									))}
									<TableCell className="md:hidden text-center">
										{expandedRow === sample._row ? (
											<ChevronUp className="ml-auto h-4 w-4" />
										) : (
											<ChevronDown className="ml-auto h-4 w-4" />
										)}
									</TableCell>
								</TableRow>
								{expandedRow === sample._row && (
									<TableRow className="md:hidden bg-slate-50">
										<TableCell colSpan={2} className="p-4">
											{cellTypes.map((cellType) => (
												<div
													key={cellType}
													className="flex justify-between py-1"
												>
													<span className="font-medium">{cellType}:</span>
													<span>
														{((sample[cellType] as number) * 100).toFixed(2)}%
													</span>
												</div>
											))}
										</TableCell>
									</TableRow>
								)}
							</Fragment>
						))}
					</TableBody>
				</Table>
				<p className="text-sm text-gray-500 mt-4 text-left p-2">
					Disclaimer: Cell type estimation may not be fully accurate and depends
					on the reference set used for the deconvolution.
				</p>
			</div>
		</div>
	);
}
