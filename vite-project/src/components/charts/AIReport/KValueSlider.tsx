import { Slider } from "@/components/ui/slider";

interface KValueSliderProps {
	kValue: number;
	setKValue: (value: number) => void;
}

const KValueSlider: React.FC<KValueSliderProps> = ({ kValue, setKValue }) => (
	<div className="flex flex-col space-y-2">
		<span className="text-sm font-medium">K Value:</span>
		<div className="flex items-center space-x-2">
			<div className="flex-1">
				<Slider
					value={[kValue]}
					onValueChange={(value) => setKValue(value[0])}
					max={50}
					min={5}
					step={1}
				/>
			</div>
			<span className="w-8 text-sm text-right">{kValue}</span>
		</div>
	</div>
);

export default KValueSlider;
