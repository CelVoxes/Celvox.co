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

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
				<div className="text-center mb-12">
					<h2 className="text-4xl font-bold tracking-tight text-gray-900">
						Explore your data with ease.
					</h2>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-1 gap-8">
					<Card className="hover:shadow-lg transition-shadow duration-300 bg-slate-100">
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
								className="w-full object-cover rounded-xl	 mx-auto shadow-md"
							/>
						</CardContent>
					</Card>

					<Card className="hover:shadow-lg transition-shadow duration-300 bg-slate-100">
						<CardHeader>
							<CardTitle className="text-2xl">Explore</CardTitle>
							<CardDescription className="text-lg text-slate-700">
								Visualize and analyze your data interactively.
							</CardDescription>
						</CardHeader>
						<CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
							<CardTitle className="text-2xl">Get Insights</CardTitle>
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

				<Card className="hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-blue-950 to-blue-800 text-center py-40 my-20 relative overflow-hidden">
					<div className="absolute inset-0 z-0 w-full h-full scale-[1] transform opacity-0 lg:opacity-[50%] [mask-image:linear-gradient(#ffff,transparent,75%)] pointer-events-none select-none bg-[length:100%]" />
					<CardHeader className="relative z-10">
						<CardTitle className="text-4xl font-black text-white">
							Get Started with <span className="font-black">seAMLess</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="flex gap-4 items-center justify-center relative z-10">
						<a
							href="/login"
							className="inline-flex items-center gap-2 bg-slate-700 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors"
						>
							Login
							<svg
								className="w-5 h-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M14 5l7 7m0 0l-7 7m7-7H3"
								/>
							</svg>
						</a>
						<a
							href="/contact"
							className="inline-flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors"
						>
							Contact Us
							<svg
								className="w-5 h-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M14 5l7 7m0 0l-7 7m7-7H3"
								/>
							</svg>
						</a>
					</CardContent>
				</Card>
			</div>

			<SiteFooter />
		</>
	);
}

export default SeAMLess;
