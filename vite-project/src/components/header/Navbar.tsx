"use client";
import React from "react";
import { useState } from "react";
import logo from "@/assets/logo-small.png";
import { cn } from "@/lib/utils";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Link, useNavigate } from "react-router-dom";
import MobileNav from "@/components/header/MobileNavbar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/firebase";
import { useAuthState } from "react-firebase-hooks/auth";

const components: { title: string; href: string; description: string }[] = [
	{
		title: "ceLLama",
		href: "/solutions/cellama",
		description:
			"An automated cell type annotation pipeline using local Large Language Models (LLMs).",
	},
	{
		title: "seAMLess",
		href: "/solutions/seAMLess",
		description:
			"An ML-integrated interactive visualization platform for RNA sequencing analysis.",
	},
];

export function Navbar() {
	const [user] = useAuthState(auth);

	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const toggleMobileMenu = () => {
		setIsMobileMenuOpen(!isMobileMenuOpen);
	};

	const navigate = useNavigate();

	const handleLogout = async () => {
		try {
			await signOut(auth);
			navigate("/login"); // Redirect to login page after logout
		} catch (error) {
			console.error("Error logging out:", error);
		}
	};

	return (
		<header className="sticky top-0 z-50 w-full border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ">
			<div className="flex h-full max-w-screen-2xl items-center justify-between">
				<Link to="/">
					<img
						src={logo}
						alt="Celvox Logo"
						style={{
							width: "50px",
							height: "50px",
							margin: "10px 0px 10px 10px",
						}}
					/>
				</Link>

				{/* Desktop menu */}
				<nav className="hidden md:flex">
					<NavigationMenu>
						<NavigationMenuList>
							<NavigationMenuItem>
								<NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
									<Link className=" text-black" to="/">
										Home
									</Link>
								</NavigationMenuLink>
							</NavigationMenuItem>
							<NavigationMenuItem>
								<NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
									<Link className=" text-black" to="/about">
										About
									</Link>
								</NavigationMenuLink>
							</NavigationMenuItem>

							<NavigationMenuItem>
								<NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
									<Link className=" text-black" to="/blog">
										Blog
									</Link>
								</NavigationMenuLink>
							</NavigationMenuItem>

							<NavigationMenuItem>
								<NavigationMenuTrigger className=" text-black">
									Solutions
								</NavigationMenuTrigger>
								<NavigationMenuContent>
									<ul className="grid w-[200px] gap-3 p-4 md:w-[250px] md:grid-cols-1 lg:w-[300px] ">
										{components.map((component) => (
											<Link key={component.title} to={component.href}>
												<ListItem title={component.title}>
													{component.description}
												</ListItem>
											</Link>
										))}
									</ul>
								</NavigationMenuContent>
							</NavigationMenuItem>

							<NavigationMenuItem>
								<NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
									<Link className=" text-black" to="/contact">
										Contact
									</Link>
								</NavigationMenuLink>
							</NavigationMenuItem>

							{/* Add user-related menu items when logged in */}
							{user && (
								<NavigationMenuItem>
									<NavigationMenuTrigger className="text-black">
										<div className="flex items-center gap-2">
											<Avatar className="h-8 w-8">
												<AvatarImage src={user?.photoURL || ""} />
												<AvatarFallback>
													{user?.email?.[0].toUpperCase()}
												</AvatarFallback>
											</Avatar>
										</div>
									</NavigationMenuTrigger>

									<NavigationMenuContent className="w-[400px]">
										<ul className="grid w-[300px] gap-3 p-4 right-0">
											<Link to="/dashboard">
												<ListItem title="Dashboard" className="w-full">
													Access your dashboard
												</ListItem>
											</Link>
											<Link to="/profile">
												<ListItem title="Profile">Manage your profile</ListItem>
											</Link>
											<button onClick={handleLogout} className="w-full">
												<ListItem title="Logout">
													Sign out of your account
												</ListItem>
											</button>
										</ul>
									</NavigationMenuContent>
								</NavigationMenuItem>
							)}
						</NavigationMenuList>
					</NavigationMenu>
				</nav>

				{/* Mobile menu button */}

				<Button
					variant="outline"
					onClick={toggleMobileMenu}
					className="md:hidden text-black bg-white p-2 rounded-md hover:bg-black hover:text-white"
				>
					<Menu size={24} />
				</Button>
				<MobileNav isOpen={isMobileMenuOpen} toggleMenu={toggleMobileMenu} />
			</div>
		</header>
	);
}

const ListItem = React.forwardRef<
	React.ElementRef<"a">,
	React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
	return (
		<li>
			<NavigationMenuLink asChild>
				<span
					ref={ref}
					className={cn(
						"block select-none space-y-2 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
						className
					)}
					{...props}
				>
					<div className="text-sm font-medium leading-none">{title}</div>
					<p className="line-clamp-3 text-sm leading-snug text-muted-foreground">
						{children}
					</p>
				</span>
			</NavigationMenuLink>
		</li>
	);
});
ListItem.displayName = "ListItem";
