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
		<Carousel className="w-full max-w-xs">
			<CarouselContent>
				{components.map((component) => (
					<CarouselItem key={component.title}>
						<div className="p-1">
							<Card>
								<CardContent className="flex aspect-square items-center justify-center p-6">
									<div>
										<h2 className="text-xl font-semibold">{component.title}</h2>
										<p>{component.description}</p>
									</div>
								</CardContent>
							</Card>
						</div>
					</CarouselItem>
				))}
			</CarouselContent>
			<CarouselPrevious />
			<CarouselNext />
		</Carousel>
	);
}
