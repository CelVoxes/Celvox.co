# ingest.R — RNA-seq ingestion service layer
#
# Raw-input helpers: arg normalization, ReadsPerGene STAR-count parsing, and the
# low-expression gene filter. Sourced with local = TRUE (shares plumber.R's env).

normalize_arg_vector <- function(x) {
    if (is.null(x)) return(NULL)
    if (is.list(x)) return(unlist(x, use.names = FALSE))
    return(as.character(x))
}
is_readspergene_filename <- function(file_names) {
    grepl("ReadsPerGene\\.out( ?\\([0-9]+\\))?\\.tab$", file_names, ignore.case = TRUE)
}
strip_readspergene_suffix <- function(file_name) {
    sub("\\.ReadsPerGene\\.out( ?\\([0-9]+\\))?\\.tab$", "", file_name, ignore.case = TRUE)
}
read_readspergene_files <- function(file_paths, file_names = NULL) {
    sample_names <- if (!is.null(file_names) && length(file_names) == length(file_paths)) {
        basename(file_names)
    } else {
        basename(file_paths)
    }

    dfs <- lapply(seq_along(file_paths), function(i) {
        df <- fread(
            file_paths[i],
            sep = "\t",
            header = FALSE,
            data.table = FALSE
        )

        # Fallback for files where STAR output was re-saved with non-tab whitespace.
        if (ncol(df) < 4) {
            df <- fread(
                file_paths[i],
                header = FALSE,
                data.table = FALSE
            )
        }

        if (ncol(df) < 4) {
            stop("ReadsPerGene.out.tab files must have at least 4 columns (gene, unstranded, strand_fwd, strand_rev).")
        }

        colnames(df)[1:4] <- c("gene", "unstranded", "strand_fwd", "strand_rev")
        df <- df[!startsWith(df$gene, "N_"), c("gene", "unstranded", "strand_fwd", "strand_rev")]

        sample_name <- strip_readspergene_suffix(sample_names[i])
        colnames(df)[2:4] <- c(
            paste0(sample_name, "_unstranded"),
            paste0(sample_name, "_fwd"),
            paste0(sample_name, "_rev")
        )
        return(df)
    })

    count_matrix <- Reduce(function(x, y) merge(x, y, by = "gene", all = FALSE), dfs)
    return(count_matrix)
}
remove_low_expressed_genes <- function(data, threshold = 100) {
    # 100 mRNA threshold
    data <- data[rowSums(data) >= threshold, , drop = FALSE]
    return(data)
}
