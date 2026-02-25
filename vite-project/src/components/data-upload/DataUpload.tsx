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
import { Badge } from "@/components/ui/badge";
import { CacheFile, fetchCacheFiles, uploadSampleData } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { FileList } from "./FileList";
import { FilePreview } from "./FilePreview";
import {
	CollapsibleCard,
	CollapsibleCardContent,
	CollapsibleCardTrigger,
} from "../ui/collapsible-card";
import { Database, FileUp, Loader2 } from "lucide-react";

export function DataUpload({
	onDataChanged,
	embedded = false,
}: {
	onDataChanged?: () => void;
	embedded?: boolean;
} = {}) {
	const { toast } = useToast();
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [filePreview, setFilePreview] = useState<string[][]>([]);
	const [fileHeaders, setFileHeaders] = useState<string[]>([]);
	const [showPreview, setShowPreview] = useState(false);
	const [showWorkspacePanel, setShowWorkspacePanel] = useState(false);

	const [cacheFiles, setCacheFiles] = useState<CacheFile[]>([]);

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files && event.target.files.length > 0) {
			const files = Array.from(event.target.files);
			setSelectedFiles(files);
			setShowPreview(true);
			const isReadsPerGene = files[0].name
				.toLowerCase()
				.endsWith("readspergene.out.tab");

			const reader = new FileReader();
			reader.onload = (e) => {
				const text = e.target?.result as string;
				const numLinesToShow = 5;
				const lines = text.split("\n", numLinesToShow + 1);

				if (isReadsPerGene) {
					setFileHeaders(["gene", "unstranded", "strand_fwd", "strand_rev"]);
					const preview = lines
						.slice(0, numLinesToShow)
						.map((line) => line.split("\t").map((cell) => cell.trim()));
					setFilePreview(preview);
				} else {
					const headers = lines[0]
						.split(/[,\t |;:]/)
						.map((header) => header.trim());
					setFileHeaders(headers);

					const preview = lines
						.slice(1, numLinesToShow)
						.map((line) => line.split(/[,\t |;:]/).map((cell) => cell.trim()));
					setFilePreview(preview);
				}
			};
			reader.readAsText(files[0]);
		} else {
			setSelectedFiles([]);
			setFileHeaders([]);
			setFilePreview([]);
		}
	};

	const handleUpload = async () => {
		if (selectedFiles.length === 0) {
			toast({
				title: "Error",
				description: "Please select a file first!",
				variant: "destructive",
			});
			return;
		}

		setIsUploading(true);
		try {
			await uploadSampleData(selectedFiles);
			onDataChanged?.();
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
			onDataChanged?.();
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

	const userFiles = cacheFiles.filter((file) => file.isUserUploaded);
	const cacheArtifacts = cacheFiles.filter((file) => !file.isUserUploaded);
	const selectedReadsPerGene = selectedFiles.some((file) =>
		file.name.toLowerCase().endsWith("readspergene.out.tab"),
	);
	const selectedCsv =
		selectedFiles.length === 1 &&
		selectedFiles[0].name.toLowerCase().endsWith(".csv");
	const showWorkspaceFiles = cacheFiles.length > 0 || !embedded;

	const containerClass = embedded
		? "w-full border-border/60 shadow-none bg-background/70"
		: "w-full";

	const compactUploadBody = (
		<div className="space-y-3">
			<div className="rounded-lg border border-border/70 bg-background/60 p-4">
				<div className="text-sm font-medium">Upload count data</div>
				<p className="mt-1 text-xs text-muted-foreground">
					Use one CSV matrix or multiple `ReadsPerGene.out.tab` files.
				</p>
				<div className="mt-3 flex flex-col lg:flex-row gap-3 lg:items-center">
					<Input
						type="file"
						onChange={handleFileChange}
						accept=".csv,.tab"
						multiple
						className="flex-1 bg-background"
					/>
					<Button
						onClick={handleUpload}
						disabled={selectedFiles.length === 0 || isUploading}
						className="w-full lg:w-auto lg:min-w-[9rem]"
					>
						{isUploading ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Uploading
							</>
						) : (
							<>
								<FileUp className="h-4 w-4 mr-2" />
								Upload
							</>
						)}
					</Button>
				</div>
				{selectedFiles.length > 0 && (
					<div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<Badge variant="secondary" className="font-medium">
							{selectedFiles.length} selected
						</Badge>
						<span>
							{selectedReadsPerGene
								? "ReadsPerGene detected"
								: selectedCsv
									? "CSV matrix detected"
									: "Tabular input detected"}
						</span>
					</div>
				)}
				<div className="mt-2">
					<a
						href="/example-TCGA.csv"
						className="text-xs text-muted-foreground hover:underline"
					>
						Download example file
					</a>
				</div>
			</div>

			{selectedFiles.length > 0 && (
				<div className="rounded-lg border border-border/70 bg-background/60 p-3">
					<div className="flex items-center justify-between gap-2">
						<div className="text-sm font-medium">Preview</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setShowPreview((prev) => !prev)}
						>
							{showPreview ? "Hide" : "Show"}
						</Button>
					</div>
					{showPreview && (
						<div className="mt-2">
							<FilePreview
								fileNames={selectedFiles.map((file) => file.name)}
								fileHeaders={fileHeaders}
								filePreview={filePreview}
							/>
						</div>
					)}
				</div>
			)}

			{cacheFiles.length > 0 && (
				<div className="rounded-lg border border-border/70 bg-background/60 p-3">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<Database className="h-4 w-4 text-muted-foreground" />
							<div className="text-sm font-medium">Workspace Files</div>
							<Badge variant="outline" className="font-medium">
								{cacheFiles.length}
							</Badge>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setShowWorkspacePanel((prev) => !prev)}
						>
							{showWorkspacePanel ? "Hide" : "Show"}
						</Button>
					</div>
					{showWorkspacePanel && (
						<div className="mt-2">
							<FileList
								cacheFiles={cacheFiles}
								onRefresh={() => refreshCacheFiles()}
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);

	const uploadBody = (
		<>
			<div className="space-y-4">
				{(selectedFiles.length > 0 || cacheFiles.length > 0 || !embedded) && (
					<div className="flex flex-wrap items-center gap-2">
						{!embedded && (
							<Badge variant="outline" className="font-medium">
								CSV or STAR ReadsPerGene
							</Badge>
						)}
						{selectedFiles.length > 0 && (
							<Badge variant="secondary" className="font-medium">
								{selectedFiles.length} file
								{selectedFiles.length === 1 ? "" : "s"} selected
							</Badge>
						)}
						{cacheFiles.length > 0 && (
							<Badge variant="outline" className="font-medium">
								{userFiles.length} uploaded / {cacheArtifacts.length} cache
								artifact
								{cacheArtifacts.length === 1 ? "" : "s"}
							</Badge>
						)}
					</div>
				)}

				<div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4">
					<div className="flex flex-col lg:flex-row gap-4 lg:items-center">
						<div className="flex-1 space-y-2">
							<div className="text-sm font-medium">Select input files</div>
							<div className="text-xs text-muted-foreground leading-relaxed">
								Upload one count matrix (`.csv`) or multiple
								`ReadsPerGene.out.tab` files to build a matrix automatically.
							</div>
							<Input
								type="file"
								onChange={handleFileChange}
								accept=".csv,.tab"
								multiple
								className="flex-1 bg-background"
							/>
						</div>
						<div className="w-full lg:w-auto">
							<Button
								onClick={handleUpload}
								disabled={selectedFiles.length === 0 || isUploading}
								className="w-full lg:min-w-[10rem]"
							>
								{isUploading ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Uploading
									</>
								) : (
									<>
										<FileUp className="h-4 w-4 mr-2" />
										Upload Files
									</>
								)}
							</Button>
						</div>
					</div>
					{selectedFiles.length === 0 && (
						<div className="mt-3 text-xs text-muted-foreground">
							Tip: use `_unstranded` counts for Bridge molecular prediction.
						</div>
					)}
					{selectedFiles.length > 0 && (
						<div className="mt-3 text-xs text-muted-foreground">
							Detected format:{" "}
							<strong>
								{selectedReadsPerGene
									? "ReadsPerGene.out.tab (multi-file matrix build)"
									: selectedCsv
										? "CSV count matrix"
										: "Mixed/other tabular input"}
							</strong>
						</div>
					)}
				</div>

				{selectedFiles.length > 0 && (
					<FilePreview
						fileNames={selectedFiles.map((file) => file.name)}
						fileHeaders={fileHeaders}
						filePreview={filePreview}
					/>
				)}

				{showWorkspaceFiles && (
					<div className="rounded-lg border border-border/70 bg-background/60 p-3">
						<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<Database className="h-4 w-4 text-muted-foreground" />
								<div className="text-sm font-medium">Workspace Files</div>
							</div>
							<div className="text-xs text-muted-foreground">
								User uploads and generated cache files for this session
							</div>
						</div>
						<FileList
							cacheFiles={cacheFiles}
							onRefresh={() => refreshCacheFiles()}
						/>
					</div>
				)}
			</div>
		</>
	);

	return cacheFiles?.length == 0 ? (
		<Card className={containerClass}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<FileUp className="h-4 w-4 text-primary" />
					Upload Data
				</CardTitle>
				{!embedded && (
					<CardDescription className="space-y-4">
						Upload a CSV file with genes as rownames and samples as columns.
						<br />
						Or select multiple ReadsPerGene.out.tab files to build a count
						matrix.
						<br />
						<a href="/example-TCGA.csv" className=" text-xs hover:underline">
							[Download example file]
						</a>
					</CardDescription>
				)}
			</CardHeader>
			<CardContent>{embedded ? compactUploadBody : uploadBody}</CardContent>
		</Card>
	) : (
		<CollapsibleCard className={containerClass}>
			<CollapsibleCardTrigger>
				<div className="flex items-center justify-between gap-3 px-6">
					<div className="flex items-center gap-2">
						<FileUp className="h-4 w-4 text-primary" />
						<CardTitle>Upload Data</CardTitle>
					</div>
					<div className="hidden sm:flex items-center gap-2">
						<Badge variant="secondary" className="font-medium">
							{userFiles.length} uploaded
						</Badge>
						<Badge variant="outline" className="font-medium">
							{cacheFiles.length} total files
						</Badge>
					</div>
				</div>
			</CollapsibleCardTrigger>
			<CollapsibleCardContent>
				{!embedded && (
					<CardHeader>
						<CardDescription className="space-y-4">
							Upload a CSV file with genes as rownames and samples as columns.
							<br />
							Or select multiple ReadsPerGene.out.tab files to build a count
							matrix.
							<br />
							<a href="/example-TCGA.csv" className=" text-xs hover:underline">
								[Download example file]
							</a>
						</CardDescription>
					</CardHeader>
				)}
				{embedded ? compactUploadBody : uploadBody}
			</CollapsibleCardContent>
		</CollapsibleCard>
	);
}

export default DataUpload;
