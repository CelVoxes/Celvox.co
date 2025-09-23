import { Navbar } from "@/components/header/Navbar";
import { SiteFooter } from "@/components/Footer";
import cellama_logo from "@/assets/cellama.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Icons } from "@/components/icons";
import { useState } from "react";

export function Cellama() {
	const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>(
		{}
	);

	const copyToClipboard = async (text: string, key: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedStates((prev) => ({ ...prev, [key]: true }));
			setTimeout(() => {
				setCopiedStates((prev) => ({ ...prev, [key]: false }));
			}, 2000);
		} catch (err) {
			console.error("Failed to copy text: ", err);
		}
	};

	const CopyableCode = ({
		code,
		copyKey,
	}: {
		code: string;
		copyKey: string;
	}) => (
		<div className="relative text-gray-600 bg-gray-100 p-4 rounded-lg mt-3 group">
			<code className="text-sm text-gray-600">{code}</code>
			<button
				onClick={() => copyToClipboard(code, copyKey)}
				className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-gray-200"
				title="Copy to clipboard"
			>
				{copiedStates[copyKey] ? (
					<svg
						className="w-4 h-4 text-green-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				) : (
					<svg
						className="w-4 h-4 text-gray-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
				)}
			</button>
		</div>
	);

	return (
		<>
			<Navbar />

			{/* Hero Section */}
			<div className="max-w-7xl mx-auto px-0 md:px-0 md:mx-0 mt-10 md:mt-16">
				<Card className="mx-auto mb-12 md:mb-24 shadow-lg bg-gradient-to-br from-slate-600 via-neutral-900 to-slate-900">
					<CardContent>
						<div className="flex flex-col items-center justify-center text-center mb-2 p-0 md:p-8">
							{/* Quote */}
							<div className="mb-12">
								<blockquote className="text-lg md:text-xl font-light text-slate-200 italic leading-relaxed max-w-2xl mt-12">
									"We need merely to assume that changes in the genotype produce
									correlated changes in the adult phenotype, but the mechanism
									of this correlation need not concern us."
								</blockquote>
								<footer className="text-sm text-slate-400 mt-4">
									C.H. Waddington,{" "}
									<cite className="font-medium">The Epigenotype</cite>, 1942
								</footer>
							</div>

							<img
								src={cellama_logo}
								alt="CeLLama Logo"
								className="w-32 h-32 md:w-48 md:h-48 rounded-full mb-8 md:mb-12 mt-4 md:mt-4"
							/>
							<h1 className="text-4xl md:text-5xl text-center text-white tracking-tight font-black mb-4 md:mb-6 max-w-3xl  drop-shadow-lg">
								CeLLama
							</h1>

							<p className="text-xl md:text-2xl text-slate-50 max-w-2xl leading-relaxed font-semibold px-2 md:px-0 my-4">
								Open-source AI that makes cell type identification easy
							</p>

							<div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-4">
								<a
									href="https://github.com/Celvoxes/cellama"
									className="inline-block"
								>
									<Button className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 border-2 border-yellow-600 text-slate-100 font-bold px-16 py-6 rounded-xl text-md transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-yellow-400/60">
										<Icons.gitHub className="w-5 h-5 mr-2" />
										Get Started
									</Button>
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Main Content */}
			<div className="max-w-4xl mx-auto px-4 mb-24">
				<div className="space-y-16">
					{/* Problem & Solution */}
					<div className="grid md:grid-cols-2 gap-12 items-start text-left">
						<div className="space-y-4">
							<h2 className="text-2xl md:text-3xl font-black text-gray-700 mb-4">
								❌ The Problem
							</h2>
							<p className="text-lg text-gray-600 leading-relaxed">
								Scientists spent <strong>countless hours</strong> manually
								annotating single cell data. Traditional tools give you scores
								but never explain their reasoning.
							</p>
						</div>

						<div className="space-y-4">
							<h2 className="text-2xl md:text-3xl font-black text-gray-700 mb-4">
								✅ The Solution
							</h2>
							<p className="text-lg text-gray-600 leading-relaxed ">
								Using smart AI language models, CeLLama not only identifies cell
								types <strong>accurately</strong>, but explains its reasoning in
								plain English.
							</p>
						</div>
					</div>

					{/* How It Works */}
					<div className="text-center">
						<h2 className="text-3xl md:text-4xl font-black text-gray-700 mb-8 mt-48">
							How it works
						</h2>
						<p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
							Every living cell has a hidden story written in <i>genes</i> -
							tiny instructions that make each cell unique.
						</p>

						<div className="grid md:grid-cols-3 gap-8">
							<div className="text-center space-y-3">
								<div className="w-12 h-12 bg-slate-400 rounded-full flex items-center justify-center mx-auto text-white font-bold">
									1
								</div>
								<h3 className="text-lg font-semibold text-gray-700">
									Prepare Your Data
								</h3>
								<p className="text-gray-600">
									Set up your single-cell RNA-seq data and install an
									open-source LLM like Ollama
								</p>
								<CopyableCode code="ollama run gpt-oss" copyKey="ollama" />
							</div>
							<div className="text-center space-y-3">
								<div className="w-12 h-12 bg-slate-400 rounded-full flex items-center justify-center mx-auto text-white font-bold">
									2
								</div>
								<h3 className="text-lg font-semibold text-gray-700">
									Identify Cluster Markers
								</h3>
								<p className="text-gray-600">
									Use Seurat or Scanpy to find differentially expressed genes
									that characterize your cell clusters
								</p>
								<CopyableCode
									code="FindMarkers(seurat_object)"
									copyKey="findmarkers"
								/>
							</div>
							<div className="text-center space-y-3">
								<div className="w-12 h-12 bg-slate-400 rounded-full flex items-center justify-center mx-auto text-white font-bold">
									3
								</div>
								<h3 className="text-lg font-semibold text-gray-700">
									Run CeLLama
								</h3>
								<p className="text-gray-600">
									Run CeLLama to automatically identify cell types with natural
									language explanations
								</p>
								<CopyableCode
									code="ceLLama(cluster_markers)"
									copyKey="cellama"
								/>
							</div>
						</div>
					</div>

					{/* Features */}
					<div className="text-center">
						<h2 className="text-3xl md:text-4xl font-black text-gray-700 mb-4 mt-48">
							Key Features
						</h2>
						<p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
							What makes CeLLama different from traditional cell type annotation
							methods
						</p>

						<div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
							<Card className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-0 shadow-lg">
								<CardContent className="p-8">
									<div className="text-center space-y-6">
										<div className="w-20 h-20 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center mx-auto text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
											<svg
												className="w-10 h-10"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
												/>
											</svg>
										</div>
										<div>
											<h3 className="text-2xl font-bold text-gray-800 mb-3">
												Privacy
											</h3>
											<p className="text-gray-600 leading-relaxed">
												CeLLama operates entirely on your local machine,
												ensuring that your sensitive data remains secure and
												free from potential leaks.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-0 shadow-lg">
								<CardContent className="p-8">
									<div className="text-center space-y-6">
										<div className="w-20 h-20 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center mx-auto text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
											<svg
												className="w-10 h-10"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M13 10V3L4 14h7v7l9-11h-7z"
												/>
											</svg>
										</div>
										<div>
											<h3 className="text-2xl font-bold text-gray-800 mb-3">
												Ease of Use
											</h3>
											<p className="text-gray-600 leading-relaxed">
												CeLLama is integrated with well-established single cell
												pipelines (Seurat & Scanpy), therefore no overhead for
												the users.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-0 shadow-lg">
								<CardContent className="p-8">
									<div className="text-center space-y-6">
										<div className="w-20 h-20 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center mx-auto text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
											<svg
												className="w-10 h-10"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
												/>
											</svg>
										</div>
										<div>
											<h3 className="text-2xl font-bold text-gray-800 mb-3">
												Comprehensive Analysis
											</h3>
											<p className="text-gray-600 leading-relaxed">
												Unlike traditional methods, CeLLama takes into account
												not only the positive markers but also the negative
												genes, providing a more holistic and accurate cell type
												annotation.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-0 shadow-lg">
								<CardContent className="p-8">
									<div className="text-center space-y-6">
										<div className="w-20 h-20 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center mx-auto text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
											<svg
												className="w-10 h-10"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
												/>
											</svg>
										</div>
										<div>
											<h3 className="text-2xl font-bold text-gray-800 mb-3">
												Extensive Reporting
											</h3>
											<p className="text-gray-600 leading-relaxed">
												CeLLama generates detailed and customized reports that
												provide insights into the annotation process and
												results.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>

					{/* CTA Section */}
					<div className="text-center mb-12 mt-48">
						<div className=" rounded-2xl p-12">
							<h3 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
								Enhance Your Single-Cell Analysis Pipeline
							</h3>
							<p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
								Integrate CeLLama into your research workflow for reproducible,
								transparent cell type annotations with interpretable AI
								reasoning.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center">
								<a
									href="https://github.com/Celvoxes/cellama"
									className="inline-block"
								>
									<Button className=" text-white font-bold px-8 py-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-slate-600/25">
										<Icons.gitHub className="w-5 h-5 mr-2" />
										Get Started
									</Button>
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* License Footer */}
			<div className="py-8 bg-gray-50 border-t border-gray-200">
				<div className="max-w-4xl mx-auto px-4 text-center">
					<p className="text-sm text-gray-600">
						Licensed under{" "}
						<Link
							to="https://creativecommons.org/licenses/by-nc/4.0/"
							className="text-blue-600 hover:text-blue-700 underline font-medium"
						>
							CC BY-NC 4.0
						</Link>{" "}
						- Free for non-commercial use with attribution
					</p>
				</div>
			</div>

			<SiteFooter />
		</>
	);
}

export default Cellama;
