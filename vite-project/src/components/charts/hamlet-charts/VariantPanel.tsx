import { Card } from "@/components/ui/card";

interface VariantPanelProps {
	data: {
		coding_consequences: Record<string, number>;
		num_snvs: number;
		num_deletions: number;
		num_insertions: number;
	};
}

export function VariantPanel({ data }: VariantPanelProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
			{data.coding_consequences && (
				<Card className="p-4">
					<h3 className="font-bold mb-4">Coding Consequences</h3>
					<div className="space-y-2">
						{Object.entries(data.coding_consequences).map(([key, value]) => (
							<div key={key} className="flex justify-between">
								<span className="text-sm">{key}</span>
								<span className="font-medium">{value}</span>
							</div>
						))}
					</div>
				</Card>
			)}

			<Card className="p-4">
				<h3 className="font-bold mb-4">Variant Statistics</h3>
				<div className="space-y-2">
					<div className="flex justify-between">
						<span className="text-sm">SNVs</span>
						<span className="font-medium">{data.num_snvs}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-sm">Deletions</span>
						<span className="font-medium">{data.num_deletions}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-sm">Insertions</span>
						<span className="font-medium">{data.num_insertions}</span>
					</div>
				</div>
			</Card>
		</div>
	);
}
