"use client";

import { FlipWords } from "@/components/ui/flip-words";

export function FlipWordsDemo() {
	const words = [
		"scientists",
		"doctors",
		"neurologists",
		"teachers",
		"students",
	];

	return (
		<div className="h-[40rem] w-full mx-auto flex justify-center items-center px-4">
			<div className="text-4xl mx-auto font-normal text-neutral-600 dark:text-neutral-400">
				Celvox helps
				<FlipWords words={words} /> <br />
				to understand the language of cells
			</div>
		</div>
	);
}
