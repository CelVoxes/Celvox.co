import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

export function SeAMLessInfo() {
	return (
		<>
			<div className="text-center my-12">
				<h2 className="text-4xl font-bold tracking-tight text-gray-900">
					Frequently Asked Questions
				</h2>
			</div>

			<Accordion
				type="single"
				collapsible
				className="w-full max-w-4xl mx-auto px-0 sm:px-6 text-left my-10 text-muted-foreground"
			>
				<AccordionItem value="what-is">
					<AccordionTrigger className="text-left hover:bg-muted/50 rounded-lg px-4">
						What is seAMLess and how can it help my research?
					</AccordionTrigger>
					<AccordionContent className="px-4">
						<div className="space-y-4">
							<p className="text-sm leading-relaxed mt-4">
								seAMLess is your AI-powered molecular analysis companion that
								transforms complex genomic data into actionable insights.
							</p>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="bg-muted/30 p-4 rounded-lg border border-muted/50 hover:border-primary/30 transition-colors">
									<div className="flex items-center gap-2 mb-2">
										<svg
											className="w-5 h-5 text-primary"
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
										<h4 className="font-medium">Lightning Fast</h4>
									</div>
									<p className="text-sm text-muted-foreground">
										Process sequencing data to insights in minutes, not weeks
									</p>
								</div>

								<div className="bg-muted/30 p-4 rounded-lg border border-muted/50 hover:border-primary/30 transition-colors">
									<div className="flex items-center gap-2 mb-2">
										<svg
											className="w-5 h-5 text-primary"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
											/>
										</svg>
										<h4 className="font-medium">Automated Analysis</h4>
									</div>
									<p className="text-sm text-muted-foreground">
										Identify molecular patterns and subtypes automatically
									</p>
								</div>

								<div className="bg-muted/30 p-4 rounded-lg border border-muted/50 hover:border-primary/30 transition-colors">
									<div className="flex items-center gap-2 mb-2">
										<svg
											className="w-5 h-5 text-primary"
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
										<h4 className="font-medium">Publication Ready</h4>
									</div>
									<p className="text-sm text-muted-foreground">
										Generate publication-ready visualizations instantly
									</p>
								</div>

								<div className="bg-muted/30 p-4 rounded-lg border border-muted/50 hover:border-primary/30 transition-colors">
									<div className="flex items-center gap-2 mb-2">
										<svg
											className="w-5 h-5 text-primary"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
											/>
										</svg>
										<h4 className="font-medium">Rich References</h4>
									</div>
									<p className="text-sm text-muted-foreground">
										Compare your data against 1,000+ reference samples
									</p>
								</div>
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="use-cases">
					<AccordionTrigger className="text-left hover:bg-muted/50 rounded-lg px-4">
						What types of analysis can I perform?
					</AccordionTrigger>
					<AccordionContent className="space-y-3 px-4">
						<p className="text-sm leading-relaxed mt-4">
							Some of the analysis you can perform with seAMLess include:
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
							<div className="bg-muted/50 p-4 rounded-lg">
								<h4 className="font-medium text-sm sm:text-base mb-2 ">
									Mutation Analysis
								</h4>
								<p className="text-sm text-muted-foreground">
									Identify genetic variants, analyze mutation patterns, and
									explore variant allele frequencies (VAF) with interactive
									visualizations
								</p>
							</div>
							<div className="bg-muted/50 p-4 rounded-lg">
								<h4 className="font-medium text-sm sm:text-base mb-2">
									Sample Clustering
								</h4>
								<p className="text-sm text-muted-foreground">
									Explore sample relationships through t-SNE visualization and
									KNN-based molecular subtype analysis
								</p>
							</div>
							<div className="bg-muted/50 p-4 rounded-lg">
								<h4 className="font-medium text-sm sm:text-base mb-2">
									Cell Type Deconvolution
								</h4>
								<p className="text-sm text-muted-foreground">
									Analyze cell type compositions and immune infiltration
									patterns in your samples
								</p>
							</div>
							<div className="bg-muted/50 p-4 rounded-lg">
								<h4 className="font-medium text-sm sm:text-base mb-2">
									Data Harmonization
								</h4>
								<p className="text-sm text-muted-foreground">
									Integrate and normalize your data with reference datasets for
									comprehensive comparative analysis
								</p>
							</div>
						</div>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="getting-started">
					<AccordionTrigger className="text-left hover:bg-muted/50 rounded-lg px-4">
						How do I get started?
					</AccordionTrigger>
					<AccordionContent className="px-4 mt-4">
						seAMLess is in beta version for now, please{" "}
						<a href="/contact" className="underline">
							contact us
						</a>{" "}
						to get access.
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="pricing">
					<AccordionTrigger className="text-left hover:bg-muted/50 rounded-lg px-4">
						What about pricing and support?
					</AccordionTrigger>
					<AccordionContent className="px-4 mt-4">
						seAMLess is in beta version for now, please{" "}
						<a href="/contact" className="underline">
							contact us
						</a>{" "}
						to get access.
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</>
	);
}
