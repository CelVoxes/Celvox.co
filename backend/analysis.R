# analysis.R — RNA-seq analysis service layer
#
# Embedding/clustering helpers shared by the analysis endpoints. Sourced with
# local = TRUE so it shares plumber.R's environment (see plumber.R header).

# this function runs t-SNE and saves the results to cache
# TO DO: There should be two modes: discovery and diagnosis
run_tsne <- function(cache_dir) {
    library(Rtsne)
    if (file.exists(file.path(cache_dir, "tsne_result.fst"))) {
        message("Loaded t-SNE results from cache...")

        tsne_df <- read_fst(file.path(cache_dir, "tsne_result.fst"))
        rownames(tsne_df) <- tsne_df[, 1]
        tsne_df <- tsne_df[, -1, drop = FALSE]
    } else {
        message("Reading corrected counts file...")
        # read the corrected counts file
        corrected <- read_fst(file.path(cache_dir, "harmonized_data.fst"))

        rownames(corrected) <- corrected[, 1]
        corrected <- corrected[, -1, drop = FALSE]

        # selected most variable 2000 genes
        vars <- apply(corrected, 1, var)
        corrected_2000 <- corrected[names(vars[order(vars, decreasing = T)[1:2000]]), ]

        message("Running t-SNE...") # TSNE, no pca
        tsne_df <- Rtsne(t(corrected_2000), pca = F)
        tsne_df <- tsne_df$Y
        tsne_df <- data.frame(tsne_df)

        rownames(tsne_df) <- colnames(corrected_2000)
        message("Saving t-SNE results to cache...")
        tsne_df <- cbind(rownames(tsne_df), tsne_df)
        colnames(tsne_df)[1] <- "sample_id"
        write_fst(tsne_df, file.path(cache_dir, "tsne_result.fst"))

        # Cleanup
        rm(corrected_2000, corrected)
        gc()
    }
    return(tsne_df)
}

get_gene_ids <- function(cache_dir) {
    return(read_fst(file.path(cache_dir, "gene_ids.fst")))
}
