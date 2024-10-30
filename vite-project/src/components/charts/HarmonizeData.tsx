import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { fetchHarmonizedData } from "@/utils/api";

export function HarmonizeData() {
	const [isHarmonizing, setIsHarmonizing] = useState(false);
	const { toast } = useToast();

	const handleHarmonize = async () => {
		setIsHarmonizing(true);
		try {
			const response = await fetchHarmonizedData();
			if (!response.message) {
				throw new Error("Failed to harmonize data");
			}

			toast({
				title: "Harmonization Complete",
				description: response.message,
			});
		} catch (error) {
			console.error("Error harmonizing data:", error);
			toast({
				title: "Harmonization Failed",
				description: "An error occurred while harmonizing data.",
				variant: "destructive",
			});
		} finally {
			setIsHarmonizing(false);
		}
	};

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Data Harmonization</CardTitle>
				<CardDescription>
					Harmonize your uploaded data to the existing reference. It will create a normalized and corrected version of the integrated data.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button onClick={handleHarmonize} disabled={isHarmonizing}>
					{isHarmonizing ? "Harmonizing..." : "Harmonize Data"}
				</Button>
			</CardContent>
		</Card>
	);
}

export default HarmonizeData;
