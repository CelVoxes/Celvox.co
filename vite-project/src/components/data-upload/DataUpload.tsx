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
	CacheFile,
	fetchCacheFiles,
	uploadSampleData,
} from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { FileList } from "./FileList";
import { FilePreview } from "./FilePreview";
import { CollapsibleCard, CollapsibleCardContent, CollapsibleCardTrigger } from "../ui/collapsible-card";

export function DataUpload() {
	const { toast } = useToast();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [filePreview, setFilePreview] = useState<string[][]>([]);
	const [fileHeaders, setFileHeaders] = useState<string[]>([]);

	const [cacheFiles, setCacheFiles] = useState<CacheFile[]>([]);

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files && event.target.files.length > 0) {
			const file = event.target.files[0];
			setSelectedFile(file);

			const reader = new FileReader();
			reader.onload = (e) => {
				const text = e.target?.result as string;
				const lines = text.split("\n");

				const headers = lines[0].split(/[,\t |;:]/).map((header) => header.trim());
				setFileHeaders(headers);

				const preview = lines
					.slice(1, 5) // Show 4 rows of data (excluding header)
					.map((line) => line.split(/[,\t |;:]/).map((cell) => cell.trim()));
				setFilePreview(preview);
			};
			reader.readAsText(file);
		}
	};

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
			await uploadSampleData(selectedFile);
			toast({
				title: "Success",
				description: "File uploaded successfully. Refreshing page...",
			});

			// Give the toast a chance to be seen
			setTimeout(() => {
				window.location.reload();
			}, 1500);
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

	const refreshCacheFiles = async () => {
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
	useEffect(() => {
		refreshCacheFiles();
	}, [toast]); // Add toast to the dependency array

	return cacheFiles?.length == 0 ? (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Upload Data</CardTitle>
				<CardDescription className="space-y-4">
					<p>
						Upload a CSV file with genes as rownames and samples as columns.
						<br />
						<a href="/example-TCGA.csv" className=" text-xs hover:underline">
							[Download example file]
						</a>
					</p>
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
					<FilePreview 
						fileName={selectedFile.name} 
						fileHeaders={fileHeaders} 
						filePreview={filePreview}/>
				)}

				<FileList cacheFiles={cacheFiles} onRefresh={() => refreshCacheFiles()} />
			</CardContent>
		</Card>
	) : (
		<CollapsibleCard className="w-full">
			<CollapsibleCardTrigger>
					<CardTitle>Upload Data</CardTitle>
			</CollapsibleCardTrigger>
			<CollapsibleCardContent>
				<CardHeader>
					<CardDescription className="space-y-4">
						<p>
							Upload a CSV file with genes as rownames and samples as columns.
							<br />
							<a href="/example-TCGA.csv" className=" text-xs hover:underline">
								[Download example file]
							</a>
						</p>
					</CardDescription>
				</CardHeader>
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
					<FilePreview 
						fileName={selectedFile.name} 
						fileHeaders={fileHeaders} 
						filePreview={filePreview}/>
				)}

				<FileList cacheFiles={cacheFiles} onRefresh={() => refreshCacheFiles()} />			
			</CollapsibleCardContent>
		</CollapsibleCard>
	);
}


export default DataUpload;
