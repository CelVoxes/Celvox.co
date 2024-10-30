import { useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

interface MobileNavProps {
	isOpen: boolean;
	toggleMenu: () => void;
}

interface NavItemProps {
	to: string;
	onClick: () => void;
	children: ReactNode;
	subItem?: boolean;
}

const MobileNav: React.FC<MobileNavProps> = ({ isOpen, toggleMenu }) => {
	const [submenuOpen, setSubmenuOpen] = useState(false);
	const [user] = useAuthState(auth);
	const navigate = useNavigate();

	const handleLogout = async () => {
		try {
			await signOut(auth);
			toggleMenu();
			navigate("/login");
		} catch (error) {
			console.error("Error logging out:", error);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 bg-white text-black flex flex-col">
			<div className="flex items-center justify-between p-4 bg-white">
				<h2 className="text-xl font-bold">Menu</h2>
				<button onClick={toggleMenu} className="focus:outline-none">
					<X size={24} />
				</button>
			</div>
			<nav className="flex-grow bg-white text-black z-50 text-left">
				<ul className="p-4 space-y-4">
					<NavItem to="/" onClick={toggleMenu}>
						Home
					</NavItem>
					<NavItem to="/about" onClick={toggleMenu}>
						About
					</NavItem>

					<NavItem to="/blog" onClick={toggleMenu}>
						Blog
					</NavItem>

					<li className="border-b border-black pb-2">
						<button
							onClick={() => setSubmenuOpen(!submenuOpen)}
							className="flex w-full items-center justify-between p-2 text-left font-medium text-base bg-transparent"
						>
							Solutions
							{submenuOpen ? (
								<ChevronUp size={24} />
							) : (
								<ChevronDown size={24} />
							)}
						</button>
						{submenuOpen && (
							<ul className="mt-2 space-y-2 rounded-md">
								<NavItem to="/solutions/cellama" onClick={toggleMenu} subItem>
									ceLLama
								</NavItem>
								<NavItem to="/login" onClick={toggleMenu} subItem>
									seAMLess
								</NavItem>
							</ul>
						)}
					</li>
					<NavItem to="/contact" onClick={toggleMenu}>
						Contact
					</NavItem>

					{user && (
						<>
							<NavItem to="/dashboard" onClick={toggleMenu}>
								Dashboard
							</NavItem>
							<NavItem to="/profile" onClick={toggleMenu}>
								Profile
							</NavItem>
							<li className="border-b border-black pb-2">
								<button
									onClick={handleLogout}
									className="block w-full p-2 text-left font-medium text-base hover:bg-gray-100"
								>
									Logout
								</button>
							</li>
						</>
					)}
				</ul>
			</nav>
		</div>
	);
};

const NavItem: React.FC<NavItemProps> = ({
	to,
	onClick,
	children,
	subItem = false,
}) => (
	<li className={`${subItem ? "" : "border-b border-black pb-2"}`}>
		<Link
			to={to}
			onClick={onClick}
			className={`block p-2 hover:bg-gray-100 ${
				subItem ? "pl-6 text-sm" : "text-base font-medium"
			}`}
		>
			{children}
		</Link>
	</li>
);

export default MobileNav;
