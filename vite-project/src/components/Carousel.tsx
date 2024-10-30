"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";

const components: { title: string; href: string; description: string }[] = [
	{
		title: "Privacy",
		href: "/cellama",
		description:
			"ceLLama operates entirely on your local machine, ensuring that your sensitive data remains secure and free from potential leaks. ",
	},
	{
		title: "Ease of Use",
		href: "/cellama",
		description:
			"ceLLama is integrated with well-established single cell pipelines (Suerat & Scanpy), therefore no overhead for the users.",
	},
	{
		title: "Comprehensive Analysis",
		href: "/cellama",
		description:
			"Unlike traditional methods, ceLLama takes into account not only the positive markers but also the negative genes, providing a more holistic and accurate cell type annotation.",
	},
	{
		title: "Extensive Reporting",
		href: "/cellama",
		description:
			"ceLLama generates detailed and customized reports that provide insights into the annotation process and results.",
	},
];

export function CarouselDemo() {
	return (
		<Carousel className="w-full max-w-[300px] sm:max-w-xs">
			<CarouselContent className="-ml-1">
				{components.map((component) => (
					<CarouselItem key={component.title} className="pl-1">
						<Card>
							<CardContent className="flex aspect-[16/20] sm:aspect-square items-center justify-center p-2 sm:p-4">
								<div className="w-full">
									<h2 className="text-base sm:text-xl font-semibold text-center">
										{component.title}
									</h2>
									<p className="text-sm text-muted-foreground mt-2 text-center">
										{component.description}
									</p>
								</div>
							</CardContent>
						</Card>
					</CarouselItem>
				))}
			</CarouselContent>
			<CarouselPrevious className="hidden sm:flex" />
			<CarouselNext className="hidden sm:flex" />
		</Carousel>
	);
}
