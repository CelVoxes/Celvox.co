("use client");

import { Navbar } from "@/components/header/Navbar";
import { FlipWordsDemo } from "@/components/FlipWords";
import { SiteFooter } from "@/components/Footer";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import SubscribeForm from "@/components/Subscription";
import natureLogo from "@/assets/nature-logo.svg";

export function Home() {
	return (
		<>
			<Navbar />
			<FlipWordsDemo />
			<Separator />
			<div className="h-[40rem] max-w-4xl mx-auto flex justify-center items-center px-4">
				<div className="text-2xl mx-auto text-neutral-600 dark:text-neutral-400">
					Introducing <b>ceLLama</b>,
					<br />
					an automated cell type annotation pipeline using local Large Language
					Models (LLMs).
					<br />
					<br />
					<span className="text-sm">Featured on</span>
					<a
						href="https://www.nature.com/articles/d41586-024-02998-y"
						target="_blank"
						rel="noopener noreferrer"
					>
						<div className="flex items-center justify-center gap-2 mt-2">
							<img src={natureLogo} alt="Nature" />
						</div>
					</a>
					<div className="items-center flex justify-center mt-4">
						<Link to="solutions/cellama">
							<Button className="flex justify-center items-center px-16 py-6 mt-4">
								Start here
							</Button>
						</Link>
					</div>
				</div>
			</div>

			<Separator />
			<div className="h-[20rem] max-w-4xl mx-auto flex justify-center items-center px-4 bg-neutral-100">
				<SubscribeForm />
			</div>

			<SiteFooter />
		</>
	);
}

export default Home;
