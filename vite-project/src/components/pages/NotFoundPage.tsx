import React from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/header/Navbar";
import { SiteFooter } from "@/components/Footer";
import { Button } from "@/components/ui/button";

const NotFoundPage: React.FC = () => {
	return (
		<>
			<Navbar />
			<div className="container mx-auto px-4 py-16 text-center">
				<h1 className="text-2xl font-bold mb-4">Congratulations!</h1>
				<p className="text-lg font-bold mb-8">
					<br />
					You've reached a page that doesn't exist. Now you can read this
					personal note from Onur, which is not very optimistic...
				</p>
				<p className="mb-8">
					Did you know that human body is made up of 100 trillion cells? That's
					a lot of cells. Have you ever wondered how does these cells come to
					exist and communicate with each other through space? I do too.
				</p>
				<p className="mb-8">
					My intution as of 2024 tells me that it is mostly electrical signals.
					I truly believe that Sir Roger Penrose was right when he said that
					consciousness is due to quantum mechanics. If you zoom in or out
					enough, everything goes back to physics.
				</p>
				<p className="mb-8">
					We're as species in this very special moment of history. We're about
					to understand everything. This not a joke. From smallest particles to
					biggest galaxies, all obey the same law: <i>Emergence</i>.
				</p>
				<p className="mb-8">
					We know many pieces of it, evolution, neural networks, formation of
					galaxies, us. All of them seems like the pieces of the same puzzle.
					All of this is basically part of an optimization problem.
				</p>
				<p className="mb-8 text-xl">
					The universe is a simulation approximating an equation.
				</p>
				<p className="mb-8">
					Take a look around, all of it is rendered when you observe it. We
					know. ALL OF IT. Reality is rendered when you observe it. Does it not
					feel like a computer program and that we're all part of an
					optimization problem?
				</p>
				<p className="mb-8">
					If so, there should be ways to hijack this optimization problem to our
					benefit. This all starts with understanding ourselves. What are we
					optimized for? To die?
				</p>
				<p className="mb-8">
					Most of our cell have limited lifespan. Actually, most of our cells
					are red blood cells (more than 90%), which throw away their nucleus to
					become more efficient. So, they can't replicate themselves and die
					after a few months. Also, granulocytes are the most common cells in
					our immune system. They are very likely to throw away their nucleus to
					protect you. So... there must be a relation between dying and nucleus,
					right?
				</p>
				<p className="mb-8">
					Yes, there is. We call it DNA. It is the blueprint of our cells. It
					contains the information of our cells. It is arguably the most
					important part of our cells. It carries the information that makes us
					who we are. Literally. So, if you can hack this information, you can
					change what we can become.
				</p>
				<p className="mb-8">
					This is the ultimate aim of Celvox. Understanding this language.
					Solving this language. Taking us all further than we can imagine.
				</p>
				<Link to="/">
					<Button>Go Back Home</Button>
				</Link>
			</div>
			<SiteFooter />
		</>
	);
};

export default NotFoundPage;
