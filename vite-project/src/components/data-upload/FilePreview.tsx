import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableHeader,
	TableRow,
	TableCell,
	TableBody,
} from "@/components/ui/table";

export interface FilePreviewProps {
  fileName: string
  fileHeaders: string[]
  filePreview: string[][]
}

export function FilePreview({fileName, fileHeaders, filePreview}: FilePreviewProps) {

  return <>
    <p className="text-sm text-muted-foreground mb-4">
      Selected file: {fileName}
    </p>

    {filePreview.length > 0 && (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">File Preview</CardTitle>
          <CardDescription>
            Showing first 4 rows of data
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