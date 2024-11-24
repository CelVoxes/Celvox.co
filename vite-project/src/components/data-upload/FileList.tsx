import React, { useEffect, useState } from "react";

import {
	deleteCacheFile,
	fetchCacheFiles,
	CacheFile,
} from "@/utils/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Card,
} from "@/components/ui/card";
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
  onRefresh: () => void
  cacheFiles: CacheFile[]
}

export function FileList({onRefresh, cacheFiles}: FileListProps) {
	const { toast } = useToast();

	const [fileToDelete, setFileToDelete] = useState<string | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const confirmDelete = (fileName: string) => {
		setFileToDelete(fileName);
		setIsDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!fileToDelete) return;

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
      onRefresh()
		}
	};


  if (!Array.isArray(cacheFiles) || cacheFiles.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No files available.
      </div>
    );
  }

  return (
    <>
      {/* Mobile view - Updated */}
      <div className="space-y-4 md:hidden">
        <ScrollArea className="h-[400px] w-full">
          {cacheFiles.map((file, index) => (
            <Card key={index} className="p-4 my-2">
              <div className="space-y-2">
                {/* Filename */}
                <p className="font-medium break-all">{file.name}</p>

                {/* File details */}
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex justify-between gap-2">
                    <span>
                      Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                    <span>
                      Type: {file.isUserUploaded ? "User File" : "Cache File"}
                    </span>
                  </div>
                  <div>
                    Modified: {new Date(file.modified).toLocaleString()}
                  </div>
                </div>

                {/* Delete button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => confirmDelete(file.name)}
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
                    <Button
                      variant="ghost"
                      onClick={() => confirmDelete(file.name)}
                      className="text-red-500 hover:text-red-700"
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

      {/* Move Dialog outside of the mapping functions */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {fileToDelete}?
          </DialogDescription>
          <DialogFooter>
            <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
