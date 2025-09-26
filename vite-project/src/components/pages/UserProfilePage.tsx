import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	getAuth,
	onAuthStateChanged,
	updatePassword,
	reauthenticateWithCredential,
	EmailAuthProvider,
} from "firebase/auth";
import { SiteFooter } from "@/components/Footer";
// import {
// 	Select,
// 	SelectContent,
// 	SelectItem,
// 	SelectTrigger,
// 	SelectValue,
// } from "@/components/ui/select";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Navbar } from "../header/Navbar";

const UserProfile: React.FC = () => {
	const [email, setEmail] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const [planStatus, setPlanStatus] = useState<string>("Loading...");
	const [nextRenewalDate, setNextRenewalDate] = useState<Date | null>(null);
	const navigate = useNavigate();
	const { toast } = useToast();

	const [activeTab, setActiveTab] = useState("profile");
	const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

	useEffect(() => {
		const auth = getAuth();
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (user) {
				setEmail(user.email || "");
				updatePlanStatus(new Date(user.metadata.creationTime || ""));
			} else {
				// User is signed out, redirect to login page
				navigate("/login");
			}
		});

		return () => unsubscribe();
	}, [navigate]);

	useEffect(() => {
		const handleResize = () => setIsMobile(window.innerWidth < 768);
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	const tabs = [
		{ id: "profile", label: "Profile" },
		{ id: "security", label: "Security" },
		{ id: "subscription", label: "Subscription" },
	];

	const updatePlanStatus = (creationDate: Date) => {
		const now = new Date();
		const trialEndDate = new Date(
			creationDate.getTime() + 7 * 24 * 60 * 60 * 1000
		);

		if (now < trialEndDate) {
			setPlanStatus("Free Trial");
			setNextRenewalDate(trialEndDate);
		} else {
			setPlanStatus("Pro");
			const lastRenewalDate = new Date(
				Math.floor(now.getTime() / (30 * 24 * 60 * 60 * 1000)) *
					(30 * 24 * 60 * 60 * 1000)
			);
			setNextRenewalDate(
				new Date(lastRenewalDate.getTime() + 30 * 24 * 60 * 60 * 1000)
			);
		}
	};

	const handlePasswordChange = async () => {
		if (newPassword !== confirmPassword) {
			toast({
				title: "Error",
				description: "New passwords do not match.",
				variant: "destructive",
			});
			return;
		}

		if (newPassword.length < 6) {
			toast({
				title: "Error",
				description: "New password must be at least 6 characters long.",
				variant: "destructive",
			});
			return;
		}

		setIsLoading(true);
		const auth = getAuth();
		const user = auth.currentUser;

		if (user && user.email) {
			try {
				// Re-authenticate user
				const credential = EmailAuthProvider.credential(
					user.email,
					currentPassword
				);
				await reauthenticateWithCredential(user, credential);

				// Change password
				await updatePassword(user, newPassword);

				toast({
					title: "Success",
					description: "Password changed successfully.",
				});

				// Clear password fields
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");
			} catch (error) {
				console.error(error);
				toast({
					title: "Error",
					description:
						"Failed to change password. Please check your current password and try again.",
					variant: "destructive",
				});
			}
		} else {
			toast({
				title: "Error",
				description: "User not found. Please log in again.",
				variant: "destructive",
			});
			navigate("/login");
		}

		setIsLoading(false);
	};

	const handleCancelSubscription = async () => {
		const url = new URL(
			"https://script.google.com/macros/s/AKfycbyPaLEcdvfjZl6b98vRay0cdYcbOSTCpEpdua_S20HMtllaSOEEd9aFK1Rpy78lFsZb/exec"
		);
		url.searchParams.append("name", email); // Using email as name
		url.searchParams.append("email", email);
		url.searchParams.append(
			"message",
			"User wants to cancel their subscription"
		);

		try {
			const response = await fetch(url.toString(), {
				method: "GET",
			});

			if (response.ok) {
				toast({
					title: "Subscription Cancellation",
					description:
						"Your cancellation request has been sent. We'll process it soon.",
				});
			} else {
				throw new Error("Failed to send cancellation request");
			}
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description:
					"Failed to send cancellation request. Please try again or contact support.",
				variant: "destructive",
			});
		}
	};

	const renderTabContent = () => {
		switch (activeTab) {
			case "profile":
				return (
					<Card className="w-full max-w-4xl mx-auto mt-10">
						<div className="p-8">
							<h2 className="text-2xl font-semibold mb-4">User Profile</h2>
							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-700">
									Email Address
								</label>
								<input
									disabled
									type="email"
									value={email}
									readOnly
									className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
								/>
							</div>
						</div>
					</Card>
				);

			case "security":
				return (
					<Card className="w-full max-w-4xl mx-auto">
						<div className="p-8">
							<h2 className="text-2xl font-semibold mb-4">Change Password</h2>
							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-700">
									Current Password
								</label>
								<input
									type="password"
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
								/>
							</div>
							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-700">
									New Password
								</label>
								<input
									type="password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
								/>
							</div>
							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-700">
									Confirm New Password
								</label>
								<input
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
								/>
							</div>
							<Button
								className="w-full"
								onClick={handlePasswordChange}
								disabled={isLoading}
							>
								{isLoading ? "Changing Password..." : "Change Password"}
							</Button>
						</div>
					</Card>
				);
			case "subscription":
				return (
					<Card className="w-full max-w-4xl mx-auto">
						<div className="p-4">
							<h2 className="text-2xl font-semibold mb-4">
								Subscription Management
							</h2>
							<div className="mb-6">
								<h3 className="text-lg font-medium mb-2">
									Current Plan: {planStatus}
								</h3>
								<p className="text-sm text-gray-600 mb-2">
									Next renewal: {nextRenewalDate?.toLocaleDateString()}
								</p>
								<div className="flex justify-center">
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button variant="ghost">Cancel Subscription</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Are you absolutely sure?
												</AlertDialogTitle>
												<AlertDialogDescription>
													This action cannot be undone. This will permanently
													cancel your subscription and remove your data from our
													servers.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													className="bg-red-600 hover:bg-red-700"
													onClick={handleCancelSubscription}
												>
													Continue
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</div>
						</div>
					</Card>
				);
			default:
				return null;
		}
	};

	return (
		<>
			<Navbar />
			<div className="flex flex-col min-h-screen">
				<div className="flex-1 w-full">
					<div className="container mx-auto py-10 px-4">
						<h1 className="text-3xl font-bold mb-8 text-center">
							User Dashboard
						</h1>
						{isMobile ? (
							<ScrollArea className="w-full rounded-md border p-4">
								{tabs.map((tab) => (
									<div
										key={tab.id}
										className={`p-4 cursor-pointer ${
											activeTab === tab.id ? "bg-secondary" : ""
										}`}
										onClick={() => setActiveTab(tab.id)}
									>
										{tab.label}
									</div>
								))}
							</ScrollArea>
						) : (
							<Tabs
								value={activeTab}
								onValueChange={setActiveTab}
								className="w-full"
							>
								<TabsList className="grid grid-cols-3 gap-2 mb-4">
									{tabs.map((tab) => (
										<TabsTrigger key={tab.id} value={tab.id}>
											{tab.label}
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						)}
						<div className="mt-4">{renderTabContent()}</div>
					</div>
				</div>
			</div>
			<SiteFooter />
		</>
	);
};

export default UserProfile;
