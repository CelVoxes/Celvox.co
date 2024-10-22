"use client";

import { Header } from "@/components/Header";
import { DeconvolutionChart } from "@/components/deconvolution";
import { TSNEChart } from "@/components/tsne-chart";
import { DrugResponseTSNE } from "@/components/tsne-drugresponse";
import { MutationTSNE } from "@/components/tsne-mutation";
import { DataUpload } from "@/components/DataUpload";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneExpressionTSNE } from "@/components/tsne-expression";
import { useState } from "react";
import { ClusterAssociationCard } from "@/components/drugresponse-list";
import { HarmonizeData } from "@/components/HarmonizeData";
import { TSNEKNNChart } from "@/components/tsne-knn";
import { KNNReport } from "@/components/knn-report";
import { KNNReportMutation } from "@/components/knn-report-mutation";
import { DrugEffectivenessReport } from "@/components/drug-effectiveness-report";
import { AIAMLReport } from "@/components/AI-report";
export const description = "A collection of AML samples.";

export function Dashboard() {
	const [activeTab, setActiveTab] = useState("tsne");

	return (
		<>
			<div className="space-y-6 h-full w-full">
				<Header />
				<DataUpload />
				<HarmonizeData />

				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList>
						<TabsTrigger value="tsne">t-SNE</TabsTrigger>
						<TabsTrigger value="knn">KNN Report</TabsTrigger>
						<TabsTrigger value="deconvolution">Deconvolution</TabsTrigger>
						<TabsTrigger value="drug">Drug Response</TabsTrigger>
						<TabsTrigger value="ask-ai">Artificial Intelligence</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className={activeTab === "tsne" ? "" : "hidden"}>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<TSNEChart />
						<MutationTSNE />
						<GeneExpressionTSNE />
						<TSNEKNNChart />
					</div>
				</div>
				<div className={activeTab === "knn" ? "" : "hidden"}>
					<div className="grid grid-cols-1 md:grid-cols-1 gap-6">
						<KNNReport />
						<KNNReportMutation />
					</div>
				</div>

				<div className={activeTab === "deconvolution" ? "" : "hidden"}>
					<DeconvolutionChart />
				</div>
				<div className={activeTab === "drug" ? "" : "hidden"}>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<DrugResponseTSNE />
						<ClusterAssociationCard />
						<DrugEffectivenessReport />
					</div>
				</div>
				<div className={activeTab === "ask-ai" ? "" : "hidden"}>
					<AIAMLReport />
				</div>
			</div>
		</>
	);
}
