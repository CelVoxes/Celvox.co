export type SolutionNavItem = {
	title: string;
	href: string;
	description: string;
};

export const solutionsNavItems: SolutionNavItem[] = [
	{
		title: "Axon",
		href: "/solutions/axon",
		description:
			"AI-powered biological analysis combining LLM-driven code generation and intelligent dataset discovery.",
	},
	{
		title: "ceLLama",
		href: "/solutions/cellama",
		description:
			"An automated cell type annotation pipeline using local Large Language Models (LLMs).",
	},
	{
		title: "seAMLess",
		href: "/solutions/seAMLess",
		description:
			"An ML-integrated interactive visualization platform for RNA sequencing analysis.",
	},

	// You can add more products here
];
