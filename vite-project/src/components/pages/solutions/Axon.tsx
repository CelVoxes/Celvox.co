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
import axonMain from "@/assets/axon/axon-mainpage.png";

type YouTubePlaybackQuality =
	| "default"
	| "small"
	| "medium"
	| "large"
	| "hd720"
	| "hd1080"
	| "highres";

type YouTubePlayerTarget = {
	setPlaybackQuality?: (quality: YouTubePlaybackQuality) => void;
	playVideo?: () => void;
	getIframe?: () => HTMLIFrameElement;
};

type YouTubePlayerEvent = {
	target: YouTubePlayerTarget;
	data?: number;
};

type YouTubeNamespace = {
	Player: new (
		elementId: string,
		options: {
			videoId?: string;
			playerVars?: Record<string, string | number>;
			events?: {
				onReady?: (event: YouTubePlayerEvent) => void;
				onStateChange?: (event: YouTubePlayerEvent) => void;
			};
		}
	) => unknown;
	PlayerState: { PLAYING: number };
};

declare global {
	interface Window {
		YT?: YouTubeNamespace;
		onYouTubeIframeAPIReady?: () => void;
	}
}

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

	// Force YouTube embeds to start in 720p using the IFrame API
	useEffect(() => {
		const ensureAPIAndInit = () => {
			const w = window as Window & typeof globalThis;
			const YT = w.YT;
			if (YT && YT.Player) {
				initPlayers();
				return;
			}
			const tag = document.createElement("script");
			tag.src = "https://www.youtube.com/iframe_api";
			const firstScriptTag = document.getElementsByTagName("script")[0];
			firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
			w.onYouTubeIframeAPIReady = () => initPlayers();
		};

		const initPlayers = () => {
			const ids = [
				"yt-player-1", // Fix Error
				"yt-player-2", // Add Cell
				"yt-player-0", // Fix Code
				"yt-player-3", // Create Project
			];

			ids.forEach((id) => {
				const el = document.getElementById(id) as HTMLIFrameElement | null;
				if (!el) return;
				// Avoid double init
				if (el.getAttribute("data-initialized") === "true") return;
				el.setAttribute("data-initialized", "true");
				try {
					new (window as Window & typeof globalThis).YT!.Player(id, {
						events: {
							onReady: (event: YouTubePlayerEvent) => {
								try {
									event.target.setPlaybackQuality?.("hd720");
									event.target.playVideo?.();
								} catch {
									/* noop */
								}
							},
							onStateChange: (event: YouTubePlayerEvent) => {
								if (
									event.data ===
									(window as Window & typeof globalThis).YT!.PlayerState.PLAYING
								) {
									try {
										event.target.setPlaybackQuality?.("hd720");
									} catch {
										/* noop */
									}
								}
							},
						},
					});
				} catch {
					/* noop */
				}
			});
		};

		ensureAPIAndInit();
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

			<div className="max-w-7xl mx-auto px-0 md:px-0 md:mx-0 mt-10 md:mt-16">
				<Card className="mx-auto mb-12 md:mb-24 shadow-lg bg-gradient-to-br from-slate-900 via-neutral-900 to-slate-900">
					<CardContent>
						<div className="flex flex-col items-center justify-center text-center mb-2 p-0 md:p-8">
							<img
								src={axonNoBackground}
								alt="Axon"
								className="w-32 h-32 md:w-48 md:h-48 lg:w-64 lg:h-64 mb-8 md:mb-12 mt-16 md:mt-16 object-contain"
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
						<div className="flex flex-col items-center justify-end text-center mb-0 md:p-4 rounded-lg h-full">
							<img
								src={axonMain}
								alt="Axon"
								className="w-4/5 h-auto object-contain"
							/>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Videos Section */}
			<div className="max-w-6xl mx-auto mb-48 mt-48">
				<div className="space-y-48">
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
						<div className="text-center mb-12">
							<h3 className="text-3xl md:text-4xl font-black leading-tight text-gray-700 mb-2">
								💬 Just talk to your data
							</h3>
							<p className="text-xl text-gray-500 max-w-2xl mx-auto font-semibold">
								"Hey, can you show my data on a UMAP plot?"
							</p>
						</div>
						<div className="relative bg-gradient-to-br  p-1 rounded-3xl hover:shadow-3xl transition-all duration-500">
							<div className="bg-white rounded-[22px] overflow-hidden">
								<iframe
									id="yt-player-2"
									src="https://www.youtube.com/embed/MblhDmxnvyA?autoplay=1&mute=1&loop=1&playlist=MblhDmxnvyA&enablejsapi=1"
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
						<div className="text-center mb-12">
							<h3 className="text-3xl md:text-4xl font-black leading-tight text-gray-700 mb-2">
								🔄 Change wherever you want
							</h3>
							<p className="text-xl text-gray-500 max-w-2xl mx-auto font-semibold">
								"Hey, could you make these Ensembl IDs?"
							</p>
						</div>
						<div className="relative bg-gradient-to-br p-1 rounded-3xl hover:shadow-3xl transition-all duration-500">
							<div className="bg-black rounded-[22px] overflow-hidden">
								<iframe
									id="yt-player-0"
									src="https://www.youtube.com/embed/wAwm77MJ_eE?autoplay=1&mute=1&loop=1&playlist=wAwm77MJ_eE&enablejsapi=1"
									title="Axon - Inline Code Fixing"
									className="w-full h-full aspect-[16/10] lg:aspect-[16/9]"
									frameBorder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
								/>
							</div>
						</div>
					</div>

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
						<div className="text-center mb-12">
							<h3 className="text-3xl md:text-4xl font-black leading-tight text-gray-700 mb-2">
								🤔 There is a problem with the results
							</h3>
							<p className="text-xl text-gray-500 max-w-2xl mx-auto font-semibold">
								"Hey, there is a problem with the results. Can you fix it?"
							</p>
						</div>
						<div className="relative bg-gradient-to-br p-1 rounded-3xl hover:shadow-3xl transition-all duration-500">
							<div className="bg-black rounded-[22px] overflow-hidden">
								<iframe
									id="yt-player-1"
									src="https://www.youtube.com/embed/0lQnM0B2wVc?autoplay=1&mute=1&loop=1&playlist=0lQnM0B2wVc&enablejsapi=1"
									title="Axon - Fixing error in the code"
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
						<div className="text-center mb-12">
							<h3 className="text-3xl md:text-4xl font-black leading-tight text-gray-700 mb-2">
								🎯 Just analyze the whole thing
							</h3>
							<p className="text-xl text-gray-500 max-w-2xl mx-auto font-semibold">
								"Hey, could you analyze this data?"
							</p>
						</div>
						<div className="relative bg-gradient-to-br p-1 rounded-3xl hover:shadow-3xl transition-all duration-500">
							<div className="bg-black rounded-[22px] overflow-hidden">
								<iframe
									id="yt-player-3"
									src="https://www.youtube.com/embed/r0mapZfYkT0?autoplay=1&mute=1&loop=1&playlist=r0mapZfYkT0&enablejsapi=1"
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
			<div className="max-w-7xl mx-auto px-0 md:mx-0 mt-10 md:mt-16">
				<Card className="mx-auto mb-12 md:mb-24 shadow-lg bg-gradient-to-br from-slate-900 via-neutral-900 to-slate-900">
					<CardContent>
						<div className="flex flex-col items-center justify-center text-center mb-12 p-4 md:p-12">
							<h2 className="text-3xl md:text-5xl text-center text-white tracking-tight font-black mb-4 md:mb-6 max-w-3xl mt-12 drop-shadow-lg">
								Stay in the Loop
							</h2>

							<p className="text-lg md:text-2xl text-slate-50 max-w-2xl leading-relaxed font-semibold px-2 md:px-0 my-4">
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
										className="bg-gradient-to-r border-2 border-white text-white font-bold px-8 py-8 rounded-xl w-full text-md transition-all duration-300 transform hover:scale-105"
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
