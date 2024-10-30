import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ReloadIcon } from "@radix-ui/react-icons";

function SubscribeForm() {
	const { toast } = useToast();
	const [buttonDisable, setButtonDisable] = useState(false);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault(); // Prevent default form submission

		setButtonDisable(true);

		const formData = new FormData(event.currentTarget); // Collect form data
		const formDataEntries: Record<string, string> = {};
		formData.forEach((value, key) => {
			formDataEntries[key] = value.toString();
		});
		try {
			const params = new URLSearchParams(formDataEntries).toString();
			const response = await fetch(
				`https://script.google.com/macros/s/AKfycbwneoM8x6g-Ehsd1J8j-pcYXy2CNXX4vJtX9rVKGe2GNAETgtJSdENRwhYzogIVrZk23g/exec?${params}`,

				{
					method: "GET",
					redirect: "follow",
				}
			);

			const result = await response.json();

			if (result.result === "success") {
				toast({
					title: "Success!",
					description: "You are subscribed to Celvox updates.",
				});
				formData.set("Name", "");
			} else {
				toast({
					title: "Error!",
					variant: "destructive",
					description: `There was a problem submitting your form.`,
				});
			}
		} catch (error) {
			toast({
				title: "Error!",
				variant: "destructive",
				description: `There was a problem submitting your form: ${
					(error as Error).message
				}`,
			});
		} finally {
			setButtonDisable(false);
		}
	};

	return (
		<div className="text-2xl mx-auto font-normal justify-center items-center text-neutral-600 dark:text-neutral-600">
			Get the latest blog and product news
			<form onSubmit={handleSubmit}>
				<input
					name="Email"
					type="email"
					className="flex w-full text-base px-2 py-2 mt-4 border-2 bg-white dark:bg-neutral-800"
					required
				/>

				<input name="Name" type="hidden" value="Email-update" />

				<input name="Message" type="hidden" value="-" />

				<Button
					type="submit"
					disabled={buttonDisable}
					className="justify-center items-center px-16 py-6 mt-4 bg-neutral-600"
				>
					{buttonDisable && (
						<ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
					)}
					Send
				</Button>
			</form>
		</div>
	);
}

export default SubscribeForm;
