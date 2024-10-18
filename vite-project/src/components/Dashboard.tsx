"use client";

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
// import { AIchat } from "@/components/AI-chat";

export const description = "A collection of AML samples.";

export function Dashboard() {
	const [activeTab, setActiveTab] = useState("tsne");

	return (
		<>
			<div className="space-y-6 h-full w-full">
				<div className="bg-gradient-to-r from-purple-100 to-blue-100 p-6 rounded-lg shadow-md">
					<h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text mb-4">
						AML Data Dashboard
					</h1>
					<p className="text-sm text-gray-700 text-justify p-4">
						This dashboard offers a comprehensive view of AML molecular data,
						including t-SNE visualizations, deconvolution analysis, drug
						response data, and mutation information. Users can upload samples,
						explore gene expression patterns, examine cellular composition,
						investigate drug responses, and analyze genetic mutations. The
						package is designed for HPC clusters, ensuring efficient and secure
						analysis of large datasets.
					</p>
				</div>
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
					<div className=" w-full">
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
					</div>
				</div>
				<div className={activeTab === "ask-ai" ? "" : "hidden"}>
					<div className="flex flex-col items-center justify-center h-64 space-y-4">
						<div className="text-2xl font-bold text-purple-600">
							AI Assistant Coming Soon!
						</div>
						<div className="animate-pulse">
							<svg
								className="w-16 h-16 text-blue-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
								/>
							</svg>
						</div>
					</div>
					{/* TODO: Add AI chat */}
					{/* <AIchat />  */}
				</div>
			</div>
		</>
	);
}
