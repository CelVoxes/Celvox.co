import { Navbar } from "@/components/header/Navbar";
import { SiteFooter } from "@/components/Footer";
import { Separator } from "@/components/ui/separator";

export function Blog() {
	return (
		<div className="min-h-screen flex flex-col">
			<Navbar />
			<div className="flex-grow max-w-4xl mx-auto flex justify-center items-center px-4">
				<div className="text-2xl mx-auto font-normal text-left text-black dark:text-neutral-400">
					<a href="blog/TCC/index.html" className="hover:underline">
						Can Cells Talk?
					</a>
					<div className="mx-auto text-sm text-left text-neutral-600 dark:text-neutral-400">
						July 24, 2024
					</div>
					<br />
					<div className="mx-auto text-base text-left text-neutral-600 dark:text-neutral-400">
						Do cells have a language? With the recent success of large language
						models and the vast number of curated gene pathways, we visited this
						fundamental question one more time.
					</div>
					<br />
					<Separator />
				</div>
			</div>
			<SiteFooter />
		</div>
	);
}

export default Blog;
