import { Navbar } from "@/components/header/Navbar";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { SiteFooter } from "@/components/Footer";

import axonNoBackground from "@/assets/axon/axon-no-background.png";

export function Axon({ user }: { user: FirebaseUser | null }) {
	const navigate = useNavigate();

	useEffect(() => {
		if (user) {
			navigate("/dashboard");
		}
	}, [user, navigate]);

	return (
		<>
			<Navbar />

			<div className="max-w-7xl mx-auto px-4 md:px-0 md:mx-0 mt-10 md:mt-16">
				<Card className="mx-auto mb-12 md:mb-24 shadow-lg bg-gradient-to-br from-slate-900 via-neutral-900 to-slate-900">
					<CardContent>
						<div className="flex flex-col items-center justify-center text-center mb-12 p-4 md:p-12">
							<img
								src={axonNoBackground}
								alt="Axon"
								className="w-1/4 h-1/4 mb-12"
							/>
							<h1 className="text-5xl md:text-5xl text-center text-white tracking-tight font-black mb-4 md:mb-6 max-w-3xl mt-12 drop-shadow-lg">
								Axon
							</h1>

							<p
								className="text-xl md:text-2xl text-slate-50 max-w-2xl leading-relaxed font-semibold\t
								px-2 md:px-0 my-4"
							>
								AI agent for bioinformatics — generate, run, and explain
								analyses.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<SiteFooter />
		</>
	);
}

export default Axon;
