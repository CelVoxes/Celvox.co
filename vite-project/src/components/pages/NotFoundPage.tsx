import React from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/header/Navbar";
import { SiteFooter } from "@/components/Footer";
import { Button } from "@/components/ui/button";

const NotFoundPage: React.FC = () => {
	return (
		<>
			<Navbar />
			<div className="container mx-auto px-4 py-16 text-center max-w-2xl">
				<h1 className="text-2xl font-bold mb-4">Congratulations!</h1>
				<p className="text-lg font-bold mb-8">
					<br />
					You've reached a page that doesn't exist. Here's a note from Onur
					about the nature of reality...
				</p>
				<p className="mb-8">
					Did you know that the human body consists of 100 trillion cells?
					That's an incredible number. Have you ever wondered how these cells
					come to exist and communicate with each other across space? I
					certainly do.
				</p>
				<p className="mb-8">
					My understanding in 2024 suggests it's primarily through electrical
					signals. I strongly align with Sir Roger Penrose's theory that
					consciousness emerges from quantum mechanical processes. Zoom in or
					out far enough, and everything resolves to physics.
				</p>
				<p className="mb-8">
					We're living in a pivotal moment in human history. We're on the verge
					of understanding everything - from the smallest particles to the
					largest galaxies - all unified by one fundamental principle:{" "}
					<i>Emergence</i>.
				</p>
				<p className="mb-8">
					The pieces are coming together: evolution, neural networks, galactic
					formation, consciousness itself. They're all parts of the same puzzle,
					manifestations of a grand optimization process.
				</p>
				<p className="mb-8 text-xl font-semibold">
					What if the universe itself is a computational process solving an
					equation?
				</p>
				<p className="mb-8">
					Consider this: reality only manifests when observed. Quantum mechanics
					tells us this explicitly. Doesn't this remind you of a computer
					program optimizing its resources? What if we're all part of this
					cosmic optimization?
				</p>
				<p className="mb-8">
					If this is true, there might be ways to understand and influence this
					optimization process. It begins with understanding ourselves: what are
					we optimized for? What are our fundamental constraints?
				</p>
				<p className="mb-8">
					Consider our cells: over 90% are red blood cells, which sacrifice
					their nucleus for efficiency. Similarly, granulocytes, our primary
					immune cells, often discard their nuclei in defense. This suggests a
					profound relationship between cellular mortality and nuclear DNA.
				</p>
				<p className="mb-8">
					Imagine DNA as a program, and our bodies, therefore cells, as the
					hardware that runs this program. Just as computers execute code
					through electrical signals, our cells execute DNA's instructions
					through molecular machinery. The parallels between biological systems
					and computational systems are more than metaphorical - they might be
					fundamental to understanding the nature of information itself.
				</p>
				<p className="mb-12">
					At Celvox, we believe that by studying the fundamental language of
					life - our cells - we can unlock the next chapter of human evolution.
					We're not just observing the universe's grand optimization process;
					we're becoming active participants in it.
				</p>
				<Link to="/">
					<Button className="text-lg px-6 py-4">Return to Reality</Button>
				</Link>
			</div>
			<SiteFooter />
		</>
	);
};

export default NotFoundPage;
