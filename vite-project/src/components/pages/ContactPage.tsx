import React, { useState } from "react";
import { Navbar } from "@/components/header/Navbar";
import { SiteFooter } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ContactPage: React.FC = () => {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const { toast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const url = new URL(
			"https://script.google.com/macros/s/AKfycbyPaLEcdvfjZl6b98vRay0cdYcbOSTCpEpdua_S20HMtllaSOEEd9aFK1Rpy78lFsZb/exec"
		);
		url.searchParams.append("name", name);
		url.searchParams.append("email", email);
		url.searchParams.append("message", message);

		try {
			const response = await fetch(url.toString(), {
				method: "GET",
			});

			if (response.ok) {
				toast({
					title: "Success",
					description: "Message sent successfully!",
				});
				setName("");
				setEmail("");
				setMessage("");
			} else {
				toast({
					title: "Error",
					description: "Failed to send message. Please try again.",
					variant: "destructive",
				});
			}
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Failed to send message. Please try again.",
				variant: "destructive",
			});
		}
	};

	return (
		<>
			<Navbar />
			<div className="min-h-screen bg-gradient-to-b from-background to-muted">
				<div className="max-w-4xl w-full mx-auto px-0 md:px-4 py-16">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
						{/* Contact Info Section */}
						<div className="space-y-8">
							<div>
								<h1 className="text-4xl font-bold tracking-tight">
									Get in Touch
								</h1>
								<p className="mt-4 text-muted-foreground">
									Have questions? We'd love to hear from you. Send us a message
									and we'll respond as soon as possible.
								</p>
							</div>
						</div>

						{/* Contact Form Section */}
						<Card className="rounded-xl shadow-lg ">
							<CardHeader> 
								<CardTitle className="text-2xl font-semibold">
									Send us a Message
								</CardTitle>
							</CardHeader>
							<CardContent>
								<form onSubmit={handleSubmit} className="space-y-6">
									<div>
										<label
											htmlFor="name"
											className="block text-sm font-medium mb-2"
										>
											Name
										</label>
										<Input
											id="name"
											value={name}
											onChange={(e) => setName(e.target.value)}
											className="w-full"
											placeholder="John Doe"
											required
										/>
									</div>
									<div>
										<label
											htmlFor="email"
											className="block text-sm font-medium mb-2"
										>
											Email
										</label>
										<Input
											id="email"
											type="email"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											className="w-full"
											placeholder="john@example.com"
											required
										/>
									</div>
									<div>
										<label
											htmlFor="message"
											className="block text-sm font-medium mb-2"
										>
											Message
										</label>
										<Textarea
											id="message"
											rows={5}
											value={message}
											onChange={(e) => setMessage(e.target.value)}
											className="w-full"
											placeholder="Your message here..."
											required
										/>
									</div>
									<Button
										type="submit"
										className="w-full h-11 text-white rounded-md"
									>
										Send Message
									</Button>
								</form>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
			<SiteFooter />
		</>
	);
};

export default ContactPage;
