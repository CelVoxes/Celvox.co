// src/components/axon/AxonFAQ.tsx

import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "../ui/button";

/**
 * Axon FAQ
 * - Clear messaging: local execution + cloud LLM dependency
 * - Why downloads are limited: LLM costs & controlled rollout
 * - Internet required: LLM calls
 * - Data privacy: datasets stay local; prompts go to LLM
 * - Future rollout/pricing expectations
 * - JSON-LD for FAQ rich results
 */
export function AxonFAQ({ className = "" }: { className?: string }) {
	// JSON-LD for SEO (FAQPage)
	const faqJsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: [
			{
				"@type": "Question",
				name: "Why can’t everyone download Axon right now?",
				acceptedAnswer: {
					"@type": "Answer",
					text: "Although Axon installs and runs locally, every analysis uses cloud LLMs that incur real GPU costs per request. Unrestricted downloads would lead to uncontrolled usage and unsustainable costs. We are onboarding in waves to balance costs, scale infrastructure, and ensure stability before a broader release.",
				},
			},
			{
				"@type": "Question",
				name: "Why is an internet connection required if Axon runs locally?",
				acceptedAnswer: {
					"@type": "Answer",
					text: "Your datasets are processed locally on your machine, but the AI assistant that generates and explains code relies on cloud LLMs. Internet connectivity is required for those LLM calls.",
				},
			},
			{
				"@type": "Question",
				name: "Will Axon always be limited-access?",
				acceptedAnswer: {
					"@type": "Answer",
					text: "No. Early access lets us refine workflows, improve documentation, and manage LLM costs. We will broaden availability and introduce fair pricing tiers as we scale.",
				},
			},
			{
				"@type": "Question",
				name: "Is my data safe?",
				acceptedAnswer: {
					"@type": "Answer",
					text: "Yes. Axon processes your datasets locally; your files do not leave your computer by default. Only prompts and code instructions are sent to the LLM service. We do not share datasets with third parties.",
				},
			},
			{
				"@type": "Question",
				name: "Why do LLMs cost money?",
				acceptedAnswer: {
					"@type": "Answer",
					text: "LLMs run on specialized GPU clusters. Each request consumes compute and energy, so usage has a real cost. We manage access and will provide pricing aligned with research and industry needs.",
				},
			},
			{
				"@type": "Question",
				name: "Who is prioritized for early access?",
				acceptedAnswer: {
					"@type": "Answer",
					text: "Active research groups and teams working with single-cell, bulk RNA-seq, ATAC-seq, or multi-omics are prioritized. This ensures feedback that directly improves Axon’s scientific workflows.",
				},
			},
		],
	};

	return (
		<section className={className}>
			{/* JSON-LD for FAQ rich results */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
			/>
			<h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-700 text-center mb-6">
				Frequently Asked Questions
			</h2>
			<Accordion
				type="single"
				collapsible
				className="w-full max-w-3xl mx-auto text-left"
			>
				<AccordionItem value="why-no-download">
					<AccordionTrigger className="text-left dark:text-white">
						Why can’t everyone download Axon right now?
					</AccordionTrigger>
					<AccordionContent className="text-slate-700 px-4 mt-4">
						Although Axon installs and runs locally, every analysis uses cloud
						large language models (LLMs) that incur real GPU costs per request.
						Unrestricted downloads would lead to uncontrolled usage and
						unsustainable costs. We’re onboarding in waves to balance costs,
						scale infrastructure, and ensure stability before a broader release.
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="internet-required">
					<AccordionTrigger className="text-left dark:text-white">
						Why is an internet connection required if Axon runs locally?
					</AccordionTrigger>
					<AccordionContent className="text-slate-700 px-4 mt-4">
						Your datasets are processed locally on your machine, but the AI
						assistant that generates and explains code relies on cloud LLMs.
						Internet connectivity is required for those LLM calls.
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="access-scope">
					<AccordionTrigger className="text-left dark:text-white">
						Will Axon always be limited-access?
					</AccordionTrigger>
					<AccordionContent className="text-slate-700 px-4 mt-4">
						No. Early access lets us refine workflows, improve documentation,
						and manage LLM costs. We will broaden availability and introduce
						fair pricing tiers as we scale.
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="data-privacy">
					<AccordionTrigger className="text-left dark:text-white">
						Is my data safe?
					</AccordionTrigger>
					<AccordionContent className="text-slate-700 px-4 mt-4">
						Yes. Axon processes your datasets locally; your files do not leave
						your computer by default. Only prompts and code instructions are
						sent to the LLM service.
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="llm-costs">
					<AccordionTrigger className="text-left dark:text-white">
						Why do LLMs cost money?
					</AccordionTrigger>
					<AccordionContent className="text-slate-700 px-4 mt-4">
						LLMs run on specialized GPU clusters. Each request consumes compute
						and energy, so usage has a real cost. That’s why we manage access
						and will offer pricing aligned with academic and industry needs.
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="prioritization">
					<AccordionTrigger className="text-left dark:text-white">
						Who is prioritized for early access?
					</AccordionTrigger>
					<AccordionContent className="text-slate-700 px-4 mt-4">
						We prioritize active research groups and teams working with
						single-cell, bulk RNA-seq, ATAC-seq, or multi-omics. This ensures
						feedback that directly improves Axon’s scientific workflows.
					</AccordionContent>
				</AccordionItem>
			</Accordion>
			<div className="flex justify-center mt-8">
				More Questions? Join our Discord server.
				<br />
			</div>
			<div className="flex justify-center mt-4">
				<Button
					onClick={() => window.open("https://discord.gg/Ar5SJMgWDN", "_blank")}
					className="group relative overflow-hidden bg-gradient-to-br from-[#5865F2] via-[#4752C4] to-[#5865F2] hover:from-[#4752C4] hover:via-[#3638A0] hover:to-[#4752C4] text-white font-bold px-6 md:px-8 rounded-2xl text-sm md:text-base transition-all duration-500 transform hover:scale-110 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#5865F2]/60 flex items-center justify-center gap-2 md:gap-3 border-2 border-[#5865F2]/60 hover:border-[#4752C4] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-1000 before:ease-out py-4 md:py-6 min-w-[160px] md:min-w-[180px]"
				>
					<div className="absolute inset-0 bg-gradient-to-br from-[#5865F2]/15 via-[#4752C4]/15 to-[#5865F2]/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
					<div className="absolute inset-0 bg-gradient-to-t from-[#5865F2]/25 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300 rounded-2xl"></div>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
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
		</section>
	);
}

export default AxonFAQ;
