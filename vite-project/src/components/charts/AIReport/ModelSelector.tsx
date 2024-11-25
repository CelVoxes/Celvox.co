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
				<SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
				<SelectItem value="gpt-4o">GPT-4o</SelectItem>
				<SelectItem value="gpt-o1-mini">GPT-o1-mini</SelectItem>
			</SelectContent>
		</Select>
	</div>
);

export default ModelSelector;
