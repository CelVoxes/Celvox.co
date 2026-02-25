import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableHeader,
	TableRow,
	TableCell,
	TableBody,
} from "@/components/ui/table";

export interface FilePreviewProps {
  fileNames: string[]
  fileHeaders: string[]
  filePreview: string[][]
}

export function FilePreview({fileNames, fileHeaders, filePreview}: FilePreviewProps) {
  const isMulti = fileNames.length > 1
  const displayNames = isMulti && fileNames.length > 5
    ? [...fileNames.slice(0, 5), `+${fileNames.length - 5} more`]
    : fileNames

  return <>
    <div className="mb-4 rounded-md border border-border/60 bg-background/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-medium">
          {isMulti ? `${fileNames.length} files selected` : "1 file selected"}
        </Badge>
        <span className="text-sm text-muted-foreground break-all">
          {displayNames.join(", ")}
        </span>
      </div>
    </div>

    {filePreview.length > 0 && (
      <Card className="mb-6 shadow-none border-border/60 bg-background/60">
        <CardHeader>
          <CardTitle className="text-sm">File Preview</CardTitle>
          <CardDescription>
            {isMulti ? "Previewing the first file (first 4 rows)" : "Showing first 4 rows of data"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full">
            {fileHeaders.length === 0 ? (
              <p className="text-sm text-red-500">
                Warning: File appears to be empty or in incorrect format
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {fileHeaders.map((header, i) => (
                      <TableCell
                        key={i}
                        className="font-medium bg-muted/50"
                      >
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filePreview.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className="p-2">
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    )}
  </>
}
