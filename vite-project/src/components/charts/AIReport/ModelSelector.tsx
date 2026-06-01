import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface ModelSelectorProps {
	selectedModel: string;
	setSelectedModel: (model: string) => void;
}

const ModelSelector = ({
	selectedModel,
	setSelectedModel,
}: ModelSelectorProps) => (
	<div className="flex flex-col space-y-2">
		<span className="text-sm font-medium">Model:</span>
		<Select onValueChange={setSelectedModel} value={selectedModel}>
			<SelectTrigger className="w-full text-sm">
				<SelectValue placeholder="Select a model" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="gpt-5.4-mini">GPT-5.4 mini</SelectItem>
				<SelectItem value="gpt-5.4">GPT-5.4</SelectItem>
				<SelectItem value="gpt-4.1-mini">GPT-4.1 mini</SelectItem>
			</SelectContent>
		</Select>
	</div>
);

export default ModelSelector;
