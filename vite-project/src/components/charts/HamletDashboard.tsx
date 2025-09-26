import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	HamletUpload,
	HamletData,
} from "@/components/data-upload/HamletUpload";
import { GenomicSummary } from "@/components/charts/hamlet-charts/GenomicSummary";
import { ExpressionPanel } from "@/components/charts/hamlet-charts/ExpressionPanel";
import { CellTypePanel } from "@/components/charts/hamlet-charts/CellTypePanel";
import { ITDPanel } from "@/components/charts/hamlet-charts/ITDPanel";
import { SubtypePanel } from "@/components/charts/hamlet-charts/SubtypePanel";

export function HamletDashboard() {
	const [hamletData, setHamletData] = useState<HamletData | null>(null);

	const handleDataLoaded = (data: HamletData) => {
		setHamletData(data);
	};

	if (!hamletData) {
		return (
			<div className="space-y-6">
				<HamletUpload onDataLoaded={handleDataLoaded} />
				<Card className="w-full">
					<CardContent className="p-8 text-center">
						<p className="text-lg text-gray-600">
							Upload a HAMLET output file to begin exploring genomic analysis
							results.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<HamletUpload onDataLoaded={handleDataLoaded} currentData={hamletData} />

			<Card>
				<CardHeader>
					<CardTitle>HAMLET Analysis Dashboard</CardTitle>
					<p className="text-sm text-gray-600">
						Sample:{" "}
						<span className="font-medium">
							{hamletData.metadata.sample_name}
						</span>{" "}
						| Pipeline Version:{" "}
						<span className="font-medium">
							{hamletData.metadata.pipeline_version}
						</span>
					</p>
				</CardHeader>
			</Card>

			<Tabs defaultValue="genomic" className="space-y-4">
				<TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
					<TabsTrigger value="genomic">Genomic Analysis</TabsTrigger>
					<TabsTrigger value="expression">Gene Expression</TabsTrigger>
					<TabsTrigger value="celltypes">Cell Types</TabsTrigger>
					<TabsTrigger value="itd">Internal Tandem Duplications</TabsTrigger>
					<TabsTrigger value="subtype">AML Subtype</TabsTrigger>
				</TabsList>

				<TabsContent value="genomic">
					<GenomicSummary data={hamletData} />
				</TabsContent>

				<TabsContent value="expression">
					<ExpressionPanel
						data={hamletData.modules.expression["gene-expression"]}
						genesOfInterest={hamletData.metadata.genes_of_interest}
					/>
				</TabsContent>

				<TabsContent value="celltypes">
					<CellTypePanel
						data={{
							[hamletData.metadata.sample_name]: hamletData.modules.expression[
								"cell-types"
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
							].data as any,
						}}
						plot={hamletData.modules.expression["cell-types"].plot}
					/>
				</TabsContent>

				<TabsContent value="itd">
					<ITDPanel
						flt3={hamletData.modules.itd.flt3}
						kmt2a={hamletData.modules.itd.kmt2a}
						sampleName={hamletData.metadata.sample_name}
					/>
				</TabsContent>

				<TabsContent value="subtype">
					<SubtypePanel
						subtype={hamletData.modules.expression.subtype}
						sampleName={hamletData.metadata.sample_name}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
