"use client";

import Marquee from "react-fast-marquee";
import cell from "@/assets/cell.png";
import leukemia from "@/assets/leukemia.jpg";
import ni from "@/assets/ni-logo-sq.png";
import npjpo from "@/assets/npj-po.svg";
import bloodAdvances from "@/assets/blood-journals.webp";

export default function MarqueeBrandsDemo() {
	return (
		<div className="max-w-4xl mx-auto flex justify-center items-center py-2 md:py-4">
			<Marquee className="overflow-hidden" speed={40} gradientWidth={50}>
				<a href="https://www.nature.com/articles/s41590-023-01717-5">
					<img
						src={ni}
						alt="Nature Immunology Logo"
						className="h-6 md:h-10 mx-2 md:mx-8"
					/>
				</a>
				<a href="https://www.nature.com/articles/s41698-024-00596-9">
					<img
						src={npjpo}
						alt="NPJ Precision Oncology Logo"
						className="h-6 md:h-10 mx-2 md:mx-8"
					/>
				</a>
				<a href="https://www.sciencedirect.com/science/article/pii/S2473952924003823">
					<img
						src={bloodAdvances}
						alt="Blood Advances Logo"
						className="h-10 md:h-16 mx-2 md:mx-8"
					/>
				</a>
				<a href="https://www.cell.com/cell/abstract/S0092-8674(23)00796-1?_=">
					<img
						src={cell}
						alt="Cell Journal Logo"
						className="h-12 md:h-16 mx-2 md:mx-8"
					/>
				</a>	
				<a href="https://www.nature.com/articles/s41375-024-02137-6">
					<img
						src={leukemia}
						alt="Leukemia Journal Logo"
						className="h-12 md:h-16 mx-2 md:mx-8"
					/>
				</a>
			</Marquee>
		</div>
	);
}
