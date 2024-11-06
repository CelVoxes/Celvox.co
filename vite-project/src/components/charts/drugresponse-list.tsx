"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button"; // Import the Button component

import {
	Table,
	TableHeader,
	TableRow,
	TableBody,
	TableCell,
} from "@/components/ui/table";

import { fetchDrugResponseData } from "@/utils/api";
import { useEffect, useState } from "react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"; // Import Select components

interface DrugResponse {
	sample_id: string;
	inhibitor: string;
	auc: number;
}

export function ClusterAssociationCard() {
	const [drugResponseData, setDrugResponseData] = useState<DrugResponse[]>([]);
	const [selectedDrug, setSelectedDrug] = useState<string>("");
	const [selectedMetadata, setSelectedMetadata] = useState<string>("clusters"); // State for selected metadata
	const [clusterData, setClusterData] = useState<{
		[key: string]: { count: number; avgAUC: number };
	}>({});
	const [isLoading, setIsLoading] = useState(false);

	const handleFetchData = async () => {
		setIsLoading(true);
		try {
			const rawData = await fetchDrugResponseData();
			const transformedData = rawData.sample_id.map((_: unknown, i: number) => {
				const entry: Record<string, unknown> = {};
				Object.keys(rawData).forEach((key) => {
					entry[key] = rawData[key][i];
				});
				return entry;
			});
			setDrugResponseData(transformedData);
			const drugs = Array.from(
				new Set(
					transformedData
						.map((item: DrugResponse) => item.inhibitor)
						.filter(Boolean)
				)
			);
			setSelectedDrug(drugs[0] as string);
		} catch (error) {
			console.error("Failed to load drug response data:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (drugResponseData.length > 0 && selectedDrug) {
			const filteredData = drugResponseData.filter(
				(item) => item.inhibitor === selectedDrug
			);

			const newClusterData: {
				[key: string]: { count: number; avgAUC: number };
			} = {};
			filteredData.forEach((item) => {
				const cluster = item[selectedMetadata as keyof DrugResponse]; // Use selected metadata
				if (!newClusterData[cluster]) {
					newClusterData[cluster] = { count: 0, avgAUC: 0 };
				}
				newClusterData[cluster].count += 1;
				newClusterData[cluster].avgAUC += item.auc;
			});

			Object.keys(newClusterData).forEach((cluster) => {
				newClusterData[cluster].avgAUC /= newClusterData[cluster].count;
			});

			// Sort clusters by average AUC
			const sortedClusterData = Object.entries(newClusterData).sort(
				([, a], [, b]) => b.avgAUC - a.avgAUC
			);

			setClusterData(Object.fromEntries(sortedClusterData));
		}
	}, [drugResponseData, selectedDrug, selectedMetadata]);

	return (
		<Card className="h-full w-full">
			<CardHeader>
				<CardTitle>Drug Response List</CardTitle>
			</CardHeader>
			<CardContent className="flex-grow flex flex-col space-y-4 min-h-[400px]">
				{drugResponseData.length === 0 ? (
					<div className="flex-grow flex items-center justify-center">
						<p className="text-center text-gray-500">
							Click "Fetch Data" to get drug response table
						</p>
					</div>
				) : (
					<ScrollArea className="h-[400px] w-full">
						<Table>
							<TableHeader>
								<TableRow>
									<TableCell className="font-semibold">Cluster</TableCell>
									<TableCell className="font-semibold">Count</TableCell>
									<TableCell className="font-semibold">Avg AUC</TableCell>
								</TableRow>
							</TableHeader>
							<TableBody>
								{Object.entries(clusterData).map(
									([cluster, { count, avgAUC }]) => (
										<TableRow key={cluster}>
											<TableCell>{cluster}</TableCell>
											<TableCell>{count}</TableCell>
											<TableCell>{avgAUC.toFixed(2)}</TableCell>
										</TableRow>
									)
								)}
							</TableBody>
						</Table>
					</ScrollArea>
				)}
				<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
					<Select value={selectedDrug} onValueChange={setSelectedDrug}>
						<SelectTrigger className="w-full sm:w-[180px]">
							<SelectValue placeholder="Select Drug" />
						</SelectTrigger>
						<SelectContent>
							{Array.from(
								new Set(drugResponseData.map((item) => item.inhibitor))
							).map((drug) => (
								<SelectItem key={drug} value={drug}>
									{drug}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={selectedMetadata} onValueChange={setSelectedMetadata}>
						<SelectTrigger className="w-full sm:w-[180px]">
							<SelectValue placeholder="Select Metadata" />
						</SelectTrigger>
						<SelectContent>
							{[
								"clusters",
								"family",
								"sex",
								"tissue",
								"prim_rec",
								"FAB",
								"WHO_2022",
								"ICC_2022",
								"KMT2A_diagnosis",
								"rare_diagnosis",
								"study",
								"blasts",
								"age",
							].map((meta) => (
								<SelectItem key={meta} value={meta}>
									{meta}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						onClick={handleFetchData}
						disabled={isLoading}
						className="w-full sm:w-auto"
					>
						{isLoading ? "Loading..." : "Fetch Data"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
