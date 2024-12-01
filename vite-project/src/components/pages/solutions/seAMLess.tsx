import { Navbar } from "@/components/header/Navbar";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { User as FirebaseUser } from "firebase/auth";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { SiteFooter } from "@/components/Footer";
import qcGenes from "@/assets/seamless/qc-genes.png";
import qcReads from "@/assets/seamless/qc-reads.png";
import tsneMetaVideo from "@/assets/seamless/tsne-meta.mp4";
import tsneKnnVideo from "@/assets/seamless/tsne-knn.mp4";
import fabKnnImage from "@/assets/seamless/FAB-knn.png";
import aiSummaryVideo from "@/assets/seamless/AI-summary.mp4";
import harmonizeVideo from "@/assets/seamless/harmonize.mp4";

import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import SubscribeForm from "@/components/Subscription";

export function SeAMLess({ user }: { user: FirebaseUser | null }) {
	const navigate = useNavigate();

	useEffect(() => {
		if (user) {
			navigate("/dashboard");
		}
	}, [user, navigate]);

	return (
		<>
			<Navbar />

			<div className="max-w-7xl mx-auto p-0 md:mx-0 mt-16">
				<Card className="mx-auto mb-24 shadow-lg bg-gradient-to-br  from-blue-900 via-slate-900 to-blue-900">
					<CardContent>
						<div className="flex flex-col items-center justify-center text-center mb-12 p-4 md:p-12">
							<h1 className="text-5xl md:text-5xl text-center text-white tracking-tight font-black mb-4 md:mb-6 max-w-3xl mt-12 drop-shadow-lg">
								seAMLess
							</h1>

							<p
								className="text-xl md:text-2xl text-slate-50 max-w-2xl leading-relaxed font-semibold	
								px-2 md:px-0 my-4"
							>
								Unlock molecular insights instantly with AI-powered analysis.
							</p>
							<p className="text-lg text-slate-200 max-w-2xl mb-4">
								Analyze • Visualize • Interpret
							</p>
							<div className="items-center flex flex-col sm:flex-row justify-center mt-8 gap-2">
								<Link to="/login" className="w-auto ">
									<Button className="w-full flex justify-center items-center px-12 py-6 rounded-full text-white bg-blue-700 hover:bg-blue-800">
										Login
									</Button>
								</Link>
								<Link to="/contact" className="w-auto">
									<Button
										variant="outline"
										className="w-full flex justify-center items-center px-8  py-6 rounded-full text-black hover:bg-blue-700 hover:text-white"
									>
										Contact us
									</Button>
								</Link>
							</div>
						</div>
					</CardContent>
				</Card>

				<div className="text-center mb-12">
					<h2 className="text-4xl font-bold tracking-tight text-gray-900">
						Explore your data with ease.
					</h2>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-1 gap-12">
					<Card className="hover:shadow-lg transition-shadow duration-300 bg-slate-100 p-0">
						<CardHeader>
							<CardTitle className="text-2xl">Quality Control</CardTitle>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<CardDescription className="text-lg text-slate-700 cursor-help">
											Check your data quality with a single click.
										</CardDescription>
									</TooltipTrigger>
									<TooltipContent className="max-w-[300px]">
										<p>
											Automatically analyze sample quality metrics including
											read depth, gene coverage, and potential batch effects to
											ensure reliable downstream analysis.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</CardHeader>
						<CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
							<img
								src={qcReads}
								alt="Quality Control Image"
								className="w-full object-cover rounded-xl mx-auto shadow-md"
							/>
							<img
								src={qcGenes}
								alt="Quality Control Image"
								className="w-full object-cover rounded-xl mx-auto shadow-md"
							/>
						</CardContent>
					</Card>

					<Card className="hover:shadow-lg transition-shadow duration-300 bg-slate-100 p-0">
						<CardHeader>
							<CardTitle className="text-2xl">Explore</CardTitle>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<CardDescription className="text-lg text-slate-700 cursor-help">
											Visualize and analyze your data interactively.
										</CardDescription>
									</TooltipTrigger>
									<TooltipContent className="max-w-[300px]">
										<p>
											Interactive t-SNE visualizations allow you to explore
											sample relationships, metadata patterns, and molecular
											subtypes in your dataset.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</CardHeader>
						<CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
							<video
								src={tsneMetaVideo}
								autoPlay
								loop
								muted
								playsInline
								className="w-full object-cover rounded-lg mx-auto shadow-md"
							/>
							<video
								src={tsneKnnVideo}
								autoPlay
								loop
								muted
								playsInline
								className="w-full object-cover rounded-lg mx-auto shadow-md"
							/>
						</CardContent>
					</Card>

					<Card className="hover:shadow-lg transition-shadow duration-300 bg-slate-100">
						<CardHeader>
							<CardTitle className="text-2xl">Get Fast Insights</CardTitle>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<CardDescription className="text-lg text-slate-700 cursor-help">
											Understand your unknown data with known patterns.
										</CardDescription>
									</TooltipTrigger>
									<TooltipContent className="max-w-[300px]">
										<p>
											Leverage machine learning to compare your samples against
											known molecular patterns and get instant insights about
											potential subtypes and characteristics.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</CardHeader>
						<CardContent className="p-4">
							<img
								src={fabKnnImage}
								alt="Get Insights Image"
								className="w-full object-cover rounded-lg shadow-md"
							/>
						</CardContent>
					</Card>
				</div>

				<div className="text-center my-12">
					<h2 className="text-4xl font-bold tracking-tight text-gray-900">
						Advanced Features
					</h2>
				</div>

				<Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 p-0 border-2 border-blue-100 mx-auto mb-12">
					<CardHeader className="space-y-4">
						<div className="flex items-center gap-3">
							<CardTitle className="text-2xl bg-clip-text mx-auto">
								Harmonize with <span className="font-black">one-click</span>
							</CardTitle>
						</div>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<CardDescription className="text-lg text-slate-700 cursor-help">
										Integrate your data with an existing reference with just one
										click.
									</CardDescription>
								</TooltipTrigger>
								<TooltipContent className="max-w-[300px]">
									<p>
										Automatically align and integrate your samples with our
										comprehensive reference database using advanced batch
										correction techniques.
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</CardHeader>
					<CardContent className="p-6 grid grid-cols-1 md:grid-cols-1 gap-4">
						<div className="relative rounded-xl overflow-hidden shadow-lg">
							<div className="absolute " />
							<video
								src={harmonizeVideo}
								autoPlay
								loop
								muted
								playsInline
								className="w-full object-cover rounded-xl mx-auto"
							/>
						</div>
					</CardContent>
				</Card>

				<Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 p-0 border-2 border-blue-100 mx-auto">
					<CardHeader className="space-y-4">
						<div className="flex items-center gap-3">
							<CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-blue-800 text-transparent bg-clip-text mx-auto">
								Summarize with <span className="font-semibold">AI</span>
							</CardTitle>
						</div>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<CardDescription className="text-lg text-slate-700 cursor-help">
										Get instant, AI-powered insights from your complex datasets
										with just one click.
									</CardDescription>
								</TooltipTrigger>
								<TooltipContent className="max-w-[300px]">
									<p>
										Our AI assistant analyzes your data and provides detailed,
										human-readable reports about molecular characteristics,
										potential subtypes, and treatment implications.
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</CardHeader>
					<CardContent className="p-6 grid grid-cols-1 md:grid-cols-1 gap-4">
						<div className="relative rounded-xl overflow-hidden shadow-lg">
							<div className="absolute " />
							<video
								src={aiSummaryVideo}
								autoPlay
								loop
								muted
								playsInline
								className="w-full object-cover rounded-xl mx-auto"
							/>
						</div>
					</CardContent>
				</Card>

				<Card className="hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-blue-900 via-slate-900 to-blue-900 text-center py-40 my-20 relative overflow-hidden">
					<div className="absolute inset-0 z-0 w-full h-full scale-[1] transform opacity-0 lg:opacity-[50%] [mask-image:linear-gradient(#ffff,transparent,75%)] pointer-events-none select-none bg-[length:100%]" />
					<CardHeader className="relative z-10">
						<CardTitle className="text-4xl font-black text-white">
							Get Started with <span className="font-black">seAMLess</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="flex gap-4 items-center justify-center relative z-10">
						<div className="items-center flex flex-col sm:flex-row justify-center mt-8 gap-2">
							<Link to="/login" className="w-auto ">
								<Button className="w-full flex justify-center items-center px-12 py-6 rounded-full text-white bg-blue-700 hover:bg-blue-800">
									Login
								</Button>
							</Link>
							<Link to="/contact" className="w-auto">
								<Button
									variant="outline"
									className="w-full flex justify-center items-center px-8  py-6 rounded-full text-black hover:bg-blue-700 hover:text-white"
								>
									Contact us
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>

				<div className="h-[20rem] max-w-4xl mx-auto flex justify-center items-center px-4 bg-neutral-100">
					<SubscribeForm />
				</div>
			</div>

			<SiteFooter />
		</>
	);
}

export default SeAMLess;
