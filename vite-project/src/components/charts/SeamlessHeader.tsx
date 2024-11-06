import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export const SeamlessHeader = () => (
	<div className="max-w-screen-2xl mx-auto">
		<Card className="bg-gradient-to-r from-purple-100 to-blue-100">
			<CardHeader>
				<CardTitle className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text">
					seAMLess Dashboard
				</CardTitle>
				<CardDescription>
					Comprehensive Molecular Data Analysis and Visualization
				</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-gray-600 mb-4">
					The dashboard offers a comprehensive view of RNA-sequencing data,
					including t-SNE visualizations, deconvolution analysis, drug response
					data, and mutation information.
				</p>
				<Accordion type="single" collapsible className="w-full">
					<AccordionItem value="features" className="bg-transparent">
						<AccordionTrigger className="bg-white hover:bg-transparent">
							Key Features
						</AccordionTrigger>
						<AccordionContent className="bg-transparent">
							<Table>
								<TableBody className="text-left">
									<TableRow>
										<TableCell>
											<h4 className="font-bold">Upload and analyze samples</h4>
											<p className="text-sm mt-2">
												Upload your own AML samples for analysis. This feature
												enables you to:
												<ul className="list-disc list-inside mt-1">
													<li>
														Compare your samples with a comprehensive database
														of existing AML samples
													</li>
													<li>
														Gain insights into how your samples relate to known
														AML subtypes
													</li>
													<li>
														Identify potential characteristics and treatment
														options
													</li>
												</ul>
												<p className="mt-2">To use this feature:</p>
												<ol className="list-decimal list-inside mt-1">
													<li>Navigate to the Data Upload section</li>
													<li>
														Follow the instructions to upload your sample data
													</li>
													<li>
														Once uploaded, your samples will be integrated into
														the various analysis tools
													</li>
												</ol>
											</p>
										</TableCell>
									</TableRow>
									<TableRow>
										<TableCell>
											<h4 className="font-bold">
												Explore gene expression patterns
											</h4>
											<p className="text-sm mt-2">
												Use advanced visualization techniques like t-SNE to
												explore gene expression patterns:
												<ul className="list-disc list-inside mt-1">
													<li>
														Identify similarities and differences between
														various AML subtypes
													</li>
													<li>
														Visualize how your uploaded samples relate to known
														patterns
													</li>
													<li>
														Discover potential new subtypes or unique
														characteristics in your samples
													</li>
												</ul>
												<p className="mt-2">To access this feature:</p>
												<ol className="list-decimal list-inside mt-1">
													<li>Go to the t-SNE tab</li>
													<li>
														Select "Gene Expression" from the available options
													</li>
													<li>
														Use the interactive plot to explore patterns and
														clusters
													</li>
												</ol>
											</p>
										</TableCell>
									</TableRow>
									<TableRow>
										<TableCell>
											<h4 className="font-bold">
												Examine cellular composition
											</h4>
											<p className="text-sm mt-2">
												Utilize deconvolution analysis to estimate cellular
												composition:
												<ul className="list-disc list-inside mt-1">
													<li>Understand the heterogeneity of AML samples</li>
													<li>
														Identify predominant cell types in each sample
													</li>
													<li>
														Compare cellular compositions across different AML
														subtypes
													</li>
												</ul>
												<p className="mt-2">To use this feature:</p>
												<ol className="list-decimal list-inside mt-1">
													<li>Navigate to the Deconvolution tab</li>
													<li>
														Run the deconvolution analysis on selected samples
													</li>
													<li>
														Interpret the results to understand cellular makeup
													</li>
												</ol>
											</p>
										</TableCell>
									</TableRow>
									<TableRow>
										<TableCell>
											<h4 className="font-bold">
												Investigate ex-vivo drug responses
											</h4>
											<p className="text-sm mt-2">
												Explore ex-vivo drug responses to predict treatment
												efficacy:
												<ul className="list-disc list-inside mt-1">
													<li>
														Analyze how different AML subtypes respond to
														various treatments
													</li>
													<li>
														Predict potential effective treatments for your
														samples
													</li>
													<li>
														Identify patterns in drug responses across AML
														subtypes
													</li>
												</ul>
												<p className="mt-2">To access this feature:</p>
												<ol className="list-decimal list-inside mt-1">
													<li>Go to the Drug Response tab</li>
													<li>
														Select specific drugs or view overall response
														patterns
													</li>
													<li>
														Compare your samples' predicted responses to known
														subtypes
													</li>
												</ol>
											</p>
										</TableCell>
									</TableRow>
									<TableRow>
										<TableCell>
											<h4 className="font-bold">Analyze genetic mutations</h4>
											<p className="text-sm mt-2">
												Examine genetic mutations associated with AML:
												<ul className="list-disc list-inside mt-1">
													<li>Identify key driver mutations in your samples</li>
													<li>
														Understand the potential impact of mutations on
														disease progression
													</li>
													<li>
														Explore correlations between mutations and other
														features (e.g., drug responses)
													</li>
												</ul>
												<p className="mt-2">To use this feature:</p>
												<ol className="list-decimal list-inside mt-1">
													<li>
														Navigate to the Mutation tab within the t-SNE
														visualization section
													</li>
													<li>Select specific mutations of interest</li>
													<li>
														Analyze the distribution of mutations across samples
														and subtypes
													</li>
												</ol>
											</p>
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="tips" className="bg-transparent">
						<AccordionTrigger className="bg-white hover:bg-transparent">
							Tips & Tricks
						</AccordionTrigger>
						<AccordionContent className="bg-transparent">
							<Table>
								<TableBody className="text-left">
									<TableRow>
										<TableCell>
											<h4 className="font-bold">
												Use the t-SNE tab for quick visual clustering
											</h4>
											<p className="text-sm mt-2">
												The t-SNE visualization provides a powerful way to
												quickly identify clusters:
												<ul className="list-disc list-inside mt-1">
													<li>
														Start your analysis here for an overview of sample
														relationships
													</li>
													<li>
														Identify where your uploaded samples appear in
														relation to known subtypes
													</li>
													<li>
														Use different coloring schemes to highlight various
														features (e.g., mutations, expression levels)
													</li>
												</ul>
												<p className="mt-2">Best practices:</p>
												<ol className="list-decimal list-inside mt-1">
													<li>
														Begin with the default t-SNE view to get an overall
														picture
													</li>
													<li>
														Experiment with different perplexity values to
														reveal different clustering patterns
													</li>
													<li>
														Use the zoom and pan features to focus on specific
														regions of interest
													</li>
												</ol>
											</p>
										</TableCell>
									</TableRow>
									<TableRow>
										<TableCell>
											<h4 className="font-bold">
												Combine mutation and expression data for deeper insights
											</h4>
											<p className="text-sm mt-2">
												Integrating mutation and expression data can reveal
												important biological insights:
												<ul className="list-disc list-inside mt-1">
													<li>
														Switch between gene expression and mutation data in
														t-SNE visualizations
													</li>
													<li>
														Look for correlations between specific mutations and
														gene expression patterns
													</li>
													<li>
														Identify potential functional relationships between
														mutations and expression changes
													</li>
												</ul>
												<p className="mt-2">Approach:</p>
												<ol className="list-decimal list-inside mt-1">
													<li>Start with the gene expression t-SNE view</li>
													<li>Note any distinct clusters or patterns</li>
													<li>
														Switch to the mutation view and compare cluster
														compositions
													</li>
													<li>
														Use the KNN report to dive deeper into samples of
														interest
													</li>
												</ol>
											</p>
										</TableCell>
									</TableRow>
									<TableRow>
										<TableCell>
											<h4 className="font-bold">
												Leverage KNN reports for similarity analysis
											</h4>
											<p className="text-sm mt-2">
												The K-Nearest Neighbors (KNN) report is a powerful tool
												for detailed sample analysis:
												<ul className="list-disc list-inside mt-1">
													<li>
														Identifies the most similar samples in the database
														to your uploaded samples
													</li>
													<li>
														Provides statistical analysis of features shared
														among similar samples
													</li>
													<li>
														Helps predict potential characteristics of your
														samples
													</li>
												</ul>
												<p className="mt-2">How to use:</p>
												<ol className="list-decimal list-inside mt-1">
													<li>Navigate to the KNN Report section</li>
													<li>
														Select your sample of interest and set the desired K
														value
													</li>
													<li>
														Run the report and analyze the results, paying
														attention to:
													</li>
													<li>
														Frequently occurring features among nearest
														neighbors
													</li>
													<li>
														Confidence scores for predicted characteristics
													</li>
													<li>
														Any unexpected similarities that might warrant
														further investigation
													</li>
												</ol>
											</p>
										</TableCell>
									</TableRow>
									<TableRow>
										<TableCell>
											<h4 className="font-bold">
												Explore drug responses to identify potential treatments
											</h4>
											<p className="text-sm mt-2">
												The drug response feature helps generate treatment
												hypotheses:
												<ul className="list-disc list-inside mt-1">
													<li>
														Investigate how samples similar to yours responded
														to various treatments
													</li>
													<li>
														Identify potential effective treatments for your
														samples
													</li>
													<li>
														Understand the landscape of drug responses across
														AML subtypes
													</li>
												</ul>
												<p className="mt-2">Best practices:</p>
												<ol className="list-decimal list-inside mt-1">
													<li>
														Start with the Drug Response t-SNE view to see
														overall patterns
													</li>
													<li>
														Focus on drugs that show clear response differences
														across samples
													</li>
													<li>
														Use the KNN report to see detailed drug response
														predictions for your samples
													</li>
													<li>
														Always interpret results cautiously and in
														conjunction with other clinical data
													</li>
													<li>
														Consider consulting with clinical experts to
														validate treatment hypotheses
													</li>
												</ol>
											</p>
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
				<div className="mt-4">
					<Badge variant="secondary" className="mr-2">
						High Performance
					</Badge>
					<Badge variant="secondary" className="mr-2">
						Secure
					</Badge>
					<Badge variant="secondary">Large Datasets</Badge>
				</div>
			</CardContent>
		</Card>
	</div>
);

export default SeamlessHeader;
