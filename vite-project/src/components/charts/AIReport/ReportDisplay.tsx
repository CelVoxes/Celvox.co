import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";

// Define a type for the props
interface ReportDisplayProps {
	report: string; // Assuming report is a string
	visibleChars: number;
	progress: number;
	copyToClipboard: () => void;
}

const ReportDisplay = ({
	report,
	visibleChars,
	progress,
	copyToClipboard,
}: ReportDisplayProps) => (
	<div className="bg-white p-2 md:p-6 w-full mt-4">
		<div
			className="transition-all duration-500 ease-in-out rounded-full"
			style={{
				width: `${progress}%`,
				height: "4px",
				backgroundColor: "#4F46E5",
			}}
		/>
		<Separator className="my-2" />
		<ReactMarkdown className="prose prose-sm max-w-none overflow-x-auto text-left">
			{report.slice(0, visibleChars)}
		</ReactMarkdown>
		<div className="mt-4 flex justify-end">
			<Button onClick={copyToClipboard} variant="outline" size="sm">
				<Copy className="w-3 h-3 mr-1.5" />
				<span className="text-xs">Copy Report</span>
			</Button>
		</div>
	</div>
);

export default ReportDisplay;
