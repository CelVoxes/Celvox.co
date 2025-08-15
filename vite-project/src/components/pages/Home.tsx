("use client");

import { Navbar } from "@/components/header/Navbar";
import { FlipWordsDemo } from "@/components/FlipWords";
import { SiteFooter } from "@/components/Footer";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import natureLogo from "@/assets/nature-logo.svg";

export function Home() {
	return (
		<>
			<Navbar />
			<FlipWordsDemo />
			<Separator />

			<div
				className={`h-[40rem] max-w-4xl mx-auto flex justify-center items-center px-4`}
			>
				<div className="text-center text-2xl mx-auto text-neutral-600 dark:text-neutral-400">
					<span className="text-sm text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full">
						New
					</span>
					<h2 className="mt-6 mb-4">
						Introducing{" "}
						<Link to="solutions/axon" className="w-auto">
							<b>Axon</b>
						</Link>
						,
					</h2>
					<p className="text-xl">Cursor for Bioinformatics.</p>
					<div className="items-center flex flex-col sm:flex-row justify-center mt-8 gap-2">
						<Link to="solutions/axon" className="w-auto">
							<Button className="w-full flex justify-center items-center px-8 py-6 rounded-full">
								Learn more
							</Button>
						</Link>
						<Link to="contact" className="w-auto">
							<Button
								variant="outline"
								className="w-full flex justify-center items-center px-8  py-6 rounded-full text-black hover:bg-black hover:text-white"
							>
								Contact us
							</Button>
						</Link>
					</div>
				</div>
			</div>
			<Separator />

			<div className="h-[40rem] max-w-4xl mx-auto flex justify-center items-center px-4">
				<div className="text-2xl mx-auto text-neutral-600 dark:text-neutral-400">
					<h2 className="mt-6 mb-4">
						Introducing{" "}
						<Link to="solutions/cellama" className="w-auto">
							<b>ceLLama</b>
						</Link>
						,
					</h2>
					<p className="text-xl">
						An automated cell type annotation pipeline using local Large
						Language Models.
					</p>

					<br />
					<span className="text-sm">Featured on</span>
					<a
						href="https://www.nature.com/articles/d41586-024-02998-y"
						target="_blank"
						rel="noopener noreferrer"
					>
						<div className="flex items-center justify-center gap-2 mt-2">
							<img src={natureLogo} alt="Nature" />
						</div>
					</a>
					<div className="items-center flex flex-col sm:flex-row justify-center mt-8 gap-2">
						<Link to="solutions/cellama" className="w-auto">
							<Button className="w-full flex justify-center items-center px-8 py-6 rounded-full">
								Learn more
							</Button>
						</Link>
						<Link to="contact" className="w-auto">
							<Button
								variant="outline"
								className="w-full flex justify-center items-center px-8  py-6 rounded-full text-black hover:bg-black hover:text-white"
							>
								Contact us
							</Button>
						</Link>
					</div>
				</div>
			</div>

			<SiteFooter />
		</>
	);
}

export default Home;
