import { useState, useEffect } from "react";
import {
	fetchHarmonizedData,
	fetchSampleDataNames,
	fetchHarmonizedDataNames,
} from "@/utils/api";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function HarmonizeData() {
	const [samples, setSamples] = useState<string[]>([]);
	const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	const { toast } = useToast();
	const [isHarmonizing, setIsHarmonizing] = useState(false);
	const [harmonizedSamples, setHarmonizedSamples] = useState<string[]>([]);

	useEffect(() => {
		const loadSamples = async () => {
			try {
				const sampleData = await fetchSampleDataNames();
				if (sampleData && sampleData.length > 0) {
					console.log("Sample data:", sampleData);
					setSamples(sampleData.slice(1));
				}
			} catch (error) {
				console.error("Error fetching samples:", error);
				toast({
					title: "Error",
					description: "Failed to fetch sample data. Please try again.",
					variant: "destructive",
				});
			}

			try {
				const harmonizedData = await fetchHarmonizedDataNames();
				if (harmonizedData) {
					console.log("Harmonized data:", harmonizedData);
					setHarmonizedSamples(harmonizedData);
				} else {
					setHarmonizedSamples([]);
				}
			} catch (error) {
				console.error("Error fetching harmonized data:", error);
				setHarmonizedSamples([]);
			}
		};

		loadSamples();
	}, []);

	const filteredSamples = samples.filter((sample) =>
		sample.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const unharmonizedSamples = filteredSamples.filter(
		(sample) => !harmonizedSamples.includes(sample)
	);

	const handleSelectAll = () => {
		setSelectedSamples(unharmonizedSamples);
	};

	const handleSelectNone = () => {
		setSelectedSamples([]);
	};

	const handleHarmonize = async () => {
		const alreadyHarmonized = selectedSamples.filter((sample) =>
			harmonizedSamples.includes(sample)
		);

		if (alreadyHarmonized.length > 0) {
			toast({
				title: "Warning",
				description:
					"Some selected samples are already harmonized. Please deselect them before continuing.",
				variant: "destructive",
			});
			return;
		}

		setIsHarmonizing(true);
		try {
			await fetchHarmonizedData(selectedSamples);
			const updatedHarmonizedData = await fetchHarmonizedDataNames();
			setHarmonizedSamples(updatedHarmonizedData || []);
			setSelectedSamples([]);
			toast({
				title: "Success",
				description: "Data harmonization completed successfully.",
				variant: "default",
			});
		} catch (error) {
			console.error("Error harmonizing data:", error);
			toast({
				title: "Error",
				description: "Failed to harmonize data. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsHarmonizing(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Harmonize Data</CardTitle>
				<CardDescription>
					Select samples to be harmonized with the existing database.{" "}
				</CardDescription>
				<div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
					<Input
						placeholder="Search samples..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="sm:max-w-[300px]"
					/>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={handleSelectAll}
							className="whitespace-nowrap flex-1 sm:flex-none"
						>
							Select All ({unharmonizedSamples.length})
						</Button>
						<Button
							variant="outline"
							onClick={handleSelectNone}
							className="whitespace-nowrap flex-1 sm:flex-none"
						>
							Clear All
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="text-sm text-muted-foreground mb-2">
					{selectedSamples.length} samples selected
				</div>
				<ScrollArea className="h-[400px] sm:h-[400px] w-full border rounded-md p-4">
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
						{filteredSamples.map((sample) => {
							const isHarmonized = harmonizedSamples.includes(sample);
							return (
								<div key={sample} className="flex items-center space-x-2 py-2">
									<Checkbox
										id={sample}
										checked={selectedSamples.includes(sample)}
										onCheckedChange={(checked) => {
											if (checked) {
												setSelectedSamples([...selectedSamples, sample]);
											} else {
												setSelectedSamples(
													selectedSamples.filter((s) => s !== sample)
												);
											}
										}}
									/>
									<label
										htmlFor={sample}
										className={`text-xs cursor-pointer truncate ${
											isHarmonized
												? "text-muted-foreground line-through"
												: "hover:text-blue-600"
										}`}
									>
										{sample}
										{isHarmonized && " (harmonized)"}
									</label>
								</div>
							);
						})}
						{filteredSamples.length === 0 && (
							<div className="text-center text-muted-foreground py-4">
								No samples found matching "{searchTerm}"
							</div>
						)}
					</div>
				</ScrollArea>
				<Button
					onClick={handleHarmonize}
					className="mt-4 w-full"
					disabled={
						selectedSamples.length === 0 ||
						isHarmonizing ||
						selectedSamples.some((sample) => harmonizedSamples.includes(sample))
					}
				>
					{isHarmonizing
						? "Harmonizing..."
						: `Harmonize Data (${selectedSamples.length} samples)`}
				</Button>
			</CardContent>
		</Card>
	);
}
