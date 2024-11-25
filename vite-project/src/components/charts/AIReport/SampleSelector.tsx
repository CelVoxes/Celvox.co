import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

// Define a type for the tsneData items
type TSNEDataItem = {
	sample_id: string;
	data_source: string;
	// Add other properties if needed
};
const SampleSelector = ({
	tsneData,
	selectedSample,
	setSelectedSample,
}: {
	tsneData: TSNEDataItem[];
	selectedSample: string | null;
	setSelectedSample: (sample: string) => void;
}) => (
	<div className="flex flex-col space-y-2">
		<span className="text-sm font-medium">Sample:</span>
		<Select
			onValueChange={setSelectedSample}
			value={selectedSample || undefined}
		>
			<SelectTrigger className="w-full text-sm">
				<SelectValue placeholder="Select a sample" />
			</SelectTrigger>
			<SelectContent>
				{tsneData
					.filter((d) => d.data_source === "uploaded")
					.map((sample) => (
						<SelectItem
							key={sample.sample_id}
							value={sample.sample_id}
							className="truncate"
						>
							{sample.sample_id}
						</SelectItem>
					))}
			</SelectContent>
		</Select>
	</div>
);

export default SampleSelector;
