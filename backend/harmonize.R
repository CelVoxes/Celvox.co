# harmonize.R — RNA-seq harmonization service layer
#
# The rna_bulk harmonize-stage handler (reference alignment + ComBat/limma batch
# correction), invoked behind dispatch_modality_stage("rna_bulk","harmonize").
# Sourced with local = TRUE (shares plumber.R's env). Extracted verbatim from the
# /harmonize-data endpoint body — behavior-identical.

harmonize_rna_bulk <-    function(req) {
        started_at <- Sys.time()
        disease_selection <- get_request_disease_selection(req)
        disease_id <- disease_selection_key(disease_selection)
        selected_samples <- normalize_selected_samples_arg(req$args$samples)
        cache_dir <- req$args$cachedir

        if (is.null(selected_samples) || length(selected_samples) == 0) {
            return(list(error = "No samples selected for harmonization"))
        }

        message("Harmonization disease selection:", paste(disease_selection, collapse = ", "))
        message("Harmonization disease key:", disease_id)
        message("Selected samples:", paste(selected_samples, collapse = ", "))

        library(sva)

        uncorrected <- load_reference_uncorrected_counts(disease = disease_selection)
        sample_data <- read_fst(file.path(cache_dir, "sample_data.fst"))
        metadata <- load_metadata(disease = disease_selection, aligned = TRUE)
        reference_gene_count_before_merge <- nrow(uncorrected)
        reference_sample_count <- ncol(uncorrected) - 1


        # drop the samples that are not in the selected_samples and gene names which is the first column
        # BE CAREFUL with match function; it will only match the first occurrence of each element
        selected_idx <- match(selected_samples, colnames(sample_data))
        selected_idx <- selected_idx[!is.na(selected_idx)]
        if (length(selected_idx) == 0) {
            return(list(error = "Selected samples were not found in uploaded sample data"))
        }
        sample_data <- sample_data[, c(1, selected_idx), drop = FALSE]
        selected_samples_found <- colnames(sample_data)[-1]


        message(length(selected_idx))
        # Function to check if IDs are Ensembl-like
        is_ensembl <- function(ids) {
            ensembl_count <- sum(grepl("^ENSG", ids))
            ensembl_percentage <- ensembl_count / length(ids) * 100
            return(ensembl_percentage > 95)
        }

        # Check for gene IDs in both rownames and first column
        check_gene_ids <- function(data) {
            # Check if rownames are not just numbers
            rowname_is_gene <- !all(grepl("^\\d+$", rownames(data)))

            # Check if the first column contains potential gene IDs
            first_col_is_gene <- is.character(data[[1]]) && !all(grepl("^\\d+$", data[[1]]))

            if (rowname_is_gene && first_col_is_gene) {
                message("Gene IDs found in both rownames and first column.")
                return(list(gene_ids = rownames(data), id_in_column = TRUE))
            } else if (rowname_is_gene) {
                message("Gene IDs are in rownames")
                return(list(gene_ids = rownames(data), id_in_column = FALSE))
            } else if (first_col_is_gene) {
                message("Gene IDs are in the first column")
                return(list(gene_ids = data[[1]], id_in_column = TRUE))
            } else {
                message("No gene IDs found in rownames or first column")
                return(NULL)
            }
        }

        # Function to strip version numbers from Ensembl IDs
        strip_ensembl_version <- function(ids) {
            gsub("\\.[0-9]+$", "", ids)
        }

        # Convert Ensembl IDs to gene symbols using seAMLess::grch38
        convert_to_symbols <- function(data) {
            # Check if gene IDs are in the first column or rownames
            id_info <- check_gene_ids(data)

            if (!is.null(id_info)) {
                gene_ids <- id_info$gene_ids
                id_in_column <- id_info$id_in_column
            } else {
                message("Unable to determine gene ID location. Please check your data format.")
                return(NULL)
            }

            # Calculate variance for each gene
            gene_vars <- tryCatch(
                {
                    if (id_in_column) {
                        message("Calculating variance for data with gene IDs in the first column")
                        numeric_data <- as.matrix(data[, -1, drop = FALSE])
                        if (!is.numeric(numeric_data)) {
                            message("Warning: Non-numeric data detected. Attempting to convert to numeric.")
                            numeric_data <- apply(numeric_data, 2, as.numeric)
                        }
                        apply(numeric_data, 1, var, na.rm = TRUE)
                    } else {
                        message("Calculating variance for data with gene IDs as rownames")
                        numeric_data <- as.matrix(data)
                        if (!is.numeric(numeric_data)) {
                            message("Warning: Non-numeric data detected. Attempting to convert to numeric.")
                            numeric_data <- apply(numeric_data, 2, as.numeric)
                        }
                        apply(numeric_data, 1, var, na.rm = TRUE)
                    }
                },
                error = function(e) {
                    message("Error in variance calculation: ", e$message)
                    message("First few rows of data:")
                    print(head(data))
                    message("Data structure:")
                    str(data)
                    return(rep(NA, nrow(data)))
                }
            )

            # Convert Ensembl IDs to gene symbols if applicable
            new_gene_ids <- gene_ids
            if (is_ensembl(gene_ids)) {
                message("Converting Ensembl IDs to gene symbols...")
                stripped_gene_ids <- strip_ensembl_version(gene_ids)
                new_gene_ids <- seAMLess::grch38$symbol[match(stripped_gene_ids, seAMLess::grch38$ensgene)]
                # Replace NA values with original IDs
                new_gene_ids[is.na(new_gene_ids)] <- gene_ids[is.na(new_gene_ids)]
            }

            # Create a data frame with IDs and variances
            id_var_df <- data.frame(
                new_gene_ids = new_gene_ids,
                gene_ids = gene_ids,
                variance = gene_vars
            )

            # Sort by variance (descending) and keep only the first occurrence of each gene symbol
            id_var_df <- id_var_df[order(id_var_df$variance, decreasing = TRUE), ]
            id_var_df <- id_var_df[!duplicated(id_var_df$new_gene_ids), ]

            # Update the data with sorted and deduplicated gene symbols
            if (id_in_column) {
                data <- data[match(id_var_df$gene_ids, gene_ids), ]
                data <- data[, -1, drop = FALSE]
            } else {
                data <- data[match(id_var_df$gene_ids, gene_ids), ]
            }
            rownames(data) <- id_var_df$new_gene_ids

            return(data)
        }

        # Apply conversion to uncorrected and sample_data
        uncorrected <- convert_to_symbols(uncorrected)
        sample_data <- convert_to_symbols(sample_data)
        uploaded_gene_count_before_filter <- nrow(sample_data)
        uploaded_sample_count <- ncol(sample_data)

        message("Dimensions of uncorrected data:")
        print(dim(uncorrected))
        message("Dimensions of sample data:")
        print(dim(sample_data))

        # remove low expressed genes
        message("Removing genes with less than total 100 mRNA for all samples...")
        sample_data <- remove_low_expressed_genes(sample_data, threshold = 100)
        uploaded_gene_count_after_filter <- nrow(sample_data)

        message("Dimensions of sample data after filtering:")
        print(dim(sample_data))
        print(colnames(sample_data))

        message("Getting common genes...")
        common_genes <- intersect(rownames(uncorrected), rownames(sample_data))
        message(paste0("Number of common genes: ", length(common_genes)))

        if (length(common_genes) < 10) {
            warning("Less than 10 common genes! Please check the data format.")
            return(NULL)
        }

        if (length(common_genes) < 1000) {
            warning("Less than 1000 common genes! Maybe the data is not in the correct format?")
            return(NULL)
        }


        message("Combining uncorrected and sample data...")
        # Add "_sample_data" suffix to sample_data column names
        colnames(sample_data) <- paste0(colnames(sample_data), "_sample_data")
        # Combine the data, keeping genes as rownames and samples as columns
        metadata <- align_reference_metadata_to_counts(metadata, colnames(uncorrected), disease = disease_selection)
        uncorrected <- cbind(uncorrected[common_genes, ], sample_data[common_genes, ])

        message("Creating batch vector...")
        batch <- c(paste0(metadata$study, "_", metadata$sex), rep("sample_data", (ncol(sample_data))))
        message(paste("Batch dimension:", length(batch)))

        correction.option <- "limma"
        if (correction.option == "combat") {
            message("Correcting data with ComBat...")
            corrected_matrix <- ComBat_seq(as.matrix(uncorrected), batch = batch, full_mod = F)
            # normalize library sizes
            corrected_matrix <- log2(edgeR::cpm(corrected_matrix) + 1)
        } else if (correction.option == "limma") {
            message("Correcting data with limma...")
            # normalize library sizes
            uncorrected <- log2(edgeR::cpm(uncorrected) + 1)
            corrected_matrix <- limma::removeBatchEffect(uncorrected, batch = batch, )
            gc()
        }


        message("Converting corrected_matrix to data.frame...")
        corrected_matrix <- as.data.frame(corrected_matrix)

        # add rownames to the first column
        corrected_matrix <- cbind(rownames(corrected_matrix), corrected_matrix)
        colnames(corrected_matrix)[1] <- "gene_id"

        message("Returning normalized and corrected data...")
        start_time <- Sys.time()
        write_fst(corrected_matrix, file.path(cache_dir, "harmonized_data.fst"))
        write_fst(corrected_matrix[, "gene_id", drop = FALSE], file.path(cache_dir, "gene_ids.fst"))

        # remove cached t-SNE results
        if (file.exists(file.path(cache_dir, "tsne_result.fst"))) {
            file.remove(file.path(cache_dir, "tsne_result.fst"))
        }
        end_time <- Sys.time()
        message("Time taken to write fst: ", difftime(end_time, start_time, units = "secs"))


        message("Dimensions of harmonized data:")
        print(dim(corrected_matrix))

        # Persist a harmonization manifest for auditability and user QC review.
        if (!dir.exists(cache_dir)) {
            dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)
        }
        common_gene_count <- length(common_genes)
        overlap_fraction_uploaded <- if (isTRUE(uploaded_gene_count_after_filter > 0)) common_gene_count / uploaded_gene_count_after_filter else NA_real_
        overlap_fraction_reference <- if (isTRUE(nrow(uncorrected) > 0)) common_gene_count / nrow(uncorrected) else NA_real_

        count_table_to_list <- function(x) {
            if (length(x) == 0) return(list())
            y <- as.list(as.integer(x))
            names(y) <- names(x)
            y
        }

        batch_counts <- table(batch)
        disease_counts <- if ("disease" %in% colnames(metadata)) table(metadata$disease) else integer(0)
        reference_match_source_counts <- if ("reference_match_source" %in% colnames(metadata)) {
            table(ifelse(is.na(metadata$reference_match_source), "unknown", metadata$reference_match_source))
        } else {
            integer(0)
        }

        missing_summary <- list(
            study = if ("meta_missing_core_study" %in% colnames(metadata)) sum(metadata$meta_missing_core_study, na.rm = TRUE) else NA_integer_,
            sex = if ("meta_missing_core_sex" %in% colnames(metadata)) sum(metadata$meta_missing_core_sex, na.rm = TRUE) else NA_integer_,
            subtype = if ("meta_missing_core_subtype" %in% colnames(metadata)) sum(metadata$meta_missing_core_subtype, na.rm = TRUE) else NA_integer_
        )

        warnings <- character(0)
        if (!is.na(overlap_fraction_uploaded) && overlap_fraction_uploaded < 0.5) {
            warnings <- c(warnings, sprintf("Low uploaded gene overlap after filtering (%.1f%%). Check gene ID type and reference choice.", 100 * overlap_fraction_uploaded))
        }
        if (!is.na(missing_summary$sex) && nrow(metadata) > 0 && (missing_summary$sex / nrow(metadata)) > 0.25) {
            warnings <- c(warnings, sprintf("Reference metadata has %.1f%% missing sex values.", 100 * missing_summary$sex / nrow(metadata)))
        }

        manifest <- list(
            version = "v1",
            timestamp_utc = format(Sys.time(), tz = "UTC", usetz = TRUE),
            duration_seconds = as.numeric(difftime(Sys.time(), started_at, units = "secs")),
            cache_dir = cache_dir,
            disease_selection = disease_selection,
            disease_selection_key = disease_id,
            selected_samples_requested = selected_samples,
            selected_samples_found = selected_samples_found,
            selected_uploaded_sample_count = length(selected_samples_found),
            reference = list(
                sample_count = reference_sample_count,
                gene_count_before_symbol_merge = reference_gene_count_before_merge,
                disease_counts = count_table_to_list(disease_counts)
            ),
            uploaded = list(
                sample_count = uploaded_sample_count,
                gene_count_before_filter = uploaded_gene_count_before_filter,
                gene_count_after_filter = uploaded_gene_count_after_filter
            ),
            overlap = list(
                common_gene_count = common_gene_count,
                uploaded_overlap_fraction = overlap_fraction_uploaded,
                reference_overlap_fraction = overlap_fraction_reference
            ),
            metadata_alignment = list(
                registry_version = if ("meta_registry_version" %in% colnames(metadata)) unique(na.omit(metadata$meta_registry_version)) else character(0),
                alignment_version = if ("meta_alignment_version" %in% colnames(metadata)) unique(na.omit(metadata$meta_alignment_version)) else character(0),
                missing_core_counts = missing_summary,
                reference_match_source_counts = count_table_to_list(reference_match_source_counts)
            ),
            batches = list(
                total = length(batch),
                unique = length(unique(batch)),
                counts = count_table_to_list(batch_counts)
            ),
            output = list(
                harmonized_gene_count = nrow(corrected_matrix),
                harmonized_column_count = ncol(corrected_matrix) - 1
            ),
            warnings = as.list(warnings)
        )

        jsonlite::write_json(
            manifest,
            path = file.path(cache_dir, "harmonization_manifest.json"),
            auto_unbox = TRUE,
            pretty = TRUE,
            null = "null"
        )

        # Cleanup
        message("Cleaning up memory...")
        rm(list = c(
            "corrected_matrix",
            "uncorrected",
            "sample_data",
            "metadata",
            "common_genes",
            "batch"
        ), envir = environment())

        # Force garbage collection multiple times
        gc()
        gc()

        message("Done!")
        return(list(
            message = "Normalized and corrected data saved to cache",
            manifest = manifest
        ))
    }
