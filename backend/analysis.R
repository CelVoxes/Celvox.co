# analysis.R — RNA-seq analysis service layer
#
# Embedding/clustering helpers shared by the analysis endpoints. Sourced with
# local = TRUE so it shares plumber.R's environment (see plumber.R header).

# Reference-only t-SNE for EXPLORE mode (no uploaded/harmonized session).
# Computes a t-SNE embedding of the selected cohort's reference counts and
# caches it in the SHARED cache/.reference dir (keyed by the cohort selection),
# so it is computed once and reused across users. Returns a data.frame with
# columns X1, X2 and sample_id rownames — same shape as run_tsne().
reference_tsne <- function(disease_selection) {
    library(Rtsne)
    key <- disease_selection_key(disease_selection)
    shared_dir <- file.path("cache", ".reference")
    dir.create(shared_dir, showWarnings = FALSE, recursive = TRUE)
    out_path <- file.path(shared_dir, paste0(key, "_tsne.fst"))

    if (file.exists(out_path)) {
        message("Loaded reference t-SNE from shared cache: ", key)
        tsne_df <- read_fst(out_path)
        rownames(tsne_df) <- tsne_df[, 1]
        return(tsne_df[, -1, drop = FALSE])
    }

    message("Computing reference t-SNE for ", key, " ...")
    ref <- load_reference_uncorrected_counts(disease = disease_selection)
    rownames(ref) <- ref[, 1]
    ref <- ref[, -1, drop = FALSE]

    vars <- apply(ref, 1, var)
    n_top <- min(2000L, nrow(ref))
    top <- ref[names(sort(vars, decreasing = TRUE))[seq_len(n_top)], , drop = FALSE]

    set.seed(42) # deterministic embedding so the shared cache is stable
    tsne <- Rtsne(t(as.matrix(top)), pca = FALSE, check_duplicates = FALSE)
    tsne_df <- data.frame(tsne$Y)
    colnames(tsne_df) <- c("X1", "X2")
    rownames(tsne_df) <- colnames(top)

    write_fst(cbind(sample_id = rownames(tsne_df), tsne_df), out_path)
    rm(ref, top)
    gc()
    tsne_df
}

# t-SNE for a request: the uploaded+harmonized session embedding when one exists
# in the user cache, otherwise the shared reference-only embedding (Explore mode).
session_has_embedding <- function(cache_dir) {
    !is.null(cache_dir) && nzchar(cache_dir) &&
        (file.exists(file.path(cache_dir, "tsne_result.fst")) ||
            file.exists(file.path(cache_dir, "harmonized_data.fst")))
}

# The embedding the rest of the analysis endpoints (tsne overlays) should use:
# session embedding if the user has harmonized samples, else the reference-only
# embedding so the views work in Explore mode without an upload.
embedding_for_request <- function(req) {
    cache_dir <- req$args$cachedir
    if (session_has_embedding(cache_dir)) {
        run_tsne(cache_dir)
    } else {
        reference_tsne(get_request_disease_selection(req))
    }
}

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

# rna_bulk qc-stage handler, invoked behind dispatch_modality_stage("rna_bulk","qc").
# Extracted verbatim from the /qc-metrics endpoint body.
qc_rna_bulk <-function(req) {
    cache_dir <- req$args$cachedir
    # Read the raw uploaded data
    sample_data <- read_fst(file.path(cache_dir, "sample_data.fst"))
    rownames(sample_data) <- sample_data[, 1]
    sample_data <- sample_data[, -1, drop = FALSE]

    # Calculate library sizes
    lib_sizes <- colSums(sample_data)

    # Calculate basic statistics for each sample
    sample_stats <- data.frame(
        sample_id = colnames(sample_data),
        lib_size = lib_sizes,
        detected_genes = colSums(sample_data > 0),
        median_expression = apply(sample_data, 2, median),
        mean_expression = colMeans(sample_data)
    )


    # Calculate expression quantiles for boxplot (0%, 25%, 50%, 75%, 100%)
    expression_quantiles <- apply(sample_data, 2, function(x) {
        quantile(x, probs = c(0, 0.25, 0.5, 0.75, 1), na.rm = TRUE)
    })

    # log2 transform / library size normalize
    sample_data <- log2(edgeR::cpm(sample_data) + 1)
    # Calculate correlation matrix
    cor_matrix <- cor(sample_data)

    # cleanup
    rm(sample_data)
    gc()

    return(list(
        sample_stats = sample_stats,
        correlation_matrix = cor_matrix,
        expression_quantiles = expression_quantiles
    ))
}
