import { Navbar } from "@/components/header/Navbar";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ReloadIcon } from "@radix-ui/react-icons";
import Thinking from "@/components/ui/thinking";

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
			{ threshold: 0 }
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

							{/* Social Media Buttons */}
							<div className="flex flex-col sm:flex-row gap-6 mt-10 mb-8">
								<Button
									onClick={() =>
										window.open("https://x.com/celvoxofficial", "_blank")
									}
									className="group relative overflow-hidden bg-white hover:bg-gray-50 text-black font-bold px-8 rounded-2xl text-base transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 hover:shadow-2xl hover:shadow-gray-400/50 flex items-center justify-center gap-3 border border-gray-200 hover:border-gray-300 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-gray-900/10 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-1000 before:ease-out py-6 min-w-[180px] "
								>
									<div className="absolute inset-0 bg-gradient-to-r from-gray-100/50 to-gray-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
									<svg
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="black"
										xmlns="http://www.w3.org/2000/svg"
										className="relative z-10 transition-transform duration-300 group-hover:scale-110"
									>
										<path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
									</svg>
									<span className="relative z-10 font-semibold tracking-wide text-black">
										Follow on X
									</span>
									<div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-gray-800/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
								</Button>

								<Button
									onClick={() =>
										window.open("https://discord.gg/Ar5SJMgWDN", "_blank")
									}
									className="group relative overflow-hidden bg-gradient-to-br from-[#5865F2] via-[#4752C4] to-[#5865F2] hover:from-[#4752C4] hover:via-[#3638A0] hover:to-[#4752C4] text-white font-bold px-8 rounded-2xl text-base transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#5865F2]/60 flex items-center justify-center gap-3 border-2 border-[#5865F2]/60 hover:border-[#4752C4] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-1000 before:ease-out py-6 min-w-[180px]"
								>
									<div className="absolute inset-0 bg-gradient-to-br from-[#5865F2]/15 via-[#4752C4]/15 to-[#5865F2]/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
									<div className="absolute inset-0 bg-gradient-to-t from-[#5865F2]/25 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300 rounded-2xl"></div>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="currentColor"
										className="relative z-20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 text-white group-hover:text-[#5865F2]"
									>
										<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0003 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z" />
									</svg>
									<span className="relative z-20 font-semibold tracking-wide text-white group-hover:text-[#5865F2]">
										Join Discord
									</span>
									<div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#5865F2]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
								</Button>
							</div>
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
			<div className="max-w-6xl mx-auto mb-24 mt-24">
				<div className="space-y-48">
					{/* Video 3: Adding a new cell to an existing Notebook */}
					<div
						ref={(el) => (videoRefs.current[2] = el)}
						data-video-index="2"
						className={`transform transition-all duration-1000 ease-out delay-100 ${
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
								💡 Think before you answer
							</h3>
							<div className="mt-2">
								<Thinking size="md" label="Thinking" />
							</div>
						</div>
						<div className="relative bg-gradient-to-br  p-1 rounded-3xl hover:shadow-3xl transition-all duration-500">
							<div className="bg-white rounded-[22px] overflow-hidden">
								<iframe
									id="yt-player-4"
									src="https://www.youtube.com/embed/CzYnF0-77J8?autoplay=1&mute=1&loop=1&playlist=CzYnF0-77J8&enablejsapi=1"
									title="Axon - Thinking before answering"
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
			<div className="max-w-7xl mx-auto px-0 md:mx-0 mt-48 md:mt-48">
				<Card className="mx-auto mb-12 md:mb-24 bg-gradient-to-br from-slate-600 via-neutral-900 to-slate-900">
					<CardContent>
						<div className="flex flex-col items-center justify-center text-center mb-12 p-4 md:p-12">
							<h2 className="text-3xl md:text-4xl text-center text-white tracking-tight font-black mb-4 md:mb-6 max-w-3xl mt-12 drop-shadow-lg">
								Stay in the Loop
							</h2>

							<p className="text-lg md:text-xl text-slate-50 max-w-2xl leading-relaxed font-semibold px-2 md:px-0 my-4">
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
										className="flex w-full text-lg px-6 py-4 rounded-xl border-2 border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 focus:border-slate-700 focus:outline-none transition-colors"
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
										className="relative overflow-hidden bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 border-2 border-yellow-600 text-slate-100 font-bold px-8 py-8 rounded-xl w-full text-md transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-yellow-400/60 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-1000 before:ease-out hover:animate-none"
									>
										{buttonDisable && <ReloadIcon className="mr-2 h-5 w-5" />}
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
