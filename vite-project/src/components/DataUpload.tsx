import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableHeader,
	TableRow,
	TableCell,
	TableBody,
} from "@/components/ui/table";
import {
	uploadSampleData,
	deleteCacheFile,
	fetchCacheFiles,
} from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";

export function DataUpload() {
	const { toast } = useToast();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [cacheFiles, setCacheFiles] = useState<
		{ name: string; size: number; modified: string; isUserUploaded: boolean }[]
	>([]);
	const [fileToDelete, setFileToDelete] = useState<string | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files && event.target.files.length > 0) {
			const file = event.target.files[0];
			setSelectedFile(file);
		}
	};

	useEffect(() => {
		const fetchFiles = async () => {
			try {
				const files = await fetchCacheFiles();
				setCacheFiles(Array.isArray(files) ? files : []);
			} catch (error) {
				console.error("Error fetching cache files:", error);
				toast({
					title: "Error",
					description: "Failed to fetch cache files. Please try again.",
					variant: "destructive",
				});
			}
		};

		fetchFiles();
	}, [toast]); // Add toast to the dependency array

	const handleUpload = async () => {
		if (!selectedFile) {
			toast({
				title: "Error",
				description: "Please select a file first!",
				variant: "destructive",
			});
			return;
		}

		setIsUploading(true);
		try {
			const result = await uploadSampleData(selectedFile);
			toast({
				title: "Success",
				description: `File uploaded successfully. ${result.rows} rows and ${result.cols} columns processed.`,
			});
			setSelectedFile(null);

			setCacheFiles((prevFiles) => [
				...prevFiles,
				{
					name: selectedFile.name,
					size: selectedFile.size,
					modified: new Date().toISOString(),
					isUserUploaded: true, // Mark as user uploaded
				},
			]);
		} catch (error) {
			toast({
				title: "Error",
				description:
					error instanceof Error
						? error.message
						: "Failed to upload file. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsUploading(false);
		}
	};

	const confirmDelete = (fileName: string) => {
		setFileToDelete(fileName);
		setIsDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!fileToDelete) return;

		try {
			await deleteCacheFile(fileToDelete);
			setCacheFiles((prevFiles) =>
				prevFiles.filter((file) => file.name !== fileToDelete)
			);
			toast({
				title: "Success",
				description: `File ${fileToDelete} deleted successfully.`,
			});
		} catch (error) {
			console.error("Error deleting file:", error);
			toast({
				title: "Error",
				description: "Failed to delete file. Please try again.",
				variant: "destructive",
			});
		} finally {
			setFileToDelete(null);
			setIsDialogOpen(false); // Close the dialog
		}
	};

	return (
		<Card className="w-full p-6 shadow-lg rounded-lg">
			<CardHeader className="mb-4">
				<CardTitle className="text-xl font-semibold">Upload Data</CardTitle>
				<CardDescription className="text-gray-600 ">
					Upload a CSV file with genes as rownames and samples as columns.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-center space-x-4 mb-6">
					<Input
						type="file"
						onChange={handleFileChange}
						accept=".csv"
						className="flex-1"
					/>
					<Button
						onClick={handleUpload}
						disabled={!selectedFile || isUploading}
						className="bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300"
					>
						{isUploading ? "Uploading..." : "Upload"}
					</Button>
				</div>
				{selectedFile && (
					<p className="mt-2 text-gray-700">
						Selected file: {selectedFile.name}
					</p>
				)}
				<div className="mt-4">
					<Table className="w-full border-collapse">
						<TableHeader className="bg-gray-100">
							<TableRow>
								<TableCell className="p-2 border-b">File Name</TableCell>
								<TableCell className="p-2 border-b">File Size</TableCell>
								<TableCell className="p-2 border-b">Last Modified</TableCell>
								<TableCell className="p-2 border-b">Type</TableCell>
								<TableCell className="p-2 border-b">Actions</TableCell>
							</TableRow>
						</TableHeader>
						<TableBody>
							{Array.isArray(cacheFiles) && cacheFiles.length > 0 ? (
								cacheFiles.map((file, index) => (
									<TableRow key={index} className="hover:bg-gray-50">
										<TableCell className="p-2 border-b">{file.name}</TableCell>
										<TableCell className="p-2 border-b">
											{(file.size / (1024 * 1024)).toFixed(2)} MB
										</TableCell>
										<TableCell className="p-2 border-b">
											{new Date(file.modified).toLocaleString()}
										</TableCell>
										<TableCell className="p-2 border-b">
											{file.isUserUploaded ? (
												<span className="text-blue-600">User Uploaded</span>
											) : (
												<span className="text-green-600">Cache File</span>
											)}
										</TableCell>
										<TableCell className="p-2 border-b">
											<Dialog
												open={isDialogOpen}
												onOpenChange={setIsDialogOpen}
											>
												<DialogTrigger asChild>
													<Button
														variant="ghost"
														onClick={() => confirmDelete(file.name)}
														className="text-red-500 hover:text-red-700"
													>
														Delete
													</Button>
												</DialogTrigger>
												<DialogContent>
													<DialogTitle>Confirm Deletion</DialogTitle>
													<DialogDescription>
														Are you sure you want to delete {fileToDelete}?
													</DialogDescription>
													<DialogFooter>
														<Button onClick={() => setIsDialogOpen(false)}>
															Cancel
														</Button>
														<Button
															variant="destructive"
															onClick={handleDelete}
														>
															Confirm
														</Button>
													</DialogFooter>
												</DialogContent>
											</Dialog>
										</TableCell>
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell colSpan={5} className="text-center py-4">
										No files available.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

export default DataUpload;
