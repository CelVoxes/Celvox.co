import { Navbar } from "@/components/header/Navbar";
import { SiteFooter } from "@/components/Footer";
import { Separator } from "@/components/ui/separator";

export function Blog() {
	return (
		<>
			<Navbar />
			<div className="min-h-screen flex flex-col">
				<div className="max-w-screen-2xl mx-auto px-4 py-16">
					<div className="max-w-4xl mx-auto text-2xl font-normal text-left text-black dark:text-neutral-400">
						<a href="blog/TCC/index.html" className="hover:underline">
							Can Cells Talk?
						</a>
						<div className="mx-auto text-sm text-left text-neutral-600 dark:text-neutral-400">
							July 24, 2024
						</div>
						<br />
						<div className="mx-auto text-base text-left text-neutral-600 dark:text-neutral-400">
							Do cells have a language? With the recent success of large
							language models and the vast number of curated gene pathways, we
							visited this fundamental question one more time.
						</div>
						<br />
						<Separator />
					</div>
				</div>
			</div>
			<SiteFooter />
		</>
	);
}

export default Blog;
