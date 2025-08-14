"use client";

import { FlipWords } from "@/components/ui/flip-words";

export function FlipWordsDemo() {
	const words = [
		"scientists",
		"doctors",
		"researchers",
		"professors",
		"biologists",
	];

	return (
		<div className="h-[34rem] md:h-[40rem] w-full mx-auto flex justify-center items-center px-4 pt-4 md:pt-6">
			<div className="text-4xl mx-auto font-normal text-neutral-600 dark:text-neutral-400">
				Celvox helps
				<FlipWords words={words} /> <br />
				to understand the language of cells
				<p className="text-xl mt-8 max-w-2xl">
					Our advanced AI-powered platforms transform complex cellular data into
					actionable insights, enabling breakthrough discoveries in life
					sciences.
				</p>
			</div>
		</div>
	);
}
