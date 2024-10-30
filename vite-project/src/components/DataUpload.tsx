import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

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

	const FileList = () => {
		if (!Array.isArray(cacheFiles) || cacheFiles.length === 0) {
			return (
				<div className="text-center py-4 text-muted-foreground">
					No files available.
				</div>
			);
		}

		return (
			<>
				{/* Mobile view */}
				<div className="space-y-4 md:hidden">
					<ScrollArea className="h-[400px] w-full">
						{cacheFiles.map((file, index) => (
							<Card key={index}>
								<CardHeader className="pb-2">
									<div className="flex justify-between items-center">
										<CardTitle className="text-sm font-medium">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="truncate max-w-[200px] block">
															{file.name}
														</span>
													</TooltipTrigger>
													<TooltipContent>
														<p>{file.name}</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</CardTitle>
										<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
											<DialogTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => confirmDelete(file.name)}
													className="text-destructive hover:text-destructive"
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
													<Button variant="destructive" onClick={handleDelete}>
														Confirm
													</Button>
												</DialogFooter>
											</DialogContent>
										</Dialog>
									</div>
								</CardHeader>
								<CardContent className="text-sm">
									<div className="grid grid-cols-2 gap-2">
										<div className="text-muted-foreground text-left">Size</div>
										<div className="text-right">
											{(file.size / (1024 * 1024)).toFixed(2)} MB
										</div>
										<div className="text-muted-foreground text-left">
											Modified
										</div>
										<div className="text-right">
											{new Date(file.modified).toLocaleString()}
										</div>
										<div className="text-muted-foreground text-left">Type</div>
										<div className="text-right">
											{file.isUserUploaded ? (
												<span className="text-blue-600">User Uploaded</span>
											) : (
												<span className="text-green-600">Cache File</span>
											)}
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</ScrollArea>
				</div>

				{/* Desktop view */}
				<div className="hidden md:block">
					<Table>
						<TableHeader className="bg-gray-100">
							<TableRow>
								<TableCell className="p-2 border-b whitespace-nowrap">
									File Name
								</TableCell>
								<TableCell className="p-2 border-b whitespace-nowrap">
									Size
								</TableCell>
								<TableCell className="p-2 border-b whitespace-nowrap">
									Modified
								</TableCell>
								<TableCell className="p-2 border-b whitespace-nowrap">
									Type
								</TableCell>
								<TableCell className="p-2 border-b whitespace-nowrap">
									Actions
								</TableCell>
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
			</>
		);
	};

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Upload Data</CardTitle>
				<CardDescription>
					Upload a CSV file with genes as rownames and samples as columns.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col sm:flex-row gap-4 mb-6">
					<Input
						type="file"
						onChange={handleFileChange}
						accept=".csv"
						className="flex-1"
					/>
					<Button
						onClick={handleUpload}
						disabled={!selectedFile || isUploading}
					>
						{isUploading ? "Uploading..." : "Upload"}
					</Button>
				</div>

				{selectedFile && (
					<p className="text-sm text-muted-foreground mb-4">
						Selected file: {selectedFile.name}
					</p>
				)}

				<FileList />
			</CardContent>
		</Card>
	);
}

export default DataUpload;
