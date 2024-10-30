import { Separator } from "@/components/ui/separator";
import { SiteFooter } from "@/components/Footer";
import MarqueeBrandsDemo from "@/components/MarqueeBrands";
import { Navbar } from "../header/Navbar";

export function About() {
	return (
		<>
			<Navbar />
			<div className="min-h-[20rem] md:min-h-[40rem] max-w-4xl mx-auto flex justify-center items-center px-4 py-8">
				<div className="text-2xl md:text-4xl mx-auto font-normal text-neutral-600 dark:text-neutral-400">
					<p>
						Celvox is on a mission to accelerate solving the language of cells.
					</p>
				</div>
			</div>
			<Separator />
			<div className="min-h-[20rem] md:min-h-[40rem] max-w-4xl mx-auto flex justify-center items-center px-4 py-8">
				<div className="text-xl md:text-2xl mx-auto font-normal text-neutral-600 dark:text-neutral-400">
					<p>
						Whether it's oncology, neurobiology, or immunotherapy, Celvox
						empowers scientists and clinicians to make informed decisions,
						fostering innovations that will transform patient care.
					</p>
				</div>
			</div>
			<Separator />
			<div className="min-h-[20rem] md:min-h-[40rem] max-w-4xl mx-auto flex justify-center items-center px-4 py-8">
				<div className="text-xl md:text-2xl mx-auto font-normal text-neutral-600 dark:text-neutral-400">
					<p>
						Our team of experts is dedicated to providing cutting-edge solutions
						and insights to advance the understanding of cellular communication.
						We believe in the power of collaboration and innovation to drive
						progress in the medical and scientific communities.
					</p>
				</div>
			</div>

			<MarqueeBrandsDemo />
			<div className="min-h-[8rem] md:min-h-[10rem] max-w-4xl mx-auto flex justify-center items-center px-4 py-6">
				<div className="text-sm md:text-base mx-auto font-normal text-neutral-600 dark:text-neutral-400">
					<p>
						We publish cutting-edge science in high-impact journals to help
						humanity understand itself.
					</p>
				</div>
			</div>

			<Separator />
			<SiteFooter />
		</>
	);
}

export default About;
