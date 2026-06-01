# reference.R — reference expression service layer
#
# Loads + aligns the per-cohort uncorrected reference counts and parses the
# selected-samples arg. Sourced with local = TRUE (shares plumber.R's env).

normalize_reference_gene_ids_for_merge <- function(df) {
    if (is.null(df) || ncol(df) < 1) return(df)
    gene_col <- colnames(df)[1]
    df[[gene_col]] <- as.character(df[[gene_col]])
    df[[gene_col]] <- gsub("\\.[0-9]+$", "", df[[gene_col]])
    if (gene_col != "gene_id") {
        colnames(df)[1] <- "gene_id"
    }
    return(df)
}

load_reference_uncorrected_counts <- function(disease = "aml") {
    diseases <- normalize_disease_selection(disease)
    selection_key <- disease_selection_key(diseases)
    disease_id <- if (length(diseases) == 1) diseases[[1]] else selection_key

    if (length(diseases) > 1) {
        ref_cache_dir <- file.path("cache", ".reference")
        if (!dir.exists(ref_cache_dir)) {
            dir.create(ref_cache_dir, recursive = TRUE)
        }
        cache_fst <- file.path(ref_cache_dir, sprintf("%s_reference_uncorrected.fst", selection_key))

        if (file.exists(cache_fst)) {
            message(sprintf("Loading cached %s reference counts from %s", disease_id, cache_fst))
            return(read_fst(cache_fst))
        }

        message(sprintf("Building %s harmonization reference from: %s", selection_key, paste(diseases, collapse = ", ")))
        count_list <- lapply(
            diseases,
            function(d) normalize_reference_gene_ids_for_merge(load_reference_uncorrected_counts(d))
        )

        merged_counts <- Reduce(
            function(x, y) merge(x, y, by = "gene_id", all = FALSE),
            count_list
        )

        write_fst(merged_counts, cache_fst)
        message(sprintf("Cached %s reference counts at %s", disease_id, cache_fst))
        return(merged_counts)
    }

    if (identical(disease_id, "aml")) {
        return(fread(
            require_existing_path(
                resolve_disease_asset("aml", "counts", "uncorrected"),
                "AML uncorrected counts"
            ),
            data.table = FALSE
        ))
    }

    if (!(disease_id %in% c("ball", "tall"))) {
        stop(sprintf("Unsupported disease for harmonization reference: %s", disease_id))
    }

    parquet_path <- require_existing_path(
        resolve_disease_asset(disease_id, "training", "rna_parquet"),
        sprintf("%s training RNA parquet", disease_id)
    )

    ref_cache_dir <- file.path("cache", ".reference")
    if (!dir.exists(ref_cache_dir)) {
        dir.create(ref_cache_dir, recursive = TRUE)
    }
    cache_fst <- file.path(ref_cache_dir, sprintf("%s_reference_uncorrected.fst", disease_id))

    if (file.exists(cache_fst)) {
        message(sprintf("Loading cached %s reference counts from %s", disease_id, cache_fst))
        return(read_fst(cache_fst))
    }

    message(sprintf("Converting %s parquet reference to CSV/FST cache...", disease_id))
    parquet_python <- Sys.getenv("PARQUET_PYTHON")
    if (!nzchar(parquet_python)) parquet_python <- "python3"

    converter_script <- file.path(getwd(), "parquet_to_counts_csv.py")
    if (!file.exists(converter_script)) {
        stop(sprintf("Parquet converter script not found: %s", converter_script))
    }

    tmp_csv <- tempfile(fileext = ".csv")
    on.exit(unlink(tmp_csv), add = TRUE)

    converter_output <- tryCatch(
        {
            system2(
                parquet_python,
                c(converter_script, "--input-parquet", parquet_path, "--output-csv", tmp_csv),
                stdout = TRUE,
                stderr = TRUE
            )
        },
        error = function(e) {
            structure(character(), status = 1L, error_message = e$message)
        }
    )
    converter_status <- attr(converter_output, "status")
    if (!is.null(converter_status) && converter_status != 0) {
        stop(
            sprintf(
                "Failed to convert %s parquet reference (%s): %s",
                disease_id,
                parquet_python,
                paste(converter_output, collapse = "\n")
            )
        )
    }

    counts_df <- fread(tmp_csv, data.table = FALSE)
    write_fst(counts_df, cache_fst)
    message(sprintf("Cached %s reference counts at %s", disease_id, cache_fst))
    return(counts_df)
}

align_reference_metadata_to_counts <- function(metadata, count_colnames, disease = "aml") {
    disease_key <- disease_selection_key(disease)
    default_study <- sprintf("%s_reference", toupper(disease_key))
    if (is.null(metadata) || nrow(metadata) == 0) {
        metadata <- data.frame(sample_id = character(0), stringsAsFactors = FALSE)
    }

    metadata <- as.data.frame(metadata, stringsAsFactors = FALSE)
    if (!"sample_id" %in% colnames(metadata)) {
        metadata$sample_id <- character(nrow(metadata))
    }
    if (!"study" %in% colnames(metadata)) {
        metadata$study <- NA_character_
    }
    if (!"sex" %in% colnames(metadata)) {
        metadata$sex <- NA_character_
    }

    match_info <- match_metadata_to_reference_columns(metadata, count_colnames, disease = disease)
    match_idx <- match_info$index
    match_source <- match_info$source
    missing_idx <- which(is.na(match_idx))
    if (length(missing_idx) > 0) {
        placeholder <- data.frame(
            sample_id = count_colnames[missing_idx],
            study = default_study,
            sex = "unknown",
            reference_match_source = "placeholder",
            stringsAsFactors = FALSE
        )
        metadata <- rbind(metadata, placeholder)
        match_info <- match_metadata_to_reference_columns(metadata, count_colnames, disease = disease)
        match_idx <- match_info$index
        match_source <- match_info$source
    }

    aligned <- metadata[match_idx, , drop = FALSE]
    aligned$sample_id <- count_colnames
    aligned$study[is.na(aligned$study) | trimws(aligned$study) == ""] <- default_study
    aligned$sex[is.na(aligned$sex) | trimws(aligned$sex) == ""] <- "unknown"
    if (!"reference_match_source" %in% colnames(aligned)) {
        aligned$reference_match_source <- match_source
    } else {
        aligned$reference_match_source[is.na(aligned$reference_match_source)] <- match_source[is.na(aligned$reference_match_source)]
    }
    return(aligned)
}

normalize_selected_samples_arg <- function(x) {
    vals <- normalize_arg_vector(x)
    if (is.null(vals)) return(NULL)
    if (length(vals) == 1 && grepl(",", vals[1], fixed = TRUE)) {
        vals <- strsplit(vals[1], ",", fixed = TRUE)[[1]]
    }
    vals <- trimws(vals)
    vals <- vals[nzchar(vals)]
    if (length(vals) == 0) return(NULL)
    vals
}
