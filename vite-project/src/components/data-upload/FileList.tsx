import { useState } from "react";

import { CacheFile, deleteCacheFile } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
	Table,
	TableHeader,
	TableRow,
	TableCell,
	TableBody,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export interface FileListProps {
	onRefresh: () => void;
	cacheFiles: CacheFile[];
}

export function FileList({ onRefresh, cacheFiles }: FileListProps) {
	const { toast } = useToast();

	const [fileToDelete, setFileToDelete] = useState<string | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const confirmDelete = (fileName: string) => {
		setFileToDelete(fileName);
		setIsDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!fileToDelete || isDeleting) return;

		setIsDeleting(true);
		try {
			await deleteCacheFile(fileToDelete);
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
			setIsDeleting(false);
			onRefresh();
		}
	};

	const handleDeleteAll = async () => {
		if (cacheFiles.length === 0 || isDeleting) return;

		setIsDeleting(true);
		const fileNames = cacheFiles.map((file) => file.name);

		try {
			await Promise.all(fileNames.map((fileName) => deleteCacheFile(fileName)));
			toast({
				title: "Success",
				description: `${fileNames.length} workspace file${
					fileNames.length === 1 ? "" : "s"
				} deleted successfully.`,
			});
		} catch (error) {
			console.error("Error deleting workspace files:", error);
			toast({
				title: "Error",
				description: "Failed to delete all files. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsDeleteAllDialogOpen(false);
			setIsDeleting(false);
			onRefresh();
		}
	};

	if (!Array.isArray(cacheFiles) || cacheFiles.length === 0) {
		return (
			<div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
				No workspace files yet. Upload a matrix to get started.
			</div>
		);
	}

	return (
		<>
			{/* Mobile view - Updated */}
			<div className="space-y-4 md:hidden">
				<div className="flex justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsDeleteAllDialogOpen(true)}
						disabled={isDeleting}
						className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
					>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete all
					</Button>
				</div>
				<ScrollArea className="h-[400px] w-full">
					{cacheFiles.map((file, index) => (
						<Card key={index} className="p-4 my-2 shadow-none border-border/60">
							<div className="space-y-2">
								<p className="font-medium break-all">{file.name}</p>

								<div className="space-y-1 text-sm text-muted-foreground">
									<div className="flex justify-between gap-2">
										<span>
											Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
										</span>
										<Badge
											variant={file.isUserUploaded ? "secondary" : "outline"}
										>
											{file.isUserUploaded ? "User File" : "Cache"}
										</Badge>
									</div>
									<div>Modified: {new Date(file.modified).toLocaleString()}</div>
								</div>

								<Button
									variant="outline"
									size="sm"
									onClick={() => confirmDelete(file.name)}
									disabled={isDeleting}
									className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 w-full mt-2"
								>
									Delete
								</Button>
							</div>
						</Card>
					))}
				</ScrollArea>
			</div>

			{/* Desktop view */}
			<div className="hidden md:block">
				<div className="mb-3 flex justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsDeleteAllDialogOpen(true)}
						disabled={isDeleting}
						className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
					>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete all
					</Button>
				</div>
				<Table>
					<TableHeader className="bg-muted/30">
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
								<TableRow key={index} className="hover:bg-muted/20">
									<TableCell className="p-2 border-b">{file.name}</TableCell>
									<TableCell className="p-2 border-b">
										{(file.size / (1024 * 1024)).toFixed(2)} MB
									</TableCell>
									<TableCell className="p-2 border-b">
										{new Date(file.modified).toLocaleString()}
									</TableCell>
									<TableCell className="p-2 border-b">
										<Badge
											variant={file.isUserUploaded ? "secondary" : "outline"}
										>
											{file.isUserUploaded ? "User Uploaded" : "Cache File"}
										</Badge>
									</TableCell>
									<TableCell className="p-2 border-b">
										<Button
											variant="ghost"
											onClick={() => confirmDelete(file.name)}
											disabled={isDeleting}
											className="text-red-500 hover:text-red-700 hover:bg-red-50"
										>
											Delete
										</Button>
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

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogTitle>Confirm Deletion</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete {fileToDelete}?
					</DialogDescription>
					<DialogFooter>
						<Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={isDeleting}
						>
							{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={isDeleteAllDialogOpen}
				onOpenChange={setIsDeleteAllDialogOpen}
			>
				<DialogContent>
					<DialogTitle>Delete All Workspace Files</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete all {cacheFiles.length} workspace
						files? This removes uploaded data and generated cache files for this
						session.
					</DialogDescription>
					<DialogFooter>
						<Button
							onClick={() => setIsDeleteAllDialogOpen(false)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteAll}
							disabled={isDeleting}
						>
							{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Delete all
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
