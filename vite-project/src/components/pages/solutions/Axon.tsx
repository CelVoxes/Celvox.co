import { Navbar } from "@/components/header/Navbar";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ReloadIcon } from "@radix-ui/react-icons";

import axonNoBackground from "@/assets/axon/axon-no-background.png";

export function Axon({ user }: { user: FirebaseUser | null }) {
	const navigate = useNavigate();
	const [visibleVideos, setVisibleVideos] = useState<number[]>([]);
	const videoRefs = useRef<(HTMLDivElement | null)[]>([]);
	const { toast } = useToast();
	const [buttonDisable, setButtonDisable] = useState(false);

	useEffect(() => {
		if (user) {
			navigate("/dashboard");
		}
	}, [user, navigate]);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						const index = parseInt(
							entry.target.getAttribute("data-video-index") || "0"
						);
						setVisibleVideos((prev) =>
							prev.includes(index) ? prev : [...prev, index]
						);
					}
				});
			},
			{ threshold: 0.3 }
		);

		videoRefs.current.forEach((ref) => {
			if (ref) observer.observe(ref);
		});

		return () => observer.disconnect();
	}, []);

	const handleAxonNewsSubmit = async (
		event: React.FormEvent<HTMLFormElement>
	) => {
		event.preventDefault();
		setButtonDisable(true);

		const formData = new FormData(event.currentTarget);
		const formDataEntries: Record<string, string> = {};
		formData.forEach((value, key) => {
			formDataEntries[key] = value.toString();
		});

		try {
			const params = new URLSearchParams(formDataEntries).toString();
			const response = await fetch(
				`https://script.google.com/macros/s/AKfycbwneoM8x6g-Ehsd1J8j-pcYXy2CNXX4vJtX9rVKGe2GNAETgtJSdENRwhYzogIVrZk23g/exec?${params}`,
				{
					method: "GET",
					redirect: "follow",
				}
			);

			const result = await response.json();

			if (result.result === "success") {
				toast({
					title: "Welcome to the Axon family! 🚀",
					description:
						"You'll be the first to know about Axon updates and features.",
				});
				// Reset form
				(event.target as HTMLFormElement).reset();
			} else {
				toast({
					title: "Oops! Something went wrong",
					variant: "destructive",
					description: "Please try again or contact support.",
				});
			}
		} catch (error) {
			toast({
				title: "Connection Error",
				variant: "destructive",
				description: `Please check your connection: ${
					(error as Error).message
				}`,
			});
		} finally {
			setButtonDisable(false);
		}
	};

	return (
		<>
			<Navbar />

			<div className="max-w-7xl mx-auto px-4 md:px-0 md:mx-0 mt-10 md:mt-16">
				<Card className="mx-auto mb-12 md:mb-24 shadow-lg bg-gradient-to-br from-slate-900 via-neutral-900 to-slate-900">
					<CardContent>
						<div className="flex flex-col items-center justify-center text-center mb-12 p-4 md:p-12">
							<img
								src={axonNoBackground}
								alt="Axon"
								className="w-32 h-32 md:w-48 md:h-48 lg:w-64 lg:h-64 mb-8 md:mb-12 mt-8 md:mt-12 object-contain"
							/>
							<h1 className="text-5xl md:text-5xl text-center text-white tracking-tight font-black mb-4 md:mb-6 max-w-3xl mt-12 drop-shadow-lg">
								Axon
							</h1>

							<p
								className="text-xl md:text-2xl text-slate-50 max-w-2xl leading-relaxed font-semibold\t
								px-2 md:px-0 my-4"
							>
								AI agent for bioinformatics — generate, run, and explain
								analyses.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Videos Section */}
			<div className="max-w-6xl mx-auto px-4 md:px-8 mb-32">
				<div className="space-y-32">
					{/* Video 2: Fixing error in the code */}
					<div
						ref={(el) => (videoRefs.current[1] = el)}
						data-video-index="1"
						className={`transform transition-all duration-1000 ease-out delay-300 ${
							visibleVideos.includes(1)
								? "translate-y-0 opacity-100"
								: "translate-y-20 opacity-0"
						}`}
					>
						<div className="text-center mb-8">
							<h3 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
								"Fix Error"
							</h3>
							<p className="text-xl text-gray-600 max-w-2xl mx-auto">
								See how Axon intelligently resolves code errors with precision.
							</p>
						</div>
						<div className="relative bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-1 rounded-3xl hover:shadow-3xl transition-all duration-500">
							<div className="bg-black rounded-[22px] overflow-hidden">
								<iframe
									src="https://www.youtube.com/embed/0lQnM0B2wVc?autoplay=1&mute=1&loop=1&playlist=0lQnM0B2wVc"
									title="Axon - Fixing error in the code"
									className="w-full h-full aspect-[16/10] lg:aspect-[16/9]"
									frameBorder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
								/>
							</div>
						</div>
					</div>

					{/* Video 3: Adding a new cell to an existing Notebook */}
					<div
						ref={(el) => (videoRefs.current[2] = el)}
						data-video-index="2"
						className={`transform transition-all duration-1000 ease-out delay-600 ${
							visibleVideos.includes(2)
								? "translate-y-0 opacity-100"
								: "translate-y-20 opacity-0"
						}`}
					>
						<div className="text-center mb-8">
							<h3 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
								"Add Cell"
							</h3>
							<p className="text-xl text-gray-600 max-w-2xl mx-auto">
								Discover how Axon seamlessly adds new cells to existing
								notebooks, enhancing your analytical workflow
							</p>
						</div>
						<div className="relative bg-gradient-to-br from-green-400 via-teal-500 to-blue-500 p-1 rounded-3xl hover:shadow-3xl transition-all duration-500">
							<div className="bg-black rounded-[22px] overflow-hidden">
								<iframe
									src="https://www.youtube.com/embed/MblhDmxnvyA?autoplay=1&mute=1&loop=1&playlist=MblhDmxnvyA"
									title="Axon - Adding a new cell to an existing Notebook"
									className="w-full h-full aspect-[16/10] lg:aspect-[16/9]"
									frameBorder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
								/>
							</div>
						</div>
					</div>
					{/* Video 1: Inline Code Fixing */}
					<div
						ref={(el) => (videoRefs.current[0] = el)}
						data-video-index="0"
						className={`transform transition-all duration-1000 ease-out ${
							visibleVideos.includes(0)
								? "translate-y-0 opacity-100"
								: "translate-y-20 opacity-0"
						}`}
					>
						<div className="text-center mb-8">
							<h3 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
								"Fix Code"
							</h3>
							<p className="text-xl text-gray-600 max-w-2xl mx-auto">
								Watch Axon automatically detect and fix code issues in
								real-time, streamlining your development process
							</p>
						</div>
						<div className="relative bg-gradient-to-br from-orange-400 via-pink-500 to-red-500 p-1 rounded-3xl hover:shadow-3xl transition-all duration-500">
							<div className="bg-black rounded-[22px] overflow-hidden">
								<iframe
									src="https://www.youtube.com/embed/wAwm77MJ_eE?autoplay=1&mute=1&loop=1&playlist=wAwm77MJ_eE"
									title="Axon - Inline Code Fixing"
									className="w-full h-full aspect-[16/10] lg:aspect-[16/9]"
									frameBorder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
								/>
							</div>
						</div>
					</div>
					{/* Video 4: Creating a whole project */}
					<div
						ref={(el) => (videoRefs.current[3] = el)}
						data-video-index="3"
						className={`transform transition-all duration-1000 ease-out delay-900 ${
							visibleVideos.includes(3)
								? "translate-y-0 opacity-100"
								: "translate-y-20 opacity-0"
						}`}
					>
						<div className="text-center mb-8">
							<h3 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
								"Create Project"
							</h3>
							<p className="text-xl text-gray-600 max-w-2xl mx-auto">
								Watch Axon generate complete bioinformatics projects from
								scratch, transforming ideas into reality
							</p>
						</div>
						<div className="relative bg-gradient-to-br from-purple-400 via-yellow-400 to-orange-500 p-1 rounded-3xl hover:shadow-3xl transition-all duration-500">
							<div className="bg-black rounded-[22px] overflow-hidden">
								<iframe
									src="https://www.youtube.com/embed/r0mapZfYkT0?autoplay=1&mute=1&loop=1&playlist=r0mapZfYkT0"
									title="Axon - Creating a whole project"
									className="w-full h-full aspect-[16/10] lg:aspect-[16/9]"
									frameBorder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Axon News CTA Section */}
			<div className="max-w-7xl mx-auto px-4 md:px-0 md:mx-0 mt-10 md:mt-16">
				<Card className="mx-auto mb-12 md:mb-24 shadow-lg bg-gradient-to-br from-slate-900 via-neutral-900 to-slate-900">
					<CardContent>
						<div className="flex flex-col items-center justify-center text-center mb-12 p-4 md:p-12">
							<h2 className="text-5xl md:text-5xl text-center text-white tracking-tight font-black mb-4 md:mb-6 max-w-3xl mt-12 drop-shadow-lg">
								Stay in the Loop
							</h2>

							<p className="text-xl md:text-2xl text-slate-50 max-w-2xl leading-relaxed font-semibold px-2 md:px-0 my-4">
								Get exclusive Axon updates and early access.
							</p>

							<form
								onSubmit={handleAxonNewsSubmit}
								className="max-w-md mx-auto mt-8"
							>
								<div className="flex flex-col gap-4">
									<input
										name="Email"
										type="email"
										className="flex w-full text-lg px-6 py-4 rounded-xl border-2 border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
										required
										placeholder="Enter your email"
									/>

									<input name="Name" type="hidden" value="Axon-Newsletter" />
									<input
										name="Message"
										type="hidden"
										value="Axon landing page signup"
									/>

									<Button
										type="submit"
										disabled={buttonDisable}
										className="bg-gradient-to-r border-2 border-white text-white font-bold px-8 py-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105"
									>
										{buttonDisable && (
											<ReloadIcon className="mr-2 h-5 w-5 animate-spin" />
										)}
										Get Axon News
									</Button>
								</div>
							</form>
						</div>
					</CardContent>
				</Card>
			</div>

			<SiteFooter />
		</>
	);
}

export default Axon;
