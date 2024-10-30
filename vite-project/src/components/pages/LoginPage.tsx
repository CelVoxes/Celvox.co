import Login from "@/components/Login";
import SiteHeader from "@/components/Header";
import { Navbar } from "@/components/header/Navbar";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { User as FirebaseUser } from "firebase/auth";

export function LoginPage({ user }: { user: FirebaseUser | null }) {
	const navigate = useNavigate();

	useEffect(() => {
		if (user) {
			navigate("/dashboard");
		}
	}, [user, navigate]);

	return (
		<>
			<Navbar />
			<SiteHeader />
			{!user && (
				<div className="h-[40rem] max-w-screen-3xl mx-auto flex justify-center items-center px-0">
					<div className="text-2xl mx-auto font-normal text-neutral-600 dark:text-neutral-400">
						<Login />
					</div>
				</div>
			)}
		</>
	);
}

export default LoginPage;
