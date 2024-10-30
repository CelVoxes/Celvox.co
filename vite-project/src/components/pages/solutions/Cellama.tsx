import { Navbar } from "@/components/header/Navbar";
import { CarouselDemo } from "@/components/Carousel";
import { SiteFooter } from "@/components/Footer";
import cellama_logo from "@/assets/cellama.png";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Icons } from "@/components/icons";

export function Cellama() {
	return (
		<>
			<Navbar />
			{/* Quote Section */}
			<div className="min-h-[20rem] md:h-[30rem] max-w-4xl mx-auto flex justify-center items-center px-4 py-8">
				<div className="text-sm md:text-md mx-auto font-normal text-neutral-600 dark:text-neutral-400">
					<blockquote cite="https://pubmed.ncbi.nlm.nih.gov/22186258/">
						"We need merely to assume that changes in the genotype produce
						correlated changes in the adult phenotype, but the mechanism of this
						correlation need not concern us."
						<footer className="mt-4">
							C.H. Waddington, <cite>The Epigenotype</cite>, 1942
						</footer>
					</blockquote>
				</div>
			</div>
			{/* Logo Section */}
			<div className="min-h-[20rem] md:h-[30rem] max-w-4xl mx-auto flex justify-center items-center px-4 py-8">
				<div className="text-center">
					<h1 className="text-xl md:text-2xl mb-8 font-normal text-neutral-600 dark:text-neutral-400">
						Introducing CeLLama
					</h1>
					<img
						src={cellama_logo}
						alt="CeLLama Logo"
						className="h-48 w-48 md:h-64 md:w-64 rounded-full mx-auto"
					/>
				</div>
			</div>
			{/* Description Section */}
			<div className="min-h-[15rem] md:h-[20rem] max-w-4xl mx-auto flex justify-center items-center px-4 py-8">
				<div className="text-base md:text-lg mx-auto font-normal text-neutral-600 dark:text-neutral-400 text-center">
					<p className="mb-6">
						<span className="font-bold">ceLLama</span> is an open-source
						streamlined automation pipeline for cell type annotations using
						local Large Language Models (LLMs).
					</p>
					<a
						href="https://github.com/Celvoxes/cellama"
						className="inline-block"
					>
						<Button className="px-16 py-6">
							<Icons.gitHub className="w-4 h-4 mr-2" />
							Github
						</Button>
					</a>
				</div>
			</div>
			{/* Explanation Section */}
			<div className="max-w-3xl mx-auto py-12 md:py-20 px-4">
				<div className="space-y-6 text-sm md:text-base font-normal leading-relaxed text-neutral-600 dark:text-neutral-400">
					<p>
						The relationship between genotype and phenotype is orchestrated by
						the complex interplay of <i>genes</i> - the fundamental units of
						heredity that shape cellular identity. Modern single-cell
						technologies have revolutionized our ability to observe these
						intricate gene networks in action, allowing us to profile and
						classify individual cells with unprecedented precision.
					</p>
					<p>
						However, accurate cell type annotation remains a challenging task,
						typically requiring both domain expertise and significant manual
						effort. While existing automated solutions can provide basic
						classification scores, they lack the ability to explain their
						reasoning.
					</p>
					<p>
						<span className="font-bold">ceLLama</span> bridges this gap by
						leveraging LLMs to provide both accurate annotations and
						human-readable explanations.
					</p>
				</div>
			</div>
			{/* Carousel Section */}
			<div className="min-h-[15rem] md:h-[20rem] max-w-4xl mx-auto flex justify-center items-center py-8">
				<CarouselDemo />
			</div>
			{/* License Section */}
			<div className="min-h-[4rem] md:h-[5rem] max-w-4xl mx-auto flex justify-center items-center px-4 py-4">
				<div className="mx-auto text-xs text-neutral-600 dark:text-neutral-400">
					Note: This project is licensed under the CC BY-NC 4.0 License,
					allowing use with attribution for non-commercial purposes. For more
					details, visit the{" "}
					<Link
						to="https://creativecommons.org/licenses/by-nc/4.0/"
						className="underline hover:text-neutral-800 dark:hover:text-neutral-200"
					>
						license page
					</Link>
					.
				</div>
			</div>
			<SiteFooter />
		</>
	);
}

export default Cellama;
