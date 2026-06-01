# report.R — dysregulation / GSEA report service layer
#
# Harmonized-sample column resolution, per-sample rank statistics, and MSigDB
# pathway sets used by the dysregulation/GSEA endpoints. Sourced with
# local = TRUE (shares plumber.R's env).

resolve_harmonized_sample_column <- function(corrected, requested_sample_id) {
    sample_id <- as.character(requested_sample_id)[1]
    available_cols <- colnames(corrected)
    warning <- NULL

    if (sample_id %in% available_cols) {
        resolved <- sample_id
    } else if (paste0(sample_id, "_sample_data") %in% available_cols) {
        resolved <- paste0(sample_id, "_sample_data")
    } else {
        base <- sub("_sample_data$", "", sample_id, ignore.case = TRUE)
        base_no_strand <- sub("_(unstranded|fwd|rev)$", "", base, ignore.case = TRUE)
        candidates <- c(
            paste0(base_no_strand, "_unstranded_sample_data"),
            paste0(base_no_strand, "_fwd_sample_data"),
            paste0(base_no_strand, "_rev_sample_data"),
            paste0(base_no_strand, "_unstranded"),
            paste0(base_no_strand, "_fwd"),
            paste0(base_no_strand, "_rev"),
            base,
            base_no_strand
        )
        matched <- candidates[candidates %in% available_cols]
        resolved <- if (length(matched) > 0) matched[1] else sample_id
    }

    if (resolved %in% available_cols && grepl("_(fwd|rev)(_sample_data)?$", resolved, ignore.case = TRUE)) {
        warning <- "Using stranded column for dysregulation. Prefer *_unstranded unless your protocol is stranded."
    }

    list(
        requested_sample = requested_sample_id,
        resolved_sample_column = resolved,
        available_samples = available_cols,
        warning = warning
    )
}
build_sample_rank_stats <- function(corrected, resolved_sample) {
    cohort_cols <- setdiff(colnames(corrected), resolved_sample)
    if (length(cohort_cols) < 5) {
        stop("Need at least 5 cohort samples besides the target sample for GSEA.")
    }

    corrected_mat <- as.matrix(corrected)
    storage.mode(corrected_mat) <- "double"
    target_expr <- corrected_mat[, resolved_sample]
    cohort_mat <- corrected_mat[, cohort_cols, drop = FALSE]
    cohort_median <- apply(cohort_mat, 1, median, na.rm = TRUE)
    cohort_mad <- apply(cohort_mat, 1, mad, na.rm = TRUE)

    robust_z <- rep(NA_real_, length(target_expr))
    valid_mad <- is.finite(cohort_mad) & cohort_mad > 1e-6
    robust_z[valid_mad] <- (target_expr[valid_mad] - cohort_median[valid_mad]) / cohort_mad[valid_mad]

    ranks_df <- data.frame(
        gene = rownames(corrected_mat),
        score = as.numeric(robust_z),
        stringsAsFactors = FALSE
    )
    ranks_df <- ranks_df[is.finite(ranks_df$score) & nzchar(ranks_df$gene), , drop = FALSE]
    if (nrow(ranks_df) == 0) {
        stop("No finite gene scores available for ranking.")
    }

    # Keep one score per gene symbol (max absolute score).
    ranks_df$abs_score <- abs(ranks_df$score)
    ranks_df <- ranks_df[order(-ranks_df$abs_score), , drop = FALSE]
    ranks_df <- ranks_df[!duplicated(ranks_df$gene), c("gene", "score"), drop = FALSE]

    stats <- setNames(ranks_df$score, ranks_df$gene)
    stats <- sort(stats, decreasing = TRUE)

    list(
        stats = stats,
        cohort_size = length(cohort_cols),
        genes_ranked = length(stats)
    )
}
build_msig_pathways <- function(collection = "hallmark") {
    if (!requireNamespace("msigdbr", quietly = TRUE)) {
        stop("Package 'msigdbr' is not installed.")
    }

    coll <- tolower(as.character(collection)[1])
    if (coll %in% c("h", "hallmark", "msig_hallmark")) {
        db <- msigdbr::msigdbr(species = "Homo sapiens", category = "H")
    } else if (coll %in% c("reactome", "c2_reactome", "cp:reactome")) {
        db <- msigdbr::msigdbr(species = "Homo sapiens", category = "C2", subcategory = "CP:REACTOME")
    } else if (coll %in% c("go_bp", "c5_go_bp", "gobp")) {
        db <- msigdbr::msigdbr(species = "Homo sapiens", category = "C5", subcategory = "GO:BP")
    } else {
        stop("Unsupported collection. Use one of: hallmark, reactome, go_bp.")
    }

    pathways <- split(as.character(db$gene_symbol), as.character(db$gs_name))
    pathways <- lapply(pathways, unique)
    pathways
}
