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
import tsneMetaVideo from "@/assets/seamless/tsne-meta.mov";
import tsneKnnVideo from "@/assets/seamless/tsne-knn.mov";
import fabKnnImage from "@/assets/seamless/FAB-knn.png";
import aiSummaryVideo from "@/assets/seamless/ai-summary.mov";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

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
				<div className="text-center mb-12">
					<h2 className="text-4xl font-bold tracking-tight text-gray-900">
						Explore your data with ease.
					</h2>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-1 gap-8">
					<Card className="hover:shadow-lg transition-shadow duration-300 bg-slate-100 p-0">
						<CardHeader>
							<CardTitle className="text-2xl">Quality Control</CardTitle>
							<CardDescription className="text-lg text-slate-700">
								Check your data quality with a single click.
							</CardDescription>
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
							<CardDescription className="text-lg text-slate-700">
								Visualize and analyze your data interactively.
							</CardDescription>
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
							<CardDescription className="text-lg text-slate-700">
								Understand your data with meaningful patterns.
							</CardDescription>
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

				<Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 p-0 border-2 border-blue-100 mx-auto">
					<CardHeader className="space-y-4">
						<div className="flex items-center gap-3">
							<CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-blue-800 text-transparent bg-clip-text mx-auto">
								Summarize with AI
							</CardTitle>
						</div>
						<CardDescription className="text-lg text-slate-700">
							Get instant, AI-powered insights from your complex datasets with
							just one click.
						</CardDescription>
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

				<Card className="hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-blue-950 to-blue-800 text-center py-40 my-20 relative overflow-hidden">
					<div className="absolute inset-0 z-0 w-full h-full scale-[1] transform opacity-0 lg:opacity-[50%] [mask-image:linear-gradient(#ffff,transparent,75%)] pointer-events-none select-none bg-[length:100%]" />
					<CardHeader className="relative z-10">
						<CardTitle className="text-4xl font-black text-white">
							Get Started with <span className="font-black">seAMLess</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="flex gap-4 items-center justify-center relative z-10">
						<Button
							variant="secondary"
							asChild
							className="bg-slate-700 hover:bg-slate-800 p-6 text-white"
						>
							<Link to="/login">
								Login
								<ArrowRight className="w-5 h-5 ml-2" />
							</Link>
						</Button>
						<Button
							variant="secondary"
							asChild
							className="bg-blue-700 hover:bg-slate-800 p-6 text-white"
						>
							<Link to="/contact">
								Contact Us
								<ArrowRight className="w-5 h-5 ml-2" />
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>

			<SiteFooter />
		</>
	);
}

export default SeAMLess;
