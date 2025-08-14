import React from "react";
import { Navbar } from "@/components/header/Navbar";
import { SiteFooter } from "@/components/Footer";
type SolutionNavItem = { title: string; href: string; description: string };
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

export function Solutions() {
	const [items, setItems] = React.useState<SolutionNavItem[]>([]);
	React.useEffect(() => {
		let mounted = true;
		fetch("/products.json", { cache: "no-cache" })
			.then((r) => r.json())
			.then((data) => mounted && setItems(data?.solutions ?? []))
			.catch((e) => console.error("Failed to load solutions:", e));
		return () => {
			mounted = false;
		};
	}, []);
	return (
		<>
			<Navbar />
			<div className="max-w-6xl mx-auto px-4 py-16">
				<h1 className="text-3xl font-bold mb-8">Solutions</h1>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{items.map((item) => (
						<Link key={item.href} to={item.href} className="block">
							<Card className="h-full hover:shadow-md transition-shadow">
								<CardHeader>
									<CardTitle>{item.title}</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-muted-foreground">
										{item.description}
									</p>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			</div>
			<SiteFooter />
		</>
	);
}

export default Solutions;
