library(fst)
library(data.table)
source("data_registry.R")
source("tools_registry.R")
source("metadata_alignment_registry.R")
source("modalities.R")
source("capabilities.R")
source("cohorts.R")
source("resolve.R")
source("context.R")
source("catalog.R")
# Service layers are sourced with local = TRUE so they share this file's
# environment (plumber's): they may call helpers defined in plumber.R and be
# called by the endpoints, without the globalenv/PlumberEnv scope split that a
# default source() would introduce.
source("ingest.R", local = TRUE)
source("predict.R", local = TRUE)
source("analysis.R", local = TRUE)
source("metadata.R", local = TRUE)
source("reference.R", local = TRUE)
source("report.R", local = TRUE)





#* @get /load-sample-data
#* @serializer json
load_sample_data <- local({
    function(req) {
        tryCatch(
            {
                message("Loading sample data...")

                # Inspect the req object
                message("Inspecting req object:")
                message("Names in req environment:")
                print(names(req))


                message("within file:")
                print(str(req$args$file))
                temp_files <- normalize_arg_vector(req$args$file)
                if (is.null(temp_files)) {
                    temp_files <- normalize_arg_vector(req$args[["file[]"]])
                }

                file_names <- normalize_arg_vector(req$args$filename)
                if (is.null(file_names)) {
                    file_names <- normalize_arg_vector(req$args[["filename[]"]])
                }

                cache_dir <- req$args$cachedir

                if (is.null(temp_files) || length(temp_files) == 0) {
                    message("No files received.")
                    return(list(error = "Failed to receive file(s)"))
                }

                message(paste("Temporary files created:", paste(temp_files, collapse = ", ")))

                # Check if the file exists and has content
                if (any(!file.exists(temp_files))) {
                    message("One or more temporary files do not exist.")
                    return(list(error = "Failed to receive file(s)"))
                }

                file_sizes <- file.size(temp_files)
                if (any(file_sizes == 0)) {
                    message("One or more temporary files do not exist or are empty.")
                    return(list(error = "Failed to receive file(s) or file(s) are empty"))
                }

                sample_data <- NULL
                base_names <- if (!is.null(file_names) && length(file_names) == length(temp_files)) {
                    file_names
                } else {
                    basename(temp_files)
                }

                is_readspergene <- all(is_readspergene_filename(base_names))
                is_csv <- all(grepl("\\.csv$", base_names, ignore.case = TRUE))

                if (is_readspergene) {
                    sample_data <- tryCatch(
                        {
                            read_readspergene_files(temp_files, base_names)
                        },
                        error = function(e) {
                            message("Error reading ReadsPerGene.out.tab files: ", e$message)
                            return(list(error = paste("Error reading ReadsPerGene.out.tab files:", e$message)))
                        }
                    )
                } else if (length(temp_files) == 1 && is_csv) {
                    sample_data <- tryCatch(
                        {
                            fread(temp_files[1], data.table = FALSE)
                        },
                        error = function(e) {
                            message("Error reading CSV: ", e$message)
                            return(list(error = paste("Error reading the file:", e$message)))
                        }
                    )
                } else {
                    return(list(error = "Please upload a single CSV or one or more ReadsPerGene.out.tab files (copied names like ReadsPerGene.out(1).tab are accepted)."))
                }

                if (is.list(sample_data) && !is.data.frame(sample_data)) {
                    return(sample_data)
                }

                print(head(sample_data))

                # Save the sample data to cache
                message("Saving sample data to cache...")
                if (!dir.exists(cache_dir)) {
                    dir.create(cache_dir, recursive = TRUE)
                    message(paste("Created '", cache_dir, "' directory."))
                }
                write_fst(sample_data, file.path(cache_dir, "sample_data.fst"))

                # Return success response
                message("File uploaded and processed successfully.")
                return(list(
                    message = "File uploaded and cached successfully",
                    rows = nrow(sample_data),
                    cols = ncol(sample_data)
                ))
            },
            error = function(e) {
                message("Error occurred: ", e$message)
                return(list(error = paste("An error occurred while processing the file:", e$message)))
            }
        )
    }
})

get_corrected_data <- local({
    function(cache_dir) {
        corrected <- read_fst(file.path(cache_dir, "harmonized_data.fst"))
        rownames(corrected) <- corrected[, 1]
        corrected <- corrected[, -1, drop = FALSE]

        return(corrected)
    }
})



#* @get /harmonize-data
#* @serializer json
harmonize_data <- local({
    function(req) {
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
})

#* @get /harmonization-manifest
#* @serializer json
function(req) {
    cache_dir <- req$args$cachedir
    manifest_path <- file.path(cache_dir, "harmonization_manifest.json")
    if (!file.exists(manifest_path)) {
        return(list(error = "No harmonization manifest found. Run harmonization first."))
    }

    tryCatch(
        {
            return(jsonlite::fromJSON(manifest_path, simplifyVector = FALSE))
        },
        error = function(e) {
            return(list(error = paste("Failed to read harmonization manifest:", e$message)))
        }
    )
}


#* @get /tsne
#* @serializer json
tsne <- local({
    function(req) {
        cache_dir <- req$args$cachedir
        disease_selection <- get_request_disease_selection(req)
        disease_id <- disease_selection_key(disease_selection)
        tsne_result <- run_tsne(cache_dir)
        metadata <- load_metadata(disease = disease_selection, aligned = TRUE)

        # Identify which rows in tsne_result correspond to the original data
        original_samples <- intersect(rownames(tsne_result), metadata$sample_id)

        # Create a new data frame for the result
        result <- data.frame(
            sample_id = rownames(tsne_result),
            X1 = tsne_result$X1,
            X2 = tsne_result$X2,
            data_source = ifelse(rownames(tsne_result) %in% original_samples, "original", "uploaded"),
            disease = disease_id
        )

        # Avoid merge suffixes on core plotting columns.
        metadata_merge <- metadata
        conflicting_cols <- intersect(colnames(metadata_merge), colnames(result))
        conflicting_cols <- setdiff(conflicting_cols, "sample_id")
        if (length(conflicting_cols) > 0) {
            metadata_merge <- metadata_merge[, !colnames(metadata_merge) %in% conflicting_cols, drop = FALSE]
        }

        # Merge metadata only for the original samples
        result <- merge(result, metadata_merge, by = "sample_id", all.x = TRUE)

        # returning the result (as long as it is not too big)
        return(result)
    }
})


#* @get /knn
#* @serializer json
function(req) {
    cache_dir <- req$args$cachedir
    # Check if FNN package is available, if not, try to install it
    if (!requireNamespace("FNN", quietly = TRUE)) {
        message("FNN package not found. Attempting to install...")
        tryCatch(
            {
                install.packages("FNN", repos = "https://cloud.r-project.org")
                library(FNN)
                message("FNN package installed successfully.")
            },
            error = function(e) {
                message("Failed to install FNN package: ", e$message)
                return(list(error = "Failed to install FNN package. Please install it manually."))
            }
        )
    } else {
        library(FNN)
    }

    corrected <- get_corrected_data(cache_dir)
    # selected most variable 2000 genes
    vars <- apply(corrected, 1, var)
    corrected_2000 <- corrected[names(vars[order(vars, decreasing = T)[1:2000]]), ]

    # Get the k value from the query parameter, default to 20 if not provided
    k <- if (!is.null(req$args$k)) as.integer(req$args$k) else 20
    message(paste("K value:", k))

    # Use the k value in the get.knn function
    knn_result <- FNN::get.knn(t(corrected_2000), k = k)

    knn_indices <- knn_result$nn.index
    knn_distances <- knn_result$nn.dist

    knn_df <- data.frame(
        sample_id = colnames(corrected_2000),
        knn_indices = I(lapply(1:nrow(knn_indices), function(i) knn_indices[i, ])),
        knn_distances = I(lapply(1:nrow(knn_distances), function(i) knn_distances[i, ]))
    )

    return(knn_df)
}

#* @get /deconvolution
#* @serializer json
function(req) {
    cache_dir <- req$args$cachedir
    selected_samples <- normalize_selected_samples_arg(req$args$samples)
    include_reference <- isTRUE(tolower(as.character(req$args$include_reference %||% "false")) %in% c("true", "1", "yes"))
    disease_selection <- get_request_disease_selection(req)
    disease_id <- disease_selection_key(disease_selection)
    # Load the exampleTCGA dataset
    library(seAMLess)
    library(Biobase) # for ExpressionSet
    if (!file.exists(file.path(cache_dir, "sample_data.fst"))) {
        message("Sample data not found. Returning example data.")
        # Load example data from seAMLess package
        data(exampleTCGA)
        result <- seAMLess(exampleTCGA)
        return(list(
            message = "Example data used. Please upload your own data for actual analysis.",
            deconvolution = as.list(result$Deconvolution)
        ))
    }
    sample_data <- read_fst(file.path(cache_dir, "sample_data.fst"))
    available_samples <- colnames(sample_data)[-1]
    if (!is.null(selected_samples) && length(selected_samples) > 0) {
        selected_idx <- match(selected_samples, available_samples)
        missing_samples <- selected_samples[is.na(selected_idx)]
        if (length(missing_samples) > 0) {
            return(list(
                error = "Selected samples were not found in uploaded sample data",
                missing_samples = missing_samples,
                available_samples = available_samples
            ))
        }
        sample_data <- sample_data[, c(1, selected_idx + 1), drop = FALSE]
    }

    row_sources <- setNames(rep("uploaded", ncol(sample_data) - 1), colnames(sample_data)[-1])

    if (isTRUE(include_reference)) {
        reference_data <- load_reference_uncorrected_counts(disease = disease_selection)
        reference_data <- as.data.frame(reference_data, check.names = FALSE)
        sample_data <- as.data.frame(sample_data, check.names = FALSE)
        ref_gene_col <- colnames(reference_data)[1]
        sample_gene_col <- colnames(sample_data)[1]
        reference_sample_names <- colnames(reference_data)[-1]
        reference_metadata <- tryCatch(
            load_metadata(disease = disease_selection, aligned = TRUE),
            error = function(e) {
                message("Deconvolution: reference metadata unavailable: ", e$message)
                NULL
            }
        )
        reference_metadata_match <- tryCatch(
            {
                if (is.null(reference_metadata)) {
                    list(index = rep(NA_integer_, length(reference_sample_names)))
                } else {
                    match_metadata_to_reference_columns(
                        reference_metadata,
                        reference_sample_names,
                        disease = disease_selection
                    )
                }
            },
            error = function(e) {
                message("Deconvolution: reference metadata matching failed: ", e$message)
                list(index = rep(NA_integer_, length(reference_sample_names)))
            }
        )
        reference_subtype_values <- rep("unknown", length(reference_sample_names))
        reference_disease_values <- rep(disease_id, length(reference_sample_names))
        if (!is.null(reference_metadata) && length(reference_metadata_match$index) == length(reference_sample_names)) {
            matched <- !is.na(reference_metadata_match$index)
            if ("subtype_label" %in% colnames(reference_metadata)) {
                reference_subtype_values[matched] <- as.character(reference_metadata$subtype_label[reference_metadata_match$index[matched]])
            }
            if ("disease" %in% colnames(reference_metadata)) {
                reference_disease_values[matched] <- as.character(reference_metadata$disease[reference_metadata_match$index[matched]])
            }
        }
        reference_subtype_values[is.na(reference_subtype_values) | trimws(reference_subtype_values) == ""] <- "unknown"
        reference_disease_values[is.na(reference_disease_values) | trimws(reference_disease_values) == ""] <- disease_id
        reference_subtypes <- setNames(reference_subtype_values, reference_sample_names)
        reference_diseases <- setNames(reference_disease_values, reference_sample_names)
        reference_data[[ref_gene_col]] <- gsub("\\.[0-9]+$", "", as.character(reference_data[[ref_gene_col]]))
        sample_data[[sample_gene_col]] <- gsub("\\.[0-9]+$", "", as.character(sample_data[[sample_gene_col]]))
        ref_is_ensembl <- sum(grepl("^ENSG", reference_data[[ref_gene_col]])) / nrow(reference_data) > 0.95
        sample_is_ensembl <- sum(grepl("^ENSG", sample_data[[sample_gene_col]])) / nrow(sample_data) > 0.95
        if (sample_is_ensembl && !ref_is_ensembl) {
            message("Deconvolution: converting sample Ensembl IDs to gene symbols for reference merge...")
            new_ids <- seAMLess::grch38$symbol[match(sample_data[[sample_gene_col]], seAMLess::grch38$ensgene)]
            new_ids[is.na(new_ids)] <- sample_data[[sample_gene_col]][is.na(new_ids)]
            sample_data[[sample_gene_col]] <- new_ids
        } else if (ref_is_ensembl && !sample_is_ensembl) {
            message("Deconvolution: converting reference Ensembl IDs to gene symbols for sample merge...")
            new_ids <- seAMLess::grch38$symbol[match(reference_data[[ref_gene_col]], seAMLess::grch38$ensgene)]
            new_ids[is.na(new_ids)] <- reference_data[[ref_gene_col]][is.na(new_ids)]
            reference_data[[ref_gene_col]] <- new_ids
        }
        common_genes <- intersect(reference_data[[ref_gene_col]], sample_data[[sample_gene_col]])
        if (length(common_genes) == 0) {
            return(list(error = "No shared genes found between uploaded samples and reference counts."))
        }
        reference_data <- reference_data[match(common_genes, reference_data[[ref_gene_col]]), , drop = FALSE]
        sample_data <- sample_data[match(common_genes, sample_data[[sample_gene_col]]), , drop = FALSE]
        colnames(reference_data)[1] <- "gene_id"
        colnames(sample_data)[1] <- "gene_id"
        row_sources <- c(
            setNames(rep("reference", ncol(reference_data) - 1), colnames(reference_data)[-1]),
            row_sources
        )
        sample_data <- cbind(reference_data, sample_data[, -1, drop = FALSE])
    }

    # remove gene names with __no_feature or __ambiguous
    sample_data <- sample_data[!grepl("__no_feature|__ambiguous", sample_data[, 1]), ]

    # remove the row if it is incomplete
    sample_data <- sample_data[complete.cases(sample_data), ]
    result <- seAMLess(sample_data)
    deconv <- data.frame(result$Deconvolution, check.names = FALSE)
    if (!"_row" %in% colnames(deconv)) {
        deconv[["_row"]] <- rownames(deconv)
    }
    deconv[["_source"]] <- unname(row_sources[as.character(deconv[["_row"]])])
    deconv[["_source"]][is.na(deconv[["_source"]])] <- "unknown"
    deconv[["_subtype"]] <- if (exists("reference_subtypes")) {
        unname(reference_subtypes[as.character(deconv[["_row"]])])
    } else {
        NA_character_
    }
    deconv[["_subtype"]][is.na(deconv[["_subtype"]]) & deconv[["_source"]] == "reference"] <- "unknown"
    deconv[["_disease"]] <- if (exists("reference_diseases")) {
        unname(reference_diseases[as.character(deconv[["_row"]])])
    } else {
        NA_character_
    }
    deconv[["_disease"]][is.na(deconv[["_disease"]]) & deconv[["_source"]] == "reference"] <- disease_id
    return(list(
        message = paste("Deconvolution complete. Samples:", nrow(deconv)),
        deconvolution = deconv,
        selected_samples = selected_samples %||% available_samples,
        include_reference = include_reference,
        disease = disease_id
    ))
}



#* @get /drug-response
#* @serializer json
drug_response_tsne <- function(req) {
    cache_dir <- req$args$cachedir
    # Load drug response data
    drug_response <- fread(
        require_existing_path(
            resolve_disease_asset("aml", "drug_response", "ex_vivo"),
            "AML drug response table"
        )
    )

    # Load drug families data
    drug_families <- fread(
        require_existing_path(
            resolve_disease_asset("aml", "drug_response", "families"),
            "AML drug family table"
        )
    )

    # Merge drug response with drug families
    drug_response <- merge(drug_response, drug_families, by.x = "inhibitor", by.y = "drug", all.x = TRUE)

    # Perform t-SNE on the drug response data
    tsne_result <- tsne(req)

    # Merge t-SNE results with drug response data
    result <- merge(drug_response, tsne_result[, !colnames(tsne_result) %in% "clusters"], by = "sample_id", all.y = TRUE)


    # Convert to list for JSON serialization
    return(as.list(result))
}


# mutation tsne
#* @get /mutation-tsne
#* @serializer json
mutation_tsne <- function(req) {
    cache_dir <- req$args$cachedir
    # Load mutation data
    mutation_data <- fread(
        require_existing_path(
            resolve_disease_asset("aml", "aberrations", "mutations"),
            "AML mutation aberrations table"
        )
    )

    # Load t-SNE results
    tsne_result <- run_tsne(cache_dir)
    tsne_result$sample_id <- rownames(tsne_result)
    message("Merging mutation data with t-SNE results...")

    # Merge t-SNE results with mutation data
    result <- merge(mutation_data, tsne_result, by = "sample_id", all.x = TRUE)

    return(result)
}

# aberrations tsne
#* @get /aberrations-tsne
#* @serializer json
aberrations_tsne <- function(req) {
    cache_dir <- req$args$cachedir
    # Load aberrations data
    aberrations_data <- fread(
        require_existing_path(
            resolve_disease_asset("aml", "aberrations", "one_hot"),
            "AML aberrations one-hot table"
        )
    )

    # Find the column name that contains ZZEF1 and get the columns after it
    ZZEF1_col <- grep("ZZEF1", colnames(aberrations_data))
    if (length(ZZEF1_col) == 0) {
        stop("ZZEF1 column not found in aberrations data")
    }

    # Subset to include first column and columns from ZZEF1 onwards
    selected_cols <- c(1, ZZEF1_col:ncol(aberrations_data))
    aberrations_data <- aberrations_data[, ..selected_cols]

    # Rename the first column to sample_id
    if (ncol(aberrations_data) >= 1) {
        colnames(aberrations_data)[1] <- "sample_id"
    } else {
        stop("No columns remaining after subsetting")
    }

    # Load t-SNE results
    tsne_result <- run_tsne(cache_dir)
    tsne_result$sample_id <- rownames(tsne_result)
    message("Merging aberrations data with t-SNE results...")

    # Merge t-SNE results with aberrations data
    result <- merge(aberrations_data, tsne_result, by = "sample_id", all.x = TRUE)

    return(result)
}

#* @get /cache-files
#* @serializer unboxedJSON
function(req) {
    cache_dir <- req$args$cachedir
    if (!dir.exists(cache_dir)) {
        return(list(error = "Cache directory does not exist"))
    }

    files <- list.files(cache_dir, full.names = TRUE)
    file_info <- lapply(files, function(file) {
        list(
            name = basename(file),
            size = file.size(file),
            modified = file.info(file)$mtime,
            isUserUploaded = (basename(file) == "sample_data.fst")
        )
    })

    return(file_info)
}

#* @delete /delete-cache-file
#* @serializer json
delete_cache_file <- function(req) {
    file_name <- req$args$fileName
    cache_dir <- req$args$cachedir
    if (!dir.exists(cache_dir)) {
        return(list(error = "Cache directory does not exist"))
    }
    file_path <- file.path(cache_dir, file_name)
    if (file.exists(file_path)) {
        file.remove(file_path)
        return(list(message = "File deleted successfully"))
    } else {
        return(list(error = "File does not exist"))
    }
}



# Add a filter to include CORS headers
#* @filter cors
cors <- function(req, res) {
    res$setHeader("Access-Control-Allow-Origin", "*")
    res$setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    if (req$REQUEST_METHOD == "OPTIONS") {
        res$status <- 200
        return(list())
    } else {
        plumber::forward()
    }
}

#* @get /gene-expression
#* @serializer json
gene_expression <- local({
    function(req) {
        cache_dir <- req$args$cachedir
        gene <- req$args$gene
        tsne_result <- run_tsne(cache_dir)

        message("gene:")
        print(gene)

        message(paste("Fetching gene expression data for:", gene))
        gene_ids <- get_gene_ids(cache_dir)
        if (!gene %in% gene_ids$gene_id) {
            return(list(error = "Gene not found", available_genes = gene_ids$gene_id))
        }
        corrected <- read_fst(file.path(cache_dir, "harmonized_data.fst"))
        rownames(corrected) <- corrected[, 1]
        corrected <- corrected[, -1, drop = FALSE]

        merged <- merge(tsne_result, t(corrected[gene, , drop = FALSE]), by = 0)
        colnames(merged)[1] <- "sample_id"

        # Cleanup
        rm(corrected, tsne_result)
        gc()

        return(list(expression = merged, available_genes = gene_ids$gene_id))
    }
})

#* @get /genome-expression
#* @serializer json
genome_expression <- local({
    function(req) {
        cache_dir <- req$args$cachedir
        samples <- if (!is.null(req$args$samples)) strsplit(req$args$samples, ",")[[1]] else NULL
        bin_size <- if (!is.null(req$args$bin_size)) as.numeric(req$args$bin_size) else 100
        use_uploaded_names <- if (!is.null(req$args$use_uploaded_names) && req$args$use_uploaded_names == "true") TRUE else FALSE

        sample_sex <- NA
        if (!is.null(samples) && length(samples) == 1) {
            tryCatch({
                disease_id <- get_request_disease(req)
                metadata <- load_metadata(disease = disease_id, aligned = TRUE)
                sample_info <- metadata[metadata$sample_id == samples[1], ]
                if (nrow(sample_info) > 0 && "sex" %in% colnames(sample_info)) {
                    sex_val <- sample_info$sex[1]
                    if (length(sex_val) == 1 && !is.na(sex_val) && sex_val != "") {
                        sample_sex <- as.character(sex_val)
                        message(paste("Found sex:", sample_sex, "for sample:", samples[1]))
                    } else {
                        message(paste("Sex is empty or NA for sample:", samples[1]))
                    }
                } else {
                    message(paste("No metadata or sex column for sample:", samples[1]))
                }
            }, error = function(e) {
                message("Could not load or process metadata: ", e$message)
            })
        }

        message("Fetching genome-wide expression data...")
        corrected <- read_fst(file.path(cache_dir, "harmonized_data.fst"))
        gene_ids <- corrected[, 1]
        corrected <- corrected[, -1, drop = FALSE]

        # Handle sample selection FIRST to identify samples to exclude from reference
        selected_sample_data <- NULL
        excluded_samples <- NULL
        if (!is.null(samples)) {
            if (use_uploaded_names) {
                # If using uploaded sample names, map them to harmonized sample names
                sample_data <- read_fst(file.path(cache_dir, "sample_data.fst"))
                uploaded_sample_names <- colnames(sample_data)[-1] # Remove gene_id column

                # Find which uploaded samples were selected
                selected_indices <- match(samples, uploaded_sample_names)
                selected_indices <- selected_indices[!is.na(selected_indices)]

                if (length(selected_indices) == 0) {
                    return(list(error = "No matching uploaded samples found"))
                }

                # Assume uploaded samples are at the end of harmonized data
                # Get the last N samples where N = number of uploaded samples
                n_uploaded <- length(uploaded_sample_names)
                harmonized_uploaded_samples <- tail(colnames(corrected), n_uploaded)

                # Select the corresponding harmonized samples
                selected_harmonized <- harmonized_uploaded_samples[selected_indices]
                selected_sample_data <- corrected[, selected_harmonized, drop = FALSE]
                excluded_samples <- selected_harmonized

                message("Selected uploaded samples:", paste(samples, collapse = ", "))
                message("Mapped to harmonized samples:", paste(selected_harmonized, collapse = ", "))
            } else {
                # Use harmonized sample names directly
                available_samples <- colnames(corrected)
                samples <- intersect(samples, available_samples)
                if (length(samples) == 0) {
                    return(list(error = "No requested samples found in data"))
                }
                selected_sample_data <- corrected[, samples, drop = FALSE]
                excluded_samples <- samples
            }
        } else {
            # If no samples selected, use all samples for both reference and analysis
            selected_sample_data <- corrected
            excluded_samples <- NULL
        }

        # Compute reference medians from ALL samples EXCEPT the selected/uploaded samples
        message("Computing reference medians excluding selected samples...")
        if (!is.null(excluded_samples)) {
            message("Total samples available: ", ncol(corrected))
            message("Samples excluded from reference: ", length(excluded_samples))
            message("Samples used for reference: ", ncol(corrected) - length(excluded_samples))
            # Use all columns except the excluded ones
            reference_data <- corrected[, !(colnames(corrected) %in% excluded_samples), drop = FALSE]
        } else {
            message("No samples excluded from reference (using all samples)")
            message("Total samples available: ", ncol(corrected))
            reference_data <- corrected
        }
        message("Total genes: ", nrow(reference_data))

        reference_medians <- apply(reference_data, 1, function(x) {
            valid_values <- x[!is.na(x) & is.finite(x)]
            if (length(valid_values) > 0) {
                result <- median(valid_values, na.rm = TRUE)
                result
            } else {
                NA_real_
            }
        })

        # Debug: Show some reference median examples
        message("Reference median examples:")
        valid_indices <- which(!is.na(reference_medians))
        if (length(valid_indices) >= 5) {
            for (i in 1:5) {
                idx <- valid_indices[i]
                message(sprintf("Gene %s: reference_median = %.3f", gene_ids[idx], reference_medians[idx]))
            }
        }

        # Get sample count before cleanup
        sample_count <- ncol(selected_sample_data)

        # Use selected_sample_data for gene expression calculations
        corrected <- selected_sample_data

        # For individual sample analysis, use the expression values directly
        # If only one sample is selected, use its expression values
        if (ncol(corrected) == 1) {
            gene_means <- corrected[, 1]
        } else {
            # Calculate mean expression across samples for each gene (fallback)
            gene_means <- rowMeans(corrected, na.rm = TRUE)
        }

        gene_means[!is.finite(gene_means)] <- NA_real_

        # For genes that have all NA values (no expression data), set mean to NA
        all_na_rows <- apply(corrected, 1, function(row) all(is.na(row)))
        gene_means[all_na_rows] <- NA_real_

        # Load gene positions data
        message("Loading gene positions...")
        canonical_chromosomes <- c(as.character(1:22), "X", "Y", "MT")
        gene_positions <- fread(
            require_existing_path(
                resolve_disease_asset("aml", "reference", "gene_positions_hg38"),
                "AML gene positions hg38"
            ),
            data.table = FALSE
        )
        # The CSV has headers: "hgnc_symbol","chromosome_name","start_position","end_position"
        # But some rows have empty gene symbols, so we need to handle that
        gene_positions <- gene_positions[, c(1, 2, 3, 4)] # Extract the four columns we need
        # Filter out rows with empty gene symbols
        gene_positions <- gene_positions[gene_positions[[1]] != "" & !is.na(gene_positions[[1]]), ]
        # Set proper column names
        colnames(gene_positions) <- c("gene_id", "chromosome", "start_position", "end_position")

        gene_positions <- as.data.frame(gene_positions, stringsAsFactors = FALSE)
        gene_positions$gene_id <- trimws(gene_positions$gene_id)
        gene_positions <- gene_positions[gene_positions$gene_id != "" & !is.na(gene_positions$gene_id), ]

        gene_positions$chromosome <- toupper(trimws(gene_positions$chromosome))
        gene_positions$chromosome <- sub("^CHR", "", gene_positions$chromosome)

        to_numeric <- function(vec) {
            suppressWarnings(as.numeric(vec))
        }

        gene_positions$start_position <- to_numeric(gene_positions$start_position)
        gene_positions$end_position <- to_numeric(gene_positions$end_position)

        gene_positions$chromosome_rank <- match(gene_positions$chromosome, canonical_chromosomes)
        fallback_rank <- length(canonical_chromosomes) + 1
        gene_positions$chromosome_rank[is.na(gene_positions$chromosome_rank)] <- fallback_rank

        gene_positions <- gene_positions[order(
            gene_positions$gene_id,
            gene_positions$chromosome_rank,
            gene_positions$start_position,
            gene_positions$end_position,
            na.last = TRUE
        ), ]

        gene_positions <- gene_positions[!duplicated(gene_positions$gene_id),
            c("gene_id", "chromosome", "start_position", "end_position"),
            drop = FALSE
        ]

        gene_positions <- gene_positions[
            gene_positions$chromosome %in% canonical_chromosomes &
                !is.na(gene_positions$start_position) &
                !is.na(gene_positions$end_position),
        ]

        # Ensure gene_positions has correct data types
        gene_positions$gene_id <- as.character(gene_positions$gene_id)
        gene_positions$chromosome <- as.character(gene_positions$chromosome)
        gene_positions$start_position <- as.numeric(gene_positions$start_position)
        gene_positions$end_position <- as.numeric(gene_positions$end_position)

        # Additional check: ensure no duplicates remain
        if (any(duplicated(gene_positions$gene_id))) {
            message("Warning: gene_positions still has duplicates after processing")
            gene_positions <- gene_positions[!duplicated(gene_positions$gene_id), ]
        }

        # Create base result dataframe
        log2_expression <- rep(NA_real_, length(gene_means))
        zero_expression_flag <- rep(FALSE, length(gene_means))

        # Handle genes with expression data
        valid_indices <- which(!is.na(gene_means))
        if (length(valid_indices)) {
            # Handle 0 expression values more carefully
            zero_mask <- gene_means[valid_indices] == 0
            zero_expression_flag[valid_indices] <- zero_mask

            # For non-zero values, use log2(expression + 1)
            non_zero_mask <- !zero_mask
            if (any(non_zero_mask)) {
                log2_expression[valid_indices[non_zero_mask]] <- log2(gene_means[valid_indices[non_zero_mask]] + 1)
            }

            # For zero values, set to a value slightly below the minimum non-zero log expression
            if (any(zero_mask)) {
                min_non_zero_log <- min(log2_expression[valid_indices[non_zero_mask]], na.rm = TRUE)
                if (is.finite(min_non_zero_log)) {
                    log2_expression[valid_indices[zero_mask]] <- min_non_zero_log - 0.1
                } else {
                    # Fallback if all values are zero
                    log2_expression[valid_indices[zero_mask]] <- -0.1
                }
            }
        }

        # Handle genes without expression data (NA means)
        na_indices <- which(is.na(gene_means))
        if (length(na_indices) > 0) {
            log2_expression[na_indices] <- -1 # Very low value for no expression
            zero_expression_flag[na_indices] <- TRUE # Mark as no expression
        }

        # Compute CNV scores for each gene using reference medians
        epsilon <- 1e-6 # Small value to avoid division by zero and log(0)
        message("Computing CNV scores with epsilon =", epsilon)
        cnv_scores <- rep(NA_real_, length(gene_means))
        cnv_z_scores <- rep(NA_real_, length(cnv_scores))
        significant_cnv <- rep(FALSE, length(cnv_scores))
        significant_amplifications <- rep(FALSE, length(cnv_scores))
        significant_deletions <- rep(FALSE, length(cnv_scores))

        valid_ref_indices <- which(!is.na(reference_medians) & !is.na(gene_means) &
            reference_medians > 0 & gene_means > 0)
        message("Valid genes for CNV calculation: ", length(valid_ref_indices))

        if (length(valid_ref_indices) > 0) {
            cnv_scores[valid_ref_indices] <- log2((gene_means[valid_ref_indices] + epsilon) /
                (reference_medians[valid_ref_indices] + epsilon))

            # Debug: Show some CNV score examples
            message("CNV score examples:")
            for (i in 1:min(5, length(valid_ref_indices))) {
                idx <- valid_ref_indices[i]
                sample_val <- gene_means[idx]
                ref_val <- reference_medians[idx]
                cnv_val <- cnv_scores[idx]
                message(sprintf(
                    "Gene %s: sample=%.3f, ref=%.3f, CNV=%.3f",
                    gene_ids[idx], sample_val, ref_val, cnv_val
                ))
            }

            # Compute CNV statistics for change detection
            message("Computing CNV statistics for change detection...")

            # Calculate z-scores for CNV values (assuming they're approximately normal)
            cnv_mean <- mean(cnv_scores[valid_ref_indices], na.rm = TRUE)
            cnv_sd <- sd(cnv_scores[valid_ref_indices], na.rm = TRUE)
            cnv_z_scores <- rep(NA_real_, length(cnv_scores))
            cnv_z_scores[valid_ref_indices] <- (cnv_scores[valid_ref_indices] - cnv_mean) / cnv_sd

            # Identify significant CNV events (|z| > 2)
            significant_cnv <- abs(cnv_z_scores) > 2 & !is.na(cnv_z_scores)
            significant_amplifications <- cnv_z_scores > 2 & !is.na(cnv_z_scores)
            significant_deletions <- cnv_z_scores < -2 & !is.na(cnv_z_scores)

            message(sprintf("CNV Statistics: mean=%.4f, sd=%.4f", cnv_mean, cnv_sd))
            message(sprintf(
                "Significant CNV events: %d total (%.1f%%)",
                sum(significant_cnv), 100 * sum(significant_cnv) / length(valid_ref_indices)
            ))
            message(sprintf(
                "Amplifications (|z| > 2): %d (%.1f%%)",
                sum(significant_amplifications), 100 * sum(significant_amplifications) / length(valid_ref_indices)
            ))
            message(sprintf(
                "Deletions (|z| < -2): %d (%.1f%%)",
                sum(significant_deletions), 100 * sum(significant_deletions) / length(valid_ref_indices)
            ))

            # Compute regional statistics (sliding window)
            message("Computing regional CNV statistics (50-gene windows)...")
            window_size <- 50

            if (length(valid_ref_indices) >= window_size) {
                message(sprintf("Analyzed %d genes for regional statistics", length(valid_ref_indices)))
                # Simplified regional analysis - just count significant regions
                n_significant_regions <- sum(abs(cnv_z_scores[valid_ref_indices]) > 2)
                message(sprintf("Found %d significant CNV genes (|z| > 2)", n_significant_regions))
            } else {
                message("Insufficient data for regional analysis")
            }
        }

        # Debug: Check variable existence before dataframe creation
        message("Creating result dataframe...")
        message(sprintf("gene_ids length: %d", length(gene_ids)))
        message(sprintf("cnv_scores length: %d", length(cnv_scores)))
        message(sprintf("cnv_z_scores length: %d", length(cnv_z_scores)))
        message(sprintf("significant_cnv length: %d", length(significant_cnv)))

        result <- data.frame(
            gene_id = gene_ids,
            mean_expression = gene_means,
            log2_expression = log2_expression,
            cnv_score = cnv_scores,
            cnv_z_score = cnv_z_scores,
            reference_median = reference_medians,
            is_significant_cnv = significant_cnv,
            is_amplification = significant_amplifications,
            is_deletion = significant_deletions,
            zero_expression = zero_expression_flag,
            stringsAsFactors = FALSE
        )

        message("Result dataframe created successfully")
        message(sprintf("Result has %d rows and %d columns", nrow(result), ncol(result)))

        # Add gene position information using match() to avoid merge issues
        message("Adding gene positions...")
        # Create position lookup
        pos_lookup <- gene_positions[, c("gene_id", "chromosome", "start_position", "end_position")]
        rownames(pos_lookup) <- pos_lookup$gene_id

        # Match genes to positions
        matches <- match(result$gene_id, pos_lookup$gene_id)

        # Add position columns (will be NA for unmatched genes)
        result$chromosome <- pos_lookup$chromosome[matches]
        result$start_position <- pos_lookup$start_position[matches]
        result$end_position <- pos_lookup$end_position[matches]

        # Normalize column types after position assignment
        message("Converting column types after position assignment...")
        result$chromosome <- as.character(result$chromosome)
        result$start_position <- suppressWarnings(as.numeric(result$start_position))
        result$end_position <- suppressWarnings(as.numeric(result$end_position))

        # Replace any NaN or infinite values with NA
        result$start_position[!is.finite(result$start_position)] <- NA_real_
        result$end_position[!is.finite(result$end_position)] <- NA_real_

        # Filter out rows without valid positions
        result <- result[!is.na(result$start_position) & !is.na(result$end_position), ]


        # Create a combined chromosomal position for sorting
        # Convert chromosome names to sortable format
        result$chr_sort <- sapply(result$chromosome, function(chr) {
            if (chr == "X") {
                return(23)
            }
            if (chr == "Y") {
                return(24)
            }
            as.numeric(chr) # Numeric chromosomes 1-21
        })

        # Sort by chromosome and position within chromosome
        result <- result[order(result$chr_sort, result$start_position), ]

        # Create a continuous genomic position for plotting using actual genomic coordinates
        # Use start_position as the primary genomic position
        result$genomic_position <- result$start_position

        # Cleanup
        rm(corrected, gene_means, gene_positions)
        gc()

        return(list(
            genome_expression = result,
            sample_count = sample_count,
            gene_count = nrow(result),
            chromosomes = unique(result$chromosome[order(result$chr_sort)]),
            bin_size = bin_size,
            metadata = list(gender = sample_sex)
        ))
    }
})

#* @get /bridge-predict
#* @serializer json
bridge_predict <- local({
    function(req) {
        cache_dir <- req$args$cachedir
        sample_id <- req$args$sample
        requested_sample_id <- sample_id
        disease_id <- get_request_disease(req)

        if (is.null(sample_id) || !nzchar(sample_id)) {
            return(list(error = "sample parameter is required"))
        }

        sample_data_path <- file.path(cache_dir, "sample_data.fst")
        if (!file.exists(sample_data_path)) {
            return(list(error = "No uploaded sample data found. Please upload data first."))
        }

        bridge_assets <- resolve_bridge_assets(disease_id)
        bundle_path <- first_existing_path(bridge_assets$bundle_candidates)
        meta_path <- first_existing_path(bridge_assets$meta_candidates)
        ckpt_path <- first_existing_path(bridge_assets$ckpt_candidates)
        lr_path <- first_existing_path(bridge_assets$lr_candidates)
        script_path <- "bridge_predict.py"

        artifact_source <- "standalone"
        use_bundle_path <- NULL
        if (!is.null(bundle_path) && file.exists(bundle_path)) {
            use_bundle_path <- bundle_path
            artifact_source <- "bundle"
        }

        if (!is.null(use_bundle_path)) {
            required_paths <- c(use_bundle_path, script_path)
        } else {
            unresolved_artifacts <- c(
                meta = is.null(meta_path),
                ckpt = is.null(ckpt_path),
                classifier = is.null(lr_path)
            )
            if (any(unresolved_artifacts)) {
                return(list(
                    error = paste(
                        "Missing Bridge files in registry:",
                        paste(names(unresolved_artifacts)[unresolved_artifacts], collapse = ", ")
                    ),
                    disease = disease_id
                ))
            }
            required_paths <- c(meta_path, ckpt_path, lr_path, script_path)
        }
        missing_paths <- required_paths[!file.exists(required_paths)]
        if (length(missing_paths) > 0) {
            return(list(error = paste("Missing Bridge files:", paste(missing_paths, collapse = ", "))))
        }

        bridge_python <- find_bridge_python()
        if (is.null(bridge_python)) {
            return(list(error = "Bridge python environment not found. Set BRIDGE_PYTHON to a Python executable with the official Bridge package and dependencies installed."))
        }

        sample_data <- read_fst(sample_data_path)
        available_sample_cols <- colnames(sample_data)[-1]
        if (!(sample_id %in% colnames(sample_data))) {
            suffix_candidates <- c(
                paste0(sample_id, "_unstranded"),
                paste0(sample_id, "_fwd"),
                paste0(sample_id, "_rev")
            )
            matched_candidate <- suffix_candidates[suffix_candidates %in% available_sample_cols]
            if (length(matched_candidate) > 0) {
                sample_id <- matched_candidate[1]
            }
        }

        if (!(sample_id %in% colnames(sample_data))) {
            return(list(
                error = "Requested sample not found in uploaded data",
                available_samples = available_sample_cols
            ))
        }

        gene_col <- colnames(sample_data)[1]
        gene_ids <- as.character(sample_data[[gene_col]])
        stripped_gene_ids <- sub("\\.[0-9]+$", "", gene_ids)

        ensg_fraction <- mean(grepl("^ENSG", stripped_gene_ids), na.rm = TRUE)
        if (is.na(ensg_fraction)) ensg_fraction <- 0

        converted_gene_ids <- stripped_gene_ids
        gene_id_note <- "Input gene IDs appear to be Ensembl IDs."

        if (ensg_fraction < 0.5) {
            if (requireNamespace("seAMLess", quietly = TRUE)) {
                mapping_df <- seAMLess::grch38
                mapped_ensg <- mapping_df$ensgene[match(stripped_gene_ids, mapping_df$symbol)]
                n_mapped <- sum(!is.na(mapped_ensg))
                if (n_mapped > 0) {
                    converted_gene_ids[!is.na(mapped_ensg)] <- mapped_ensg[!is.na(mapped_ensg)]
                    gene_id_note <- paste0(
                        "Converted gene symbols to Ensembl IDs for ",
                        n_mapped,
                        " rows before Bridge inference."
                    )
                } else {
                    gene_id_note <- "Input genes are not Ensembl IDs and symbol->Ensembl mapping failed."
                }
            } else {
                gene_id_note <- "Input genes are not Ensembl IDs and seAMLess mapping is unavailable."
            }
        }

        sample_frame <- data.frame(
            gene_id = converted_gene_ids,
            stringsAsFactors = FALSE
        )
        sample_frame[[sample_id]] <- sample_data[[sample_id]]

        input_csv <- tempfile(fileext = ".csv")
        on.exit(unlink(input_csv), add = TRUE)
        fwrite(sample_frame, input_csv)

        if (!is.null(use_bundle_path)) {
            cmd_args <- c(
                script_path,
                "--input-csv", input_csv,
                "--bundle", use_bundle_path,
                "--sample-name", sample_id
            )
        } else {
            cmd_args <- c(
                script_path,
                "--input-csv", input_csv,
                "--meta", meta_path,
                "--ckpt", ckpt_path,
                "--lr", lr_path,
                "--sample-name", sample_id
            )
        }

        output <- tryCatch(
            {
                system2(bridge_python, cmd_args, stdout = TRUE, stderr = TRUE)
            },
            error = function(e) {
                return(structure(character(), status = 1L, error_message = e$message))
            }
        )

        status_code <- attr(output, "status")
        if (!is.null(status_code) && status_code != 0) {
            return(list(
                error = "Bridge prediction failed",
                status = status_code,
                details = paste(output, collapse = "\n")
            ))
        }

        if (length(output) == 0) {
            return(list(error = "Bridge prediction returned no output"))
        }

        json_line <- tail(output, 1)
        parsed <- tryCatch(
            {
                jsonlite::fromJSON(
                    json_line,
                    simplifyVector = TRUE,
                    simplifyDataFrame = FALSE
                )
            },
            error = function(e) {
                list(
                    error = "Failed to parse Bridge prediction output",
                    details = e$message,
                    raw = paste(output, collapse = "\n")
                )
            }
        )

        if (is.list(parsed) && is.null(parsed$error)) {
            parsed$gene_id_note <- gene_id_note
            parsed$requested_sample <- requested_sample_id
            parsed$resolved_sample_column <- sample_id
            parsed$artifact_source <- artifact_source
            parsed$disease <- disease_id
            if (!is.null(use_bundle_path)) {
                parsed$artifact_bundle_path <- use_bundle_path
            }
            if (grepl("_(fwd|rev)$", sample_id)) {
                parsed$warning <- paste(
                    c(parsed$warning, "Using stranded count column. Prefer *_unstranded for Bridge unless your pipeline requires stranded counts."),
                    collapse = " "
                )
            }
        }

        return(parsed)
    }
})

#* @get /amlmapr-predict
#* @serializer json
amlmapr_predict <- local({
    function(req) {
        cache_dir <- req$args$cachedir
        requested_sample_id <- req$args$sample
        disease_id <- get_request_disease(req)

        if (is.null(requested_sample_id) || !nzchar(requested_sample_id)) {
            return(list(error = "sample parameter is required"))
        }

        sample_data_path <- file.path(cache_dir, "sample_data.fst")
        if (!file.exists(sample_data_path)) {
            return(list(error = "No uploaded sample data found. Please upload data first."))
        }

        assets <- resolve_molecular_tool_assets("amlmapr")
        required_assets <- c(
            functions_r = assets$functions_r,
            sysdata_rda = assets$sysdata_rda,
            example_matrix_rda = assets$example_matrix_rda
        )
        missing_assets <- names(required_assets)[vapply(required_assets, function(x) is.null(x) || !file.exists(x), logical(1))]
        if (length(missing_assets) > 0) {
            return(list(error = paste("Missing AMLmapR files in registry:", paste(missing_assets, collapse = ", "))))
        }

        if (!requireNamespace("caret", quietly = TRUE) || !requireNamespace("kernlab", quietly = TRUE)) {
            return(list(
                error = "AMLmapR dependencies are missing in the R backend environment.",
                required_packages = c("caret", "kernlab")
            ))
        }

        sample_data <- read_fst(sample_data_path)
        sample_resolution <- resolve_uploaded_sample_column(sample_data, requested_sample_id)
        sample_id <- sample_resolution$resolved_sample_column
        if (!(sample_id %in% colnames(sample_data))) {
            return(list(
                error = "Requested sample not found in uploaded data",
                available_samples = sample_resolution$available_samples
            ))
        }

        counts_dt <- extract_uploaded_sample_counts(sample_data, sample_id)
        counts_dt[, count := as.integer(round(count))]
        counts_dt[is.na(count), count := 0L]
        counts_dt <- counts_dt[, .(count = sum(count, na.rm = TRUE)), by = gene_id]

        amlmapr_result <- tryCatch(
            {
                suppressPackageStartupMessages(library(caret))
                suppressPackageStartupMessages(library(kernlab))

                aml_env <- new.env(parent = .GlobalEnv)
                source(required_assets[["functions_r"]], local = aml_env)
                load(required_assets[["sysdata_rda"]], envir = aml_env)
                example_env <- new.env(parent = emptyenv())
                load(required_assets[["example_matrix_rda"]], envir = example_env)
                example_matrix <- get("example_matrix", envir = example_env)

                # AMLmapR assumes matrix subsetting keeps dimensions; patch for single-sample inputs.
                aml_env$scale_data <- function(matrix, d) {
                    predict(d$scaler, matrix[, d$genes, drop = FALSE])
                }
                aml_env$deseq_normalise <- function(matrix, d) {
                    pseudo_reference <- d[["keep"]][[2]]
                    keep <- d$keep[[1]]
                    ratio_to_ref <- apply(matrix[, keep, drop = FALSE], 1, function(x) x / pseudo_reference)
                    if (is.null(dim(ratio_to_ref))) {
                        ratio_to_ref <- matrix(ratio_to_ref, ncol = 1)
                    }
                    sizeFactor <- apply(ratio_to_ref, 2, function(x) stats::median(x))
                    matrix <- matrix / sizeFactor
                    matrix <- log(matrix + 1)
                    matrix
                }

                ref_genes <- colnames(example_matrix)
                ref_gene_keys <- sub("\\.[0-9]+$", "", ref_genes)
                count_lookup <- setNames(counts_dt$count, counts_dt$gene_id)
                padded_counts <- as.integer(count_lookup[ref_gene_keys])
                padded_counts[is.na(padded_counts)] <- 0L

                aml_matrix <- matrix(padded_counts, nrow = 1)
                colnames(aml_matrix) <- ref_genes
                rownames(aml_matrix) <- sample_id

                pred <- aml_env$predict_AML_clusters(aml_matrix)
                pred_row <- pred[1, , drop = FALSE]
                score_cols <- setdiff(colnames(pred_row), c("prediction", "pass_cutoff", "sample_id"))
                score_values <- as.numeric(pred_row[1, score_cols, drop = TRUE])
                names(score_values) <- score_cols
                score_values <- sort(score_values, decreasing = TRUE)

                list(
                    sample_id = sample_id,
                    model = "AMLmapR",
                    prediction = as.character(pred_row$prediction[[1]]),
                    pass_cutoff = isTRUE(pred_row$pass_cutoff[[1]]),
                    top_scores = lapply(
                        head(names(score_values), 10),
                        function(lbl) list(label = lbl, score = unname(score_values[[lbl]]))
                    ),
                    score_count = length(score_cols),
                    input_gene_count = nrow(counts_dt),
                    expected_gene_count = length(ref_genes),
                    matched_nonzero_reference_genes = sum(padded_counts > 0, na.rm = TRUE),
                    gene_id_note = "Matched uploaded Ensembl IDs to AMLmapR reference gene order by stripping version suffixes.",
                    implementation = "amlmapr_r_package_source"
                )
            },
            error = function(e) {
                list(
                    error = "AMLmapR prediction failed",
                    details = e$message
                )
            }
        )

        amlmapr_result$requested_sample <- requested_sample_id
        amlmapr_result$resolved_sample_column <- sample_id
        amlmapr_result$disease <- disease_id
        if (!is.null(sample_resolution$warning)) {
            amlmapr_result$warning <- paste(
                c(amlmapr_result$warning, sample_resolution$warning),
                collapse = " "
            )
        }
        if (!disease_id %in% c("aml", "pan_leukemia")) {
            amlmapr_result$warning <- paste(
                c(amlmapr_result$warning, "AMLmapR is an AML-specific classifier; interpret non-AML results cautiously."),
                collapse = " "
            )
        }

        return(amlmapr_result)
    }
})

#* @get /allcatchr-predict
#* @serializer json
allcatchr_predict <- local({
    function(req) {
        cache_dir <- req$args$cachedir
        requested_sample_id <- req$args$sample
        disease_id <- get_request_disease(req)

        if (is.null(requested_sample_id) || !nzchar(requested_sample_id)) {
            return(list(error = "sample parameter is required"))
        }

        sample_data_path <- file.path(cache_dir, "sample_data.fst")
        if (!file.exists(sample_data_path)) {
            return(list(error = "No uploaded sample data found. Please upload data first."))
        }

        required_pkgs <- c("ALLCatchRbcrabl1", "singscore", "caret", "LiblineaR", "kknn", "randomForest", "ranger", "glmnet")
        missing_pkgs <- required_pkgs[!vapply(
            required_pkgs,
            function(pkg) requireNamespace(pkg, quietly = TRUE),
            logical(1)
        )]
        if (length(missing_pkgs) > 0) {
            return(list(
                error = "ALLCatchR_bcrabl1 dependencies are missing in the R backend environment.",
                required_packages = required_pkgs,
                missing_packages = missing_pkgs
            ))
        }

        sample_data <- read_fst(sample_data_path)
        sample_resolution <- resolve_uploaded_sample_column(sample_data, requested_sample_id)
        sample_id <- sample_resolution$resolved_sample_column
        if (!(sample_id %in% colnames(sample_data))) {
            return(list(
                error = "Requested sample not found in uploaded data",
                available_samples = sample_resolution$available_samples
            ))
        }

        counts_dt <- extract_uploaded_sample_counts(sample_data, sample_id)
        counts_dt[, count := as.integer(round(count))]
        counts_dt[is.na(count), count := 0L]
        counts_dt <- counts_dt[, .(count = sum(count, na.rm = TRUE)), by = gene_id]
        counts_dt <- counts_dt[!is.na(gene_id) & trimws(gene_id) != ""]

        input_csv <- tempfile(fileext = ".csv")
        output_csv <- tempfile(fileext = ".csv")
        on.exit(unlink(c(input_csv, output_csv)), add = TRUE)

        allcatchr_input <- data.frame(gene_id = counts_dt$gene_id, stringsAsFactors = FALSE, check.names = FALSE)
        allcatchr_input[[sample_id]] <- counts_dt$count
        fwrite(allcatchr_input, input_csv)

        stdout_log <- character(0)
        allcatchr_result <- tryCatch(
            {
                pred_df <- NULL
                stdout_log <- capture.output({
                    suppressPackageStartupMessages(library(ALLCatchRbcrabl1))
                    pred_df <- allcatch_bcrabl1(
                        Counts.file = input_csv,
                        ID_class = "ensemble_ID",
                        sep = ",",
                        out.file = output_csv
                    )
                })

                if (is.null(pred_df) && file.exists(output_csv)) {
                    pred_df <- fread(output_csv, data.table = FALSE)
                }
                if (is.null(pred_df) || nrow(pred_df) == 0) {
                    stop("ALLCatchR_bcrabl1 returned no predictions")
                }

                if ("sample" %in% colnames(pred_df)) {
                    pred_row <- pred_df[pred_df$sample == sample_id, , drop = FALSE]
                    if (nrow(pred_row) == 0 && requested_sample_id != sample_id) {
                        pred_row <- pred_df[pred_df$sample == requested_sample_id, , drop = FALSE]
                    }
                    if (nrow(pred_row) == 0) pred_row <- pred_df[1, , drop = FALSE]
                } else {
                    pred_row <- pred_df[1, , drop = FALSE]
                }

                row_list <- as.list(pred_row[1, , drop = FALSE])
                score_num <- suppressWarnings(as.numeric(row_list[["Score"]]))
                blast_counts_num <- suppressWarnings(as.numeric(row_list[["BlastCounts"]]))

                list(
                    sample_id = as.character(row_list[["sample"]] %||% sample_id),
                    model = "ALLCatchRbcrabl1",
                    prediction = as.character(row_list[["Prediction"]] %||% NA_character_),
                    confidence = if (is.finite(score_num)) score_num else NULL,
                    confidence_label = as.character(row_list[["Confidence"]] %||% NA_character_),
                    bcr_abl1_maincluster_pred = as.character(row_list[["BCR_ABL1_maincluster_pred"]] %||% NA_character_),
                    bcr_abl1_maincluster_score = as.character(row_list[["BCR_ABL1_maincluster_score"]] %||% NA_character_),
                    bcr_abl1_subcluster_pred = as.character(row_list[["BCR_ABL1_subcluster_pred"]] %||% NA_character_),
                    bcr_abl1_subcluster_score = as.character(row_list[["BCR_ABL1_subcluster_score"]] %||% NA_character_),
                    bcr_abl1_hyperdiploidy_pred = as.character(row_list[["BCR_ABL1_hyperdiploidy_pred"]] %||% NA_character_),
                    bcr_abl1_hyperdiploidy_score = as.character(row_list[["BCR_ABL1_hyperdiploidy_score"]] %||% NA_character_),
                    immuno = as.character(row_list[["Immuno"]] %||% NA_character_),
                    immuno_score = suppressWarnings(as.numeric(row_list[["ScoreImmuno"]])),
                    sex_prediction = as.character(row_list[["Sex"]] %||% NA_character_),
                    sex_score = suppressWarnings(as.numeric(row_list[["Score_sex"]])),
                    blast_counts = if (is.finite(blast_counts_num)) blast_counts_num else NULL,
                    input_gene_count = nrow(counts_dt),
                    implementation = "allcatchr_bcrabl1_r_package",
                    gene_id_note = "ALLCatchR_bcrabl1 run with ID_class=ensemble_ID using uploaded raw counts with Ensembl version suffixes removed.",
                    stdout_log = stdout_log
                )
            },
            error = function(e) {
                list(
                    error = "ALLCatchR prediction failed",
                    details = e$message,
                    stdout_log = stdout_log
                )
            }
        )

        allcatchr_result$requested_sample <- requested_sample_id
        allcatchr_result$resolved_sample_column <- sample_id
        allcatchr_result$disease <- disease_id
        if (!is.null(sample_resolution$warning)) {
            allcatchr_result$warning <- paste(c(allcatchr_result$warning, sample_resolution$warning), collapse = " ")
        }
        if (!disease_id %in% c("ball", "pan_leukemia")) {
            allcatchr_result$warning <- paste(
                c(allcatchr_result$warning, "ALLCatchR_bcrabl1 is a B-ALL classifier; interpret non-B-ALL context results cautiously."),
                collapse = " "
            )
        }
        allcatchr_result$stdout_log <- NULL

        return(allcatchr_result)
    }
})

#* @get /allsorts-predict
#* @serializer json
allsorts_predict <- local({
    function(req) {
        cache_dir <- req$args$cachedir
        requested_sample_id <- req$args$sample
        disease_id <- get_request_disease(req)

        if (is.null(requested_sample_id) || !nzchar(requested_sample_id)) {
            return(list(error = "sample parameter is required"))
        }

        sample_data_path <- file.path(cache_dir, "sample_data.fst")
        if (!file.exists(sample_data_path)) {
            return(list(error = "No uploaded sample data found. Please upload data first."))
        }

        python_bin <- find_molecular_tools_python()
        if (is.null(python_bin)) {
            return(list(error = "Molecular tools python environment not found. Set MOLECULAR_TOOLS_PYTHON to a Python executable with ALLSorts/TALLSorts installed."))
        }

        assets <- resolve_molecular_tool_assets("allsorts")
        required_assets <- c(
            model = assets$model,
            model_dir = assets$model_dir
        )
        missing_assets <- names(required_assets)[vapply(required_assets, function(x) is.null(x) || !file.exists(x), logical(1))]
        if (length(missing_assets) > 0) {
            return(list(error = paste("Missing ALLSorts files in registry:", paste(missing_assets, collapse = ", "))))
        }

        sample_data <- read_fst(sample_data_path)
        sample_resolution <- resolve_uploaded_sample_column(sample_data, requested_sample_id)
        sample_id <- sample_resolution$resolved_sample_column
        if (!(sample_id %in% colnames(sample_data))) {
            return(list(
                error = "Requested sample not found in uploaded data",
                available_samples = sample_resolution$available_samples
            ))
        }

        counts_dt <- extract_uploaded_sample_counts(sample_data, sample_id)
        symbol_conversion <- tryCatch(
            convert_counts_to_gene_symbols(counts_dt),
            error = function(e) list(error = e$message)
        )
        if (!is.null(symbol_conversion$error)) {
            return(list(error = "Failed to convert Ensembl IDs to gene symbols for ALLSorts", details = symbol_conversion$error))
        }

        input_csv <- tempfile(fileext = ".csv")
        on.exit(unlink(input_csv), add = TRUE)
        write_feature_row_csv(symbol_conversion$counts, sample_id, input_csv, feature_col = "gene_symbol")

        parsed <- run_json_python_script(
            python_bin,
            "allsorts_predict.py",
            c(
                "--input-csv", input_csv,
                "--sample-name", sample_id,
                "--model", assets$model,
                "--model-dir", assets$model_dir,
                "--parents"
            ),
            tool_label = "ALLSorts prediction"
        )

        if (is.list(parsed) && is.null(parsed$error)) {
            parsed$gene_id_note <- symbol_conversion$note
            parsed$requested_sample <- requested_sample_id
            parsed$resolved_sample_column <- sample_id
            parsed$disease <- disease_id
            if (!is.null(sample_resolution$warning)) {
                parsed$warning <- paste(c(parsed$warning, sample_resolution$warning), collapse = " ")
            }
            if (!disease_id %in% c("ball", "pan_leukemia")) {
                parsed$warning <- paste(
                    c(parsed$warning, "ALLSorts is a B-ALL classifier; interpret non-B-ALL context results cautiously."),
                    collapse = " "
                )
            }
            parsed$stdout_log <- NULL
        }

        return(parsed)
    }
})

#* @get /tallsorts-predict
#* @serializer json
tallsorts_predict <- local({
    function(req) {
        cache_dir <- req$args$cachedir
        requested_sample_id <- req$args$sample
        disease_id <- get_request_disease(req)

        if (is.null(requested_sample_id) || !nzchar(requested_sample_id)) {
            return(list(error = "sample parameter is required"))
        }

        sample_data_path <- file.path(cache_dir, "sample_data.fst")
        if (!file.exists(sample_data_path)) {
            return(list(error = "No uploaded sample data found. Please upload data first."))
        }

        python_bin <- find_molecular_tools_python()
        if (is.null(python_bin)) {
            return(list(error = "Molecular tools python environment not found. Set MOLECULAR_TOOLS_PYTHON to a Python executable with ALLSorts/TALLSorts installed."))
        }

        assets <- resolve_molecular_tool_assets("tallsorts")
        missing_assets <- names(assets)[vapply(assets, function(x) is.null(x), logical(1))]
        if (is.null(assets$model) || !file.exists(assets$model)) {
            return(list(error = "Missing TALLSorts model file in registry"))
        }

        sample_data <- read_fst(sample_data_path)
        sample_resolution <- resolve_uploaded_sample_column(sample_data, requested_sample_id)
        sample_id <- sample_resolution$resolved_sample_column
        if (!(sample_id %in% colnames(sample_data))) {
            return(list(
                error = "Requested sample not found in uploaded data",
                available_samples = sample_resolution$available_samples
            ))
        }

        counts_dt <- extract_uploaded_sample_counts(sample_data, sample_id)
        input_csv <- tempfile(fileext = ".csv")
        on.exit(unlink(input_csv), add = TRUE)
        write_feature_row_csv(counts_dt[, .(gene_id, count)], sample_id, input_csv, feature_col = "gene_id")

        parsed <- run_json_python_script(
            python_bin,
            "tallsorts_predict.py",
            c(
                "--input-csv", input_csv,
                "--sample-name", sample_id,
                "--model", assets$model
            ),
            tool_label = "TALLSorts prediction"
        )

        if (is.list(parsed) && is.null(parsed$error)) {
            parsed$requested_sample <- requested_sample_id
            parsed$resolved_sample_column <- sample_id
            parsed$disease <- disease_id
            parsed$gene_id_note <- "TALLSorts uses Ensembl gene IDs; uploaded IDs were stripped of version suffixes before inference."
            if (!is.null(sample_resolution$warning)) {
                parsed$warning <- paste(c(parsed$warning, sample_resolution$warning), collapse = " ")
            }
            if (!disease_id %in% c("tall", "pan_leukemia")) {
                parsed$warning <- paste(
                    c(parsed$warning, "TALLSorts is a T-ALL classifier; interpret non-T-ALL context results cautiously."),
                    collapse = " "
                )
            }
            parsed$stdout_log <- NULL
        }

        return(parsed)
    }
})

#* Platform catalog: modalities, reference cohorts, capabilities and tools.
#* Single source of truth for the frontend (Phase 0: descriptive only).
#* @get /catalog
#* @serializer json
function(req) {
    build_platform_catalog()
}

#* @get /molecular-tools
#* @serializer json
function(req) {
    disease_id <- get_request_disease(req)
    disease_selection <- get_request_disease_selection(req)

    return(list(
        request_disease = disease_id,
        request_diseases = disease_selection,
        tools = molecular_tools_catalog(disease_id)
    ))
}

#* @get /molecular-predict
#* @serializer json
function(req) {
    dispatch_molecular_prediction(req)
}

#* @get /ai-report
#* @serializer json
function(req) {
    library(httr)
    library(jsonlite)

    tryCatch(
        {
            api_key <- Sys.getenv("OPENAI_API_KEY")
            if (api_key == "") {
                return(list(error = "OpenAI API key not found in environment variables"))
            }

            patient_info <- trimws(as.character(req$args$patientInfo %||% ""))
            model <- trimws(as.character(req$args$model %||% ""))

            message(paste("Patient info:", patient_info))
            message(paste("Selected model:", model))

            if (patient_info == "") {
                return(list(error = "Patient information is required"))
            }

            if (model == "" || model == "gpt-o1-mini" || model == "o1-mini") {
                model <- "gpt-5.4-mini"
            }

            url <- "https://api.openai.com/v1/responses"
            headers <- c(
                "Content-Type" = "application/json",
                "Authorization" = paste("Bearer", api_key)
            )
            system_prompt <- paste(
                "You are an AML clinical research assistant.",
                "Use patient-specific evidence only from the provided input.",
                "Use web search for up-to-date external evidence and references.",
                "Do not fabricate sample-specific values; if a value is missing, say that it is unavailable.",
                "Return concise Markdown with sections:",
                "1) Patient-Specific Findings, 2) Evidence-Grounded Context, 3) Limitations, 4) Sources."
            )
            body <- list(
                model = model,
                input = list(
                    list(
                        role = "system",
                        content = list(
                            list(
                                type = "input_text",
                                text = system_prompt
                            )
                        )
                    ),
                    list(
                        role = "user",
                        content = list(
                            list(
                                type = "input_text",
                                text = patient_info
                            )
                        )
                    )
                ),
                tools = list(
                    list(
                        type = "web_search_preview",
                        search_context_size = "high"
                    )
                ),
                temperature = 0.2,
                max_output_tokens = 1200
            )

            response <- POST(
                url,
                add_headers(.headers = headers),
                body = toJSON(body, auto_unbox = TRUE),
                encode = "json"
            )

            parsed <- content(response, "parsed", simplifyVector = FALSE)
            if (http_status(response)$category != "Success") {
                error_message <- parsed$error$message %||% http_status(response)$message
                return(list(error = paste("API request failed:", error_message)))
            }

            summary <- ""
            if (!is.null(parsed$output_text) && is.character(parsed$output_text) && length(parsed$output_text) > 0) {
                summary <- paste(parsed$output_text, collapse = "\n\n")
            }

            if (summary == "" && !is.null(parsed$output) && is.list(parsed$output)) {
                text_chunks <- character(0)
                for (output_item in parsed$output) {
                    if (!is.list(output_item) || is.null(output_item$content) || !is.list(output_item$content)) next
                    for (content_item in output_item$content) {
                        if (!is.list(content_item)) next
                        if (identical(content_item$type, "output_text") && !is.null(content_item$text)) {
                            text_chunks <- c(text_chunks, as.character(content_item$text))
                        }
                    }
                }
                if (length(text_chunks) > 0) {
                    summary <- paste(text_chunks, collapse = "\n\n")
                }
            }

            sources <- list()
            seen_urls <- character(0)
            if (!is.null(parsed$output) && is.list(parsed$output)) {
                for (output_item in parsed$output) {
                    if (!is.list(output_item) || is.null(output_item$content) || !is.list(output_item$content)) next
                    for (content_item in output_item$content) {
                        if (!is.list(content_item) || is.null(content_item$annotations) || !is.list(content_item$annotations)) next
                        for (annotation in content_item$annotations) {
                            if (!is.list(annotation)) next
                            url_value <- as.character(annotation$url %||% "")
                            title_value <- as.character(annotation$title %||% url_value)
                            if (url_value == "" || url_value %in% seen_urls) next
                            seen_urls <- c(seen_urls, url_value)
                            sources[[length(sources) + 1]] <- list(
                                title = title_value,
                                url = url_value
                            )
                        }
                    }
                }
            }

            if (summary == "") {
                return(list(error = "No textual summary was returned by the model"))
            }

            return(list(
                summary = summary,
                sources = sources,
                model = model
            ))
        },
        error = function(e) {
            return(list(error = paste("An error occurred:", e$message)))
        }
    )
}

#* Get QC metrics for RNA-seq data
#* @get /qc-metrics
function(req) {
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

#* @get /sample-data-names
#* @serializer json
sample_data_names <- function(req) {
    cache_dir <- req$args$cachedir
    sample_path <- file.path(cache_dir, "sample_data.fst")
    if (!file.exists(sample_path)) {
        return(character(0))
    }
    return(colnames(read_fst(sample_path)))
}

#* @get /harmonized-data-names
#* @serializer json
harmonized_data_names <- function(req) {
    cache_dir <- req$args$cachedir
    harmonized_path <- file.path(cache_dir, "harmonized_data.fst")
    if (!file.exists(harmonized_path)) {
        return(character(0))
    }
    return(colnames(read_fst(harmonized_path)))
}

# source the DEG.R file
# starting to layer out the code
# source("DEG.R")

#* @get /knn-deg
#* @serializer json
function(req) {
    cache_dir <- req$args$cachedir
    library(limma)
    library(data.table)

    # Get parameters from request
    k <- if (!is.null(req$args$k)) as.integer(req$args$k) else 20
    sample_id <- req$args$sampleId

    if (is.null(sample_id)) {
        return(list(error = "Sample ID is required"))
    }
    # Get the harmonized data
    corrected <- get_corrected_data(cache_dir)
    # Get KNN results for the selected sample
    knn_result <- FNN::get.knn(t(corrected), k = k)

    # Find the index of the selected sample
    sample_idx <- which(colnames(corrected) == sample_id)
    if (length(sample_idx) == 0) {
        return(list(error = "Sample not found"))
    }

    # Get the neighbors for the selected sample
    neighbors <- knn_result$nn.index[sample_idx, ]

    # Create contrast vector for limma
    # Create a factor with the target sample and its neighbors vs background
    group <- factor(ifelse(1:ncol(corrected) == sample_idx, "target",
        ifelse(1:ncol(corrected) %in% neighbors, "neighbor", "background")
    ))

    # Create design matrix
    design <- model.matrix(~ 0 + group)
    colnames(design) <- levels(group)

    # Define contrasts of interest
    contrast.matrix <- makeContrasts(
        target_vs_background = target - background,
        neighbor_vs_background = neighbor - background,
        target_vs_neighbor = target - neighbor,
        levels = design
    )

    # Fit the model and calculate statistics
    fit <- lmFit(corrected, design)
    fit <- contrasts.fit(fit, contrast.matrix)
    fit <- eBayes(fit, trend = TRUE)

    # Get results for all contrasts
    results <- list(
        target_vs_background = topTable(fit, coef = 1, number = Inf),
        neighbor_vs_background = topTable(fit, coef = 2, number = Inf),
        target_vs_neighbor = topTable(fit, coef = 3, number = Inf)
    )

    # add a column for -log10(FDR)
    results[["neighbor_vs_background"]]$logFDR <- -log10(results[["neighbor_vs_background"]]$adj.P.Val)

    return(results[["neighbor_vs_background"]])
}


#* @get /sample-dysregulation
#* @serializer json
function(req) {
    cache_dir <- req$args$cachedir
    sample_id <- as.character(req$args$sample %||% req$args$sampleId %||% "")
    top_n <- suppressWarnings(as.integer(req$args$top_n %||% 50))
    min_abs_delta <- suppressWarnings(as.numeric(req$args$min_abs_delta %||% 1.0))
    min_abs_z <- suppressWarnings(as.numeric(req$args$min_abs_z %||% 2.0))
    up_percentile <- suppressWarnings(as.numeric(req$args$up_percentile %||% 0.95))
    down_percentile <- suppressWarnings(as.numeric(req$args$down_percentile %||% 0.05))

    if (!nzchar(sample_id)) {
        return(list(error = "sample parameter is required"))
    }

    if (!is.finite(top_n) || top_n < 1) top_n <- 50
    top_n <- min(top_n, 500L)
    if (!is.finite(min_abs_delta) || min_abs_delta <= 0) min_abs_delta <- 1.0
    if (!is.finite(min_abs_z) || min_abs_z <= 0) min_abs_z <- 2.0
    if (!is.finite(up_percentile) || up_percentile <= 0 || up_percentile >= 1) up_percentile <- 0.95
    if (!is.finite(down_percentile) || down_percentile <= 0 || down_percentile >= 1) down_percentile <- 0.05

    corrected <- tryCatch(
        get_corrected_data(cache_dir),
        error = function(e) NULL
    )
    if (is.null(corrected) || ncol(corrected) < 2) {
        return(list(error = "Harmonized data not found. Run harmonization before dysregulation analysis."))
    }

    resolved <- resolve_harmonized_sample_column(corrected, sample_id)
    resolved_sample <- resolved$resolved_sample_column
    if (!(resolved_sample %in% colnames(corrected))) {
        return(list(
            error = "Requested sample not found in harmonized data",
            requested_sample = sample_id,
            available_samples = colnames(corrected)
        ))
    }

    cohort_cols <- setdiff(colnames(corrected), resolved_sample)
    if (length(cohort_cols) < 5) {
        return(list(
            error = "Need at least 5 cohort samples besides the target sample for dysregulation.",
            cohort_size = length(cohort_cols)
        ))
    }

    corrected_mat <- as.matrix(corrected)
    storage.mode(corrected_mat) <- "double"
    target_expr <- corrected_mat[, resolved_sample]
    cohort_mat <- corrected_mat[, cohort_cols, drop = FALSE]

    cohort_mean <- rowMeans(cohort_mat, na.rm = TRUE)
    cohort_median <- apply(cohort_mat, 1, median, na.rm = TRUE)
    cohort_mad <- apply(cohort_mat, 1, mad, na.rm = TRUE)

    delta <- target_expr - cohort_mean
    robust_z <- rep(NA_real_, length(target_expr))
    valid_mad <- is.finite(cohort_mad) & cohort_mad > 1e-6
    robust_z[valid_mad] <- (target_expr[valid_mad] - cohort_median[valid_mad]) / cohort_mad[valid_mad]

    percentile_rank <- rowMeans(sweep(cohort_mat, 1, target_expr, "<="), na.rm = TRUE)

    result <- data.frame(
        gene_id = rownames(corrected_mat),
        target_expr = as.numeric(target_expr),
        cohort_mean = as.numeric(cohort_mean),
        delta = as.numeric(delta),
        robust_z = as.numeric(robust_z),
        percentile_rank = as.numeric(percentile_rank),
        stringsAsFactors = FALSE
    )

    result <- result[is.finite(result$target_expr) & is.finite(result$cohort_mean), , drop = FALSE]

    up <- result[
        result$delta >= min_abs_delta &
            (result$robust_z >= min_abs_z | result$percentile_rank >= up_percentile),
        ,
        drop = FALSE
    ]
    down <- result[
        result$delta <= (-min_abs_delta) &
            (result$robust_z <= (-min_abs_z) | result$percentile_rank <= down_percentile),
        ,
        drop = FALSE
    ]

    if (nrow(up) > 0) {
        up <- up[order(-up$robust_z, -up$delta, -up$percentile_rank, up$gene_id), , drop = FALSE]
    }
    if (nrow(down) > 0) {
        down <- down[order(down$robust_z, down$delta, down$percentile_rank, down$gene_id), , drop = FALSE]
    }

    list(
        sample_requested = sample_id,
        sample_resolved = resolved_sample,
        warning = resolved$warning,
        cohort_size = length(cohort_cols),
        genes_tested = nrow(result),
        thresholds = list(
            top_n = top_n,
            min_abs_delta = min_abs_delta,
            min_abs_z = min_abs_z,
            up_percentile = up_percentile,
            down_percentile = down_percentile
        ),
        summary = list(
            up_count = nrow(up),
            down_count = nrow(down),
            extreme_abs_z_count = sum(abs(result$robust_z) >= min_abs_z, na.rm = TRUE)
        ),
        top_up = head(up, top_n),
        top_down = head(down, top_n)
    )
}



#* @get /sample-gsea
#* @serializer json
function(req) {
    cache_dir <- req$args$cachedir
    sample_id <- as.character(req$args$sample %||% req$args$sampleId %||% "")
    collection <- as.character(req$args$collection %||% "hallmark")
    min_size <- suppressWarnings(as.integer(req$args$min_size %||% 15))
    max_size <- suppressWarnings(as.integer(req$args$max_size %||% 500))
    top_n <- suppressWarnings(as.integer(req$args$top_n %||% 30))

    if (!nzchar(sample_id)) {
        return(list(error = "sample parameter is required"))
    }
    if (!is.finite(min_size) || min_size < 5) min_size <- 15
    if (!is.finite(max_size) || max_size < min_size) max_size <- 500
    if (!is.finite(top_n) || top_n < 1) top_n <- 30
    top_n <- min(top_n, 200L)

    if (!requireNamespace("fgsea", quietly = TRUE) || !requireNamespace("msigdbr", quietly = TRUE)) {
        return(list(
            error = "GSEA dependencies are missing in this R environment.",
            missing = c(
                if (!requireNamespace("fgsea", quietly = TRUE)) "fgsea" else NULL,
                if (!requireNamespace("msigdbr", quietly = TRUE)) "msigdbr" else NULL
            ),
            install_hint = "Install with: BiocManager::install('fgsea'); install.packages('msigdbr')"
        ))
    }

    corrected <- tryCatch(
        get_corrected_data(cache_dir),
        error = function(e) NULL
    )
    if (is.null(corrected) || ncol(corrected) < 2) {
        return(list(error = "Harmonized data not found. Run harmonization before GSEA."))
    }

    resolved <- resolve_harmonized_sample_column(corrected, sample_id)
    resolved_sample <- resolved$resolved_sample_column
    if (!(resolved_sample %in% colnames(corrected))) {
        return(list(
            error = "Requested sample not found in harmonized data",
            requested_sample = sample_id,
            available_samples = colnames(corrected)
        ))
    }

    rank_obj <- tryCatch(
        build_sample_rank_stats(corrected, resolved_sample),
        error = function(e) list(error = e$message)
    )
    if (!is.null(rank_obj$error)) {
        return(list(error = rank_obj$error))
    }

    pathways <- tryCatch(
        build_msig_pathways(collection),
        error = function(e) list(error = e$message)
    )
    if (is.list(pathways) && !is.null(pathways$error)) {
        return(list(error = pathways$error))
    }

    gsea <- tryCatch(
        fgsea::fgseaMultilevel(
            pathways = pathways,
            stats = rank_obj$stats,
            minSize = min_size,
            maxSize = max_size
        ),
        error = function(e) list(error = e$message)
    )
    if (is.list(gsea) && !is.data.frame(gsea) && !is.null(gsea$error)) {
        return(list(error = paste("fgsea failed:", gsea$error)))
    }

    if (nrow(gsea) == 0) {
        return(list(
            sample_requested = sample_id,
            sample_resolved = resolved_sample,
            warning = resolved$warning,
            collection = tolower(collection),
            cohort_size = rank_obj$cohort_size,
            genes_ranked = rank_obj$genes_ranked,
            pathways_tested = 0,
            pathways = data.frame()
        ))
    }

    gsea <- as.data.frame(gsea)
    gsea <- gsea[order(gsea$padj, -abs(gsea$NES), gsea$pathway), , drop = FALSE]
    if ("leadingEdge" %in% colnames(gsea)) {
        gsea$leading_edge <- vapply(
            gsea$leadingEdge,
            function(x) paste(as.character(x), collapse = ","),
            character(1)
        )
    } else {
        gsea$leading_edge <- ""
    }

    gsea_out <- gsea[, c("pathway", "NES", "pval", "padj", "size", "leading_edge"), drop = FALSE]

    list(
        sample_requested = sample_id,
        sample_resolved = resolved_sample,
        warning = resolved$warning,
        collection = tolower(collection),
        cohort_size = rank_obj$cohort_size,
        genes_ranked = rank_obj$genes_ranked,
        pathways_tested = nrow(gsea_out),
        pathways = head(gsea_out, top_n)
    )
}
