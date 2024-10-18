"use client";

import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button"; // Import the Button component

import {
	Table,
	TableHeader,
	TableRow,
	TableHead,
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

export function ClusterAssociationCard() {
	const [drugResponseData, setDrugResponseData] = useState<any[]>([]);
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
			const transformedData = Array.from(
				{ length: rawData.sample_id.length },
				(_, i) => ({
					sample_id: rawData.sample_id[i],
					inhibitor: rawData.inhibitor[i],
					auc: rawData.auc[i],
					clusters: rawData["clusters"][i],
					family: rawData["family"][i],
					sex: rawData["sex"][i],
					tissue: rawData["tissue"][i],
					prim_rec: rawData["prim_rec"][i],
					FAB: rawData["FAB"][i],
					WHO_2022: rawData["WHO_2022"][i],
					ICC_2022: rawData["ICC_2022"][i],
					KMT2A_diagnosis: rawData["KMT2A_diagnosis"][i],
					rare_diagnosis: rawData["rare_diagnosis"][i],
					study: rawData["study"][i],
					blasts: rawData["blasts"][i],
					age: rawData["age"][i],
					// Add other metadata fields here if needed
				})
			);
			setDrugResponseData(transformedData);
			const drugs = Array.from(
				new Set(transformedData.map((item) => item.inhibitor).filter(Boolean))
			);
			setSelectedDrug(drugs[0]);
		} catch (error) {
			console.error("Failed to load drug response data:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		handleFetchData();
	}, []);

	useEffect(() => {
		if (drugResponseData.length > 0 && selectedDrug) {
			const filteredData = drugResponseData.filter(
				(item) => item.inhibitor === selectedDrug
			);

			const newClusterData: {
				[key: string]: { count: number; avgAUC: number };
			} = {};
			filteredData.forEach((item) => {
				const cluster = item[selectedMetadata]; // Use selected metadata
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
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Drug Response List</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[400px]">
					<Table className="w-full border-collapse">
						<TableHeader>
							<TableRow>
								<TableCell className="text-left">Cluster</TableCell>
								<TableCell className="text-left">Count</TableCell>
								<TableCell className="text-left">Avg AUC</TableCell>
							</TableRow>
						</TableHeader>
						<TableBody className="text-sm justify-left">
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
				<div className="flex gap-4 mt-4 items-center">
					<Select value={selectedDrug} onValueChange={setSelectedDrug}>
						<SelectTrigger className="w-[180px]">
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
						<SelectTrigger className="w-[180px]">
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
							].map(
								(
									meta // Add other metadata options here
								) => (
									<SelectItem key={meta} value={meta}>
										{meta}
									</SelectItem>
								)
							)}
						</SelectContent>
					</Select>
					<Button onClick={handleFetchData} disabled={isLoading}>
						{isLoading ? "Loading..." : "Fetch Data"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
