import { useState, useEffect } from "react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
	fetchTSNEData,
	fetchKNNData,
	fetchMutationTSNEData,
} from "@/utils/api";
import { processData, generateAIReport } from "./reportUtils";
import SampleSelector from "./SampleSelector";
import ModelSelector from "./ModelSelector";
import KValueSlider from "./KValueSlider";
import ReportDisplay from "./ReportDisplay";

type TSNEDataItem = {
	sample_id: string;
	data_source: string;
	// Add other properties if needed
};

export function AIAMLReport() {
	const [report, setReport] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [visibleChars, setVisibleChars] = useState(0);
	const [progress, setProgress] = useState(0);
	const { toast } = useToast();
	const [selectedSample, setSelectedSample] = useState<string | null>(null);
	const [tsneData, setTsneData] = useState<TSNEDataItem[]>([]);
	const [kValue, setKValue] = useState(20);
	const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-mini");

	useEffect(() => {
		fetchTSNEData().then(setTsneData).catch(console.error);
	}, []);

	useEffect(() => {
		if (report) {
			let charIndex = 0;
			const intervalId = setInterval(() => {
				if (charIndex < report.length) {
					setVisibleChars(charIndex + 2);
					setProgress(((charIndex + 2) / report.length) * 100);
					charIndex += 2;
				} else {
					clearInterval(intervalId);
					setProgress(100);
				}
			}, 10);
			return () => clearInterval(intervalId);
		}
	}, [report]);

	const generateReport = async () => {
		if (!selectedSample) {
			toast({
				title: "Error",
				description: "Please select a sample before generating the report.",
				variant: "destructive",
			});
			return;
		}
		setIsLoading(true);
		try {
			const [knnData, mutationData] = await Promise.all([
				fetchKNNData(kValue),
				fetchMutationTSNEData(),
			]);
			const processedData = processData(
				selectedSample,
				knnData,
				// drugResponseData,
				mutationData,
				tsneData,
				kValue
			);
			if (processedData) {
				const aiReport = await generateAIReport(processedData, selectedModel);
				setReport(aiReport);
			} else {
				setReport("Failed to process data. Please try again.");
			}
		} catch (error) {
			console.error("Error generating report:", error);
			setReport("Failed to generate report. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const copyToClipboard = () => {
		navigator.clipboard.writeText(report).then(() => {
			toast({ title: "Copied!", description: "Report copied to clipboard" });
		});
	};

	return (
		<Card className="w-full max-w-full overflow-x-hidden">
			<CardHeader>
				<CardTitle>
					<div className="text-lg md:text-2xl font-bold text-purple-600">
						AI Assistant
					</div>
					<div className="text-xs md:text-sm text-blue-600">(Experimental)</div>
				</CardTitle>
				<CardDescription className="text-xs md:text-sm">
					Leverage AI to gain insights into uploaded samples
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6 px-2 md:px-4">
				<SampleSelector
					tsneData={tsneData}
					selectedSample={selectedSample}
					setSelectedSample={setSelectedSample}
				/>
				<ModelSelector
					selectedModel={selectedModel}
					setSelectedModel={setSelectedModel}
				/>
				<KValueSlider kValue={kValue} setKValue={setKValue} />
				<Button
					onClick={generateReport}
					disabled={isLoading || !selectedSample}
					className="w-full text-sm"
				>
					{isLoading ? (
						<div className="items-center space-x-2 flex">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span>Analyzing...</span>
						</div>
					) : (
						<span>Generate Report</span>
					)}
				</Button>
				{report && (
					<ReportDisplay
						report={report}
						visibleChars={visibleChars}
						progress={progress}
						copyToClipboard={copyToClipboard}
					/>
				)}
			</CardContent>
			<CardFooter className="text-center text-xs px-2 md:px-4 text-gray-500">
				AI models may not always be accurate. Always consult with medical
				professionals.
			</CardFooter>
		</Card>
	);
}

export default AIAMLReport;
