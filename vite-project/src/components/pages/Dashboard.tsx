"use client";

import { useState } from "react";
import { SeamlessHeader } from "@/components/charts/SeamlessHeader";
import { DeconvolutionChart } from "@/components/charts/deconvolution";
import { TSNEChart } from "@/components/charts/tsne-chart";
import { DrugResponseTSNE } from "@/components/charts/tsne-drugresponse";
import { MutationTSNE } from "@/components/charts/tsne-mutation";
import { DataUpload } from "@/components/data-upload/DataUpload";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneExpressionTSNE } from "@/components/charts/tsne-expression";
import { ClusterAssociationCard } from "@/components/charts/drugresponse-list";
import { HarmonizeData } from "@/components/charts/HarmonizeData";
import { TSNEKNNChart } from "@/components/charts/tsne-knn";
import { KNNReport } from "@/components/charts/knn-report";
import { KNNReportMutation } from "@/components/charts/knn-report-mutation";
import { DrugEffectivenessReport } from "@/components/charts/drug-effectiveness-report";
import { AIAMLReport } from "@/components/charts/AI-report";
import QCCharts from "@/components/charts/QCmetrics";
import { Navbar } from "../header/Navbar";
import { User } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { KNNReportExpression } from "@/components/charts/knn-report-expression";
import { DrugResponseHeatmap } from "@/components/charts/drug-response-per-group";
export const description = "A collection of AML samples.";

export function Dashboard({ user }: { user: User | null }) {
	const [activeTab, setActiveTab] = useState("qc");

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return (
		<>
			{user && (
				<div className="space-y-6 h-full w-full">
					<Navbar />
					<SeamlessHeader />
					<DataUpload />
					<HarmonizeData />

					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="w-full"
					>
						<TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full gap-1 p-1">
							<TabsTrigger
								value="qc"
								className="w-full data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground"
							>
								QC Metrics
							</TabsTrigger>
							<TabsTrigger
								value="tsne"
								className="w-full data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground"
							>
								t-SNE
							</TabsTrigger>
							<TabsTrigger
								value="knn"
								className="w-full data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground"
							>
								KNN Report
							</TabsTrigger>
							<TabsTrigger
								value="deconvolution"
								className="w-full data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground"
							>
								Deconvolution
							</TabsTrigger>
							<TabsTrigger
								value="drug"
								className="w-full data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground"
							>
								Drug Response
							</TabsTrigger>
							<TabsTrigger
								value="ask-ai"
								className="w-full data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground"
							>
								Artificial Intelligence
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<div className={activeTab === "qc" ? "" : "hidden"}>
						<QCCharts />
					</div>
					<div className={activeTab === "tsne" ? "" : "hidden"}>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<TSNEChart />
							<MutationTSNE />
							<GeneExpressionTSNE />
							<TSNEKNNChart />
						</div>
					</div>
					<div className={activeTab === "knn" ? "" : "hidden"}>
						<div className="grid grid-cols-1 md:grid-cols-1 gap-4">
							<KNNReport />
							<KNNReportMutation />
							<KNNReportExpression />
						</div>
					</div>

					<div className={activeTab === "deconvolution" ? "" : "hidden"}>
						<DeconvolutionChart />
					</div>
					<div className={activeTab === "drug" ? "" : "hidden"}>
						<div className="grid grid-cols-1 gap-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<DrugResponseTSNE />
								<ClusterAssociationCard />
							</div>
							<DrugResponseHeatmap />
							<DrugEffectivenessReport />
						</div>
					</div>
					<div className={activeTab === "ask-ai" ? "" : "hidden"}>
						<AIAMLReport />
					</div>
				</div>
			)}
		</>
	);
}
