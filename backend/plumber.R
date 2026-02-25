library(fst)
library(data.table)
source("data_registry.R")
source("tools_registry.R")
source("metadata_alignment_registry.R")

normalize_arg_vector <- function(x) {
    if (is.null(x)) return(NULL)
    if (is.list(x)) return(unlist(x, use.names = FALSE))
    return(as.character(x))
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

        if (ncol(df) < 4) {
            stop("ReadsPerGene.out.tab files must have at least 4 columns.")
        }

        colnames(df)[1:4] <- c("gene", "unstranded", "strand_fwd", "strand_rev")
        df <- df[!startsWith(df$gene, "N_"), c("gene", "unstranded")]

        sample_name <- sub("\\.ReadsPerGene\\.out\\.tab$", "", sample_names[i], ignore.case = TRUE)
        colnames(df)[2] <- sample_name
        return(df)
    })

    count_matrix <- Reduce(function(x, y) merge(x, y, by = "gene", all = FALSE), dfs)
    return(count_matrix)
}

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

                is_readspergene <- all(grepl("ReadsPerGene\\.out\\.tab$", base_names, ignore.case = TRUE))
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
                    return(list(error = "Please upload a single CSV or one or more ReadsPerGene.out.tab files."))
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


remove_low_expressed_genes <- function(data, threshold = 100) {
    # 100 mRNA threshold
    data <- data[rowSums(data) >= threshold, , drop = FALSE]
    return(data)
}

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

get_request_disease <- function(req, default = "aml") {
    selected <- get_request_disease_selection(req, default = default)
    key <- disease_selection_key(selected)
    if (identical(key, "pan_leukemia")) return("pan_leukemia")
    selected[[1]]
}

normalize_disease_selection <- function(x, default = "aml") {
    vals <- normalize_arg_vector(x)
    if (is.null(vals) || length(vals) == 0) {
        vals <- default
    }
    vals <- unlist(lapply(vals, function(v) strsplit(as.character(v), ",", fixed = TRUE)[[1]]), use.names = FALSE)
    vals <- trimws(vals)
    vals <- vals[nzchar(vals)]
    if (length(vals) == 0) {
        vals <- default
    }

    vals <- unique(vapply(vals, normalize_disease_id, FUN.VALUE = character(1)))

    if ("pan_leukemia" %in% vals) {
        return(c("aml", "ball", "tall"))
    }

    vals <- vals[vals %in% c("aml", "ball", "tall")]
    if (length(vals) == 0) {
        return(c("aml"))
    }

    preferred_order <- c("aml", "ball", "tall")
    vals[order(match(vals, preferred_order))]
}

disease_selection_key <- function(diseases) {
    vals <- normalize_disease_selection(diseases)
    if (length(vals) == 3 && all(c("aml", "ball", "tall") %in% vals)) {
        return("pan_leukemia")
    }
    paste(vals, collapse = "+")
}

get_request_disease_selection <- function(req, default = "aml") {
    if (!is.null(req$args$diseases)) {
        return(normalize_disease_selection(req$args$diseases, default = default))
    }
    if (!is.null(req$args$disease)) {
        return(normalize_disease_selection(req$args$disease, default = default))
    }
    normalize_disease_selection(default, default = default)
}

coalesce_metadata_columns <- function(df, candidates, fallback = NA_character_) {
    if (nrow(df) == 0) return(rep(fallback, 0))
    out <- rep(NA_character_, nrow(df))
    for (col in candidates) {
        if (!col %in% colnames(df)) next
        vals <- as.character(df[[col]])
        vals[is.na(vals)] <- NA_character_
        vals[trimws(vals) == ""] <- NA_character_
        replace_idx <- is.na(out) & !is.na(vals)
        out[replace_idx] <- vals[replace_idx]
    }
    out[is.na(out)] <- fallback
    out
}

coalesce_metadata_with_source <- function(df, candidates, fallback = NA_character_) {
    if (nrow(df) == 0) {
        return(list(
            value = rep(fallback, 0),
            source = rep(NA_character_, 0)
        ))
    }

    out <- rep(NA_character_, nrow(df))
    src <- rep(NA_character_, nrow(df))
    for (col in candidates) {
        if (!col %in% colnames(df)) next
        vals <- as.character(df[[col]])
        vals[is.na(vals)] <- NA_character_
        vals[trimws(vals) == ""] <- NA_character_
        replace_idx <- is.na(out) & !is.na(vals)
        out[replace_idx] <- vals[replace_idx]
        src[replace_idx] <- col
    }

    out[is.na(out)] <- fallback
    return(list(value = out, source = src))
}

normalize_metadata_na <- function(x) {
    vals <- as.character(x)
    vals[is.na(vals)] <- NA_character_
    vals <- trimws(vals)
    vals[vals == ""] <- NA_character_
    vals[toupper(vals) %in% c("NA", "N/A", "NONE", "NULL", "UNKNOWN", "NAN")] <- NA_character_
    vals
}

normalize_metadata_sex <- function(x) {
    vals <- normalize_metadata_na(x)

    key <- toupper(vals)
    vals[key %in% c("M", "MALE")] <- "Male"
    vals[key %in% c("F", "FEMALE")] <- "Female"
    vals[is.na(vals)] <- "unknown"
    vals
}

normalize_metadata_study <- function(x, disease = "aml") {
    vals <- normalize_metadata_na(x)
    vals <- gsub("[[:space:]]+", "_", vals)
    vals[is.na(vals)] <- sprintf("%s_reference", toupper(normalize_disease_id(disease)))
    vals
}

normalize_metadata_tissue <- function(x) {
    vals <- normalize_metadata_na(x)
    key <- tolower(vals)
    vals[key %in% c("bm", "bone marrow", "bone_marrow")] <- "bone marrow"
    vals[key %in% c("pb", "peripheral blood", "peripheral_blood")] <- "peripheral blood"
    vals[key %in% c("blood")] <- "peripheral blood"
    vals[is.na(vals)] <- "unknown"
    vals
}

normalize_metadata_prim_rec <- function(x) {
    vals <- normalize_metadata_na(x)
    key <- tolower(vals)
    vals[key %in% c("primary", "diagnosis", "dx")] <- "Primary"
    vals[key %in% c("relapse", "recurrent")] <- "Relapse"
    vals[key %in% c("refractory")] <- "Refractory"
    vals[is.na(vals)] <- "unknown"
    vals
}

normalize_metadata_event <- function(x) {
    vals <- normalize_metadata_na(x)
    key <- tolower(vals)
    vals[key %in% c("dead", "deceased", "1")] <- "Dead"
    vals[key %in% c("alive", "living", "0")] <- "Alive"
    vals[is.na(vals)] <- "unknown"
    vals
}

normalize_metadata_subtype <- function(x, disease = "aml") {
    vals <- normalize_metadata_na(x)
    if (all(is.na(vals))) {
        return(rep("unknown", length(vals)))
    }
    vals <- gsub("[[:space:]]+", " ", vals)
    vals <- trimws(vals)
    # Preserve labels as much as possible; only normalize obvious missing markers.
    vals[is.na(vals)] <- "unknown"
    vals
}

derive_metadata_lineage <- function(disease, btall_label = NULL, subtype = NULL) {
    disease_key <- normalize_disease_id(disease)
    n <- length(subtype)
    lineage <- rep(NA_character_, n)
    if (identical(disease_key, "aml")) {
        lineage[] <- "AML"
    } else {
        btall <- normalize_metadata_na(btall_label)
        btall_key <- toupper(btall)
        lineage[btall_key == "B-ALL"] <- "B-ALL"
        lineage[btall_key == "T-ALL"] <- "T-ALL"
        if (identical(disease_key, "ball")) lineage[is.na(lineage)] <- "B-ALL"
        if (identical(disease_key, "tall")) lineage[is.na(lineage)] <- "T-ALL"
    }
    lineage[is.na(lineage)] <- "unknown"
    lineage
}

build_metadata_sample_id_aliases <- function(df, disease = "aml") {
    if (nrow(df) == 0) return(rep("", 0))
    alias_cols <- unique(c("sample_id", metadata_registry_sample_id_alias_candidates(disease)))
    alias_cols <- alias_cols[alias_cols %in% colnames(df)]
    if (length(alias_cols) == 0) return(rep("", nrow(df)))

    alias_matrix <- lapply(alias_cols, function(col) normalize_metadata_na(df[[col]]))
    names(alias_matrix) <- alias_cols

    vapply(seq_len(nrow(df)), function(i) {
        vals <- unique(unlist(lapply(alias_matrix, function(v) v[[i]]), use.names = FALSE))
        vals <- vals[!is.na(vals)]
        paste(vals, collapse = "|")
    }, FUN.VALUE = character(1))
}

match_metadata_to_reference_columns <- function(metadata, count_colnames, disease = "aml") {
    if (length(count_colnames) == 0) {
        return(list(index = integer(0), source = character(0)))
    }

    match_idx <- rep(NA_integer_, length(count_colnames))
    match_source <- rep(NA_character_, length(count_colnames))
    selected_diseases <- normalize_disease_selection(disease)
    alias_cols <- unique(unlist(
        lapply(selected_diseases, function(d) metadata_registry_sample_id_alias_candidates(d)),
        use.names = FALSE
    ))
    candidate_cols <- unique(c("sample_id", alias_cols))
    candidate_cols <- candidate_cols[candidate_cols %in% colnames(metadata)]

    for (col in candidate_cols) {
        vals <- normalize_metadata_na(metadata[[col]])
        remaining <- which(is.na(match_idx))
        if (length(remaining) == 0) break
        local_match <- match(count_colnames[remaining], vals)
        hit <- !is.na(local_match)
        if (any(hit)) {
            hit_idx <- remaining[hit]
            match_idx[hit_idx] <- local_match[hit]
            match_source[hit_idx] <- col
        }
    }

    list(index = match_idx, source = match_source)
}

align_metadata <- function(metadata, disease = "aml") {
    if (is.null(metadata)) return(metadata)
    metadata <- as.data.frame(metadata, stringsAsFactors = FALSE)
    disease_key <- normalize_disease_id(disease)

    sample_id <- coalesce_metadata_with_source(
        metadata,
        metadata_registry_field_candidates("sample_id", disease_key)
    )
    sex <- coalesce_metadata_with_source(metadata, metadata_registry_field_candidates("sex", disease_key), fallback = NA_character_)
    study_source <- coalesce_metadata_with_source(
        metadata,
        metadata_registry_field_candidates("study_source", disease_key),
        fallback = NA_character_
    )
    study_collection <- coalesce_metadata_with_source(
        metadata,
        metadata_registry_field_candidates("study_collection", disease_key),
        fallback = NA_character_
    )
    study_title <- coalesce_metadata_with_source(
        metadata,
        metadata_registry_field_candidates("study_title", disease_key),
        fallback = NA_character_
    )
    subtype <- coalesce_metadata_with_source(
        metadata,
        metadata_registry_field_candidates("subtype_label", disease_key),
        fallback = NA_character_
    )
    tissue <- coalesce_metadata_with_source(metadata, metadata_registry_field_candidates("tissue", disease_key), fallback = NA_character_)
    prim_rec <- coalesce_metadata_with_source(metadata, metadata_registry_field_candidates("prim_rec", disease_key), fallback = NA_character_)
    event <- coalesce_metadata_with_source(metadata, metadata_registry_field_candidates("event", disease_key), fallback = NA_character_)

    metadata$disease <- disease_key
    metadata$sample_id <- sample_id$value
    metadata$sample_id_source <- sample_id$source
    metadata$sample_id_aliases <- build_metadata_sample_id_aliases(metadata, disease = disease_key)
    metadata$sex <- normalize_metadata_sex(sex$value)
    metadata$sex_source <- sex$source
    metadata$study_source <- normalize_metadata_study(study_source$value, disease = metadata$disease[1])
    metadata$study_source_source <- study_source$source
    metadata$study_collection <- normalize_metadata_na(study_collection$value)
    metadata$study_collection_source <- study_collection$source
    metadata$study_title <- normalize_metadata_na(study_title$value)
    metadata$study_title_source <- study_title$source
    metadata$study <- metadata$study_source
    metadata$subtype_label <- normalize_metadata_subtype(subtype$value, disease = metadata$disease[1])
    metadata$subtype_label_source <- subtype$source
    metadata$clusters <- metadata$subtype_label
    metadata$tissue <- normalize_metadata_tissue(tissue$value)
    metadata$tissue_source <- tissue$source
    metadata$prim_rec <- normalize_metadata_prim_rec(prim_rec$value)
    metadata$prim_rec_source <- prim_rec$source
    metadata$event <- normalize_metadata_event(event$value)
    metadata$event_source <- event$source

    metadata$study_collection[is.na(metadata$study_collection)] <- metadata$study_source[is.na(metadata$study_collection)]
    metadata$lineage <- derive_metadata_lineage(
        disease = metadata$disease[1],
        btall_label = if ("btall_label" %in% colnames(metadata)) metadata$btall_label else NULL,
        subtype = metadata$subtype_label
    )

    if ("age" %in% colnames(metadata)) suppressWarnings(metadata$age <- as.numeric(metadata$age))
    if ("blasts" %in% colnames(metadata)) suppressWarnings(metadata$blasts <- as.numeric(metadata$blasts))

    metadata$sample_id[trimws(metadata$sample_id) == ""] <- NA_character_
    metadata <- metadata[!is.na(metadata$sample_id), , drop = FALSE]

    if (anyDuplicated(metadata$sample_id)) {
        dup_count <- sum(duplicated(metadata$sample_id))
        message(sprintf("Metadata alignment: dropping %d duplicate rows by sample_id for disease=%s", dup_count, metadata$disease[1]))
        metadata <- metadata[!duplicated(metadata$sample_id), , drop = FALSE]
    }

    metadata$meta_alignment_version <- "v2"
    metadata$meta_missing_core_study <- metadata$study %in% c(NA_character_, "unknown")
    metadata$meta_missing_core_sex <- metadata$sex %in% c(NA_character_, "unknown")
    metadata$meta_missing_core_subtype <- metadata$subtype_label %in% c(NA_character_, "unknown")
    metadata$meta_core_missing_count <- 
        as.integer(metadata$meta_missing_core_study) +
        as.integer(metadata$meta_missing_core_sex) +
        as.integer(metadata$meta_missing_core_subtype)

    metadata$meta_registry_version <- metadata_registry_get("version")

    return(metadata)
}

load_metadata <- function(disease = "aml", aligned = TRUE) {
    diseases <- normalize_disease_selection(disease)
    if (length(diseases) > 1) {
        metadata <- as.data.frame(
            data.table::rbindlist(
                lapply(diseases, function(d) load_metadata(d, aligned = aligned)),
                fill = TRUE,
                use.names = TRUE
            ),
            stringsAsFactors = FALSE
        )
        return(metadata)
    }
    disease_id <- diseases[[1]]

    metadata_path <- require_existing_path(
        resolve_disease_asset(disease_id, "metadata"),
        sprintf("%s metadata", disease_id)
    )
    metadata <- fread(metadata_path, data.table = F)
    if (isTRUE(aligned)) {
        metadata <- align_metadata(metadata, disease = disease_id)
    }
    return(metadata)
}

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

    # remove gene names with __no_feature or __ambiguous
    sample_data <- sample_data[!grepl("__no_feature|__ambiguous", sample_data[, 1]), ]

    # remove the row if it is incomplete
    sample_data <- sample_data[complete.cases(sample_data), ]
    result <- seAMLess(sample_data)
    return(list(message = paste("Deconvolution complete. Samples:", nrow(result$Deconvolution)), deconvolution = data.frame(result$Deconvolution)))
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


get_gene_ids <- function(cache_dir) {
    return(read_fst(file.path(cache_dir, "gene_ids.fst")))
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

find_bridge_python <- function() {
    env_python <- Sys.getenv("BRIDGE_PYTHON", unset = "")
    candidates <- c(
        env_python,
        "/Users/onur-lumc/.local/share/mamba/envs/aml_bridge_m1/bin/python",
        Sys.which("python3"),
        Sys.which("python")
    )
    candidates <- unique(candidates[nzchar(candidates)])

    for (candidate in candidates) {
        if (file.exists(candidate)) {
            return(candidate)
        }
    }

    return(NULL)
}

find_molecular_tools_python <- function() {
    env_python <- Sys.getenv("MOLECULAR_TOOLS_PYTHON", unset = "")
    bridge_python <- Sys.getenv("BRIDGE_PYTHON", unset = "")
    candidates <- c(
        env_python,
        "/Users/onur-lumc/.local/share/mamba/envs/molecular_diag_py310/bin/python",
        bridge_python,
        Sys.which("python3"),
        Sys.which("python")
    )
    candidates <- unique(candidates[nzchar(candidates)])

    for (candidate in candidates) {
        if (file.exists(candidate)) {
            return(candidate)
        }
    }

    return(NULL)
}

resolve_uploaded_sample_column <- function(sample_data, requested_sample_id) {
    sample_id <- as.character(requested_sample_id)[1]
    available_sample_cols <- colnames(sample_data)[-1]
    warning <- NULL

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

    if (sample_id %in% available_sample_cols && grepl("_(fwd|rev)$", sample_id)) {
        warning <- "Using stranded count column. Prefer *_unstranded unless your pipeline requires stranded counts."
    }

    list(
        requested_sample = requested_sample_id,
        resolved_sample_column = sample_id,
        available_samples = available_sample_cols,
        warning = warning
    )
}

extract_uploaded_sample_counts <- function(sample_data, sample_id) {
    gene_col <- colnames(sample_data)[1]
    out <- data.table(
        gene_id_original = as.character(sample_data[[gene_col]]),
        count = as.numeric(sample_data[[sample_id]])
    )
    out[, gene_id := sub("\\.[0-9]+$", "", gene_id_original)]
    out[is.na(count), count := 0]
    out
}

write_feature_row_csv <- function(feature_counts, sample_id, out_csv, feature_col = "feature") {
    dt <- as.data.table(feature_counts)
    if (!all(c(feature_col, "count") %in% colnames(dt))) {
        stop("feature_counts must contain feature column and count column")
    }

    dt <- dt[!is.na(get(feature_col)) & trimws(as.character(get(feature_col))) != ""]
    if (nrow(dt) == 0) {
        stop("No feature rows available to write")
    }

    dt[, count := as.numeric(count)]
    dt[is.na(count), count := 0]
    dt <- dt[, .(count = sum(count, na.rm = TRUE)), by = feature_col]
    setorderv(dt, feature_col)

    row_df <- as.data.frame(as.list(setNames(dt$count, dt[[feature_col]])), check.names = FALSE)
    row_df <- data.frame(sample_id = sample_id, row_df, check.names = FALSE, stringsAsFactors = FALSE)
    fwrite(row_df, out_csv)
    invisible(out_csv)
}

convert_counts_to_gene_symbols <- function(counts_dt) {
    if (!requireNamespace("seAMLess", quietly = TRUE)) {
        stop("seAMLess is required for Ensembl->symbol conversion")
    }

    mapping <- as.data.table(seAMLess::grch38)
    if (!all(c("ensgene", "symbol") %in% colnames(mapping))) {
        stop("seAMLess::grch38 mapping is missing expected columns (ensgene, symbol)")
    }

    mapping <- mapping[, .(
        gene_id = as.character(ensgene),
        gene_symbol = as.character(symbol)
    )]
    mapping <- unique(mapping[!is.na(gene_id) & !is.na(gene_symbol) & gene_symbol != ""])

    merged <- merge(
        counts_dt[, .(gene_id, count)],
        mapping,
        by = "gene_id",
        all.x = FALSE,
        all.y = FALSE
    )

    symbol_counts <- merged[
        !is.na(gene_symbol) & gene_symbol != "",
        .(count = sum(count, na.rm = TRUE)),
        by = gene_symbol
    ]

    list(
        counts = symbol_counts,
        note = sprintf(
            "Converted Ensembl IDs to gene symbols for %d/%d rows (%d unique symbols).",
            nrow(merged),
            nrow(counts_dt),
            nrow(symbol_counts)
        )
    )
}

run_json_python_script <- function(python_bin, script_path, args, tool_label = "python tool") {
    output <- tryCatch(
        {
            system2(python_bin, c(script_path, args), stdout = TRUE, stderr = TRUE)
        },
        error = function(e) {
            return(structure(character(), status = 1L, error_message = e$message))
        }
    )

    status_code <- attr(output, "status")
    if (!is.null(status_code) && status_code != 0) {
        return(list(
            error = sprintf("%s failed", tool_label),
            status = status_code,
            details = paste(output, collapse = "\n")
        ))
    }

    if (length(output) == 0) {
        return(list(error = sprintf("%s returned no output", tool_label)))
    }

    parsed <- tryCatch(
        {
            jsonlite::fromJSON(
                tail(output, 1),
                simplifyVector = TRUE,
                simplifyDataFrame = FALSE
            )
        },
        error = function(e) {
            list(
                error = sprintf("Failed to parse %s output", tool_label),
                details = e$message,
                raw = paste(output, collapse = "\n")
            )
        }
    )

    if (is.list(parsed)) {
        parsed$stdout_log <- output
    }
    parsed
}

normalized_supported_diseases <- function(x) {
    vals <- normalize_arg_vector(x)
    if (is.null(vals)) return(character(0))
    unique(vapply(vals, normalize_disease_id, FUN.VALUE = character(1)))
}

molecular_tool_runtime_status <- function(tool_id) {
    tool <- get_molecular_tool_definition(tool_id)
    if (is.null(tool)) {
        return(list(
            available = FALSE,
            runtime_ready = FALSE,
            missing = c("tool_registry"),
            details = "Tool not found in molecular registry"
        ))
    }

    if (isFALSE(tool$integrated %||% TRUE)) {
        return(list(
            available = FALSE,
            runtime_ready = FALSE,
            catalog_only = TRUE,
            missing = character(0)
        ))
    }

    key <- as.character(tool$id %||% tool_id)
    missing <- character(0)

    if (identical(key, "bridge")) {
        assets <- resolve_bridge_assets("pan_leukemia")
        bundle_path <- first_existing_path(assets$bundle_candidates)
        meta_path <- first_existing_path(assets$meta_candidates)
        ckpt_path <- first_existing_path(assets$ckpt_candidates)
        lr_path <- first_existing_path(assets$lr_candidates)
        script_path <- "bridge_predict.py"

        if (is.null(bundle_path)) {
            if (is.null(meta_path)) missing <- c(missing, "meta")
            if (is.null(ckpt_path)) missing <- c(missing, "ckpt")
            if (is.null(lr_path)) missing <- c(missing, "classifier")
        }
        if (!file.exists(script_path)) missing <- c(missing, "bridge_predict.py")
        runtime_ready <- !is.null(find_bridge_python())
        if (!runtime_ready) missing <- c(missing, "bridge_python")

        return(list(
            available = length(missing) == 0,
            runtime_ready = runtime_ready,
            missing = unique(missing),
            artifact_source = if (!is.null(bundle_path)) "bundle" else "standalone"
        ))
    }

    if (key %in% c("allsorts", "tallsorts")) {
        assets <- resolve_molecular_tool_assets(key)
        if (identical(key, "allsorts")) {
            if (is.null(assets$model) || !file.exists(assets$model)) missing <- c(missing, "model")
            if (is.null(assets$model_dir) || !dir.exists(assets$model_dir)) missing <- c(missing, "model_dir")
            if (!file.exists("allsorts_predict.py")) missing <- c(missing, "allsorts_predict.py")
        }
        if (identical(key, "tallsorts")) {
            if (is.null(assets$model) || !file.exists(assets$model)) missing <- c(missing, "model")
            if (!file.exists("tallsorts_predict.py")) missing <- c(missing, "tallsorts_predict.py")
        }
        runtime_ready <- !is.null(find_molecular_tools_python())
        if (!runtime_ready) missing <- c(missing, "molecular_tools_python")
        return(list(
            available = length(missing) == 0,
            runtime_ready = runtime_ready,
            missing = unique(missing)
        ))
    }

    if (identical(key, "amlmapr")) {
        assets <- resolve_molecular_tool_assets("amlmapr")
        if (is.null(assets$functions_r) || !file.exists(assets$functions_r)) missing <- c(missing, "functions_r")
        if (is.null(assets$sysdata_rda) || !file.exists(assets$sysdata_rda)) missing <- c(missing, "sysdata_rda")
        if (is.null(assets$example_matrix_rda) || !file.exists(assets$example_matrix_rda)) missing <- c(missing, "example_matrix_rda")
        if (!requireNamespace("caret", quietly = TRUE)) missing <- c(missing, "R:caret")
        if (!requireNamespace("kernlab", quietly = TRUE)) missing <- c(missing, "R:kernlab")
        return(list(
            available = length(missing) == 0,
            runtime_ready = length(missing) == 0,
            missing = unique(missing)
        ))
    }

    if (identical(key, "allcatchr")) {
        if (!requireNamespace("ALLCatchRbcrabl1", quietly = TRUE)) missing <- c(missing, "R:ALLCatchRbcrabl1")
        deps <- c("caret", "singscore", "LiblineaR", "kknn", "randomForest", "ranger", "glmnet")
        for (pkg in deps) {
            if (!requireNamespace(pkg, quietly = TRUE)) missing <- c(missing, paste0("R:", pkg))
        }
        return(list(
            available = length(missing) == 0,
            runtime_ready = length(missing) == 0,
            missing = unique(missing)
        ))
    }

    list(
        available = FALSE,
        runtime_ready = FALSE,
        missing = c("unsupported_runtime_status")
    )
}

molecular_tools_catalog <- function(disease = "aml") {
    disease_key <- normalize_disease_id(disease)
    registry <- get_molecular_tool_registry()
    lapply(names(registry), function(tool_id) {
        tool <- registry[[tool_id]]
        runtime <- molecular_tool_runtime_status(tool_id)
        supported_diseases <- normalized_supported_diseases(tool$supported_diseases)

        list(
            id = tool$id %||% tool_id,
            label = tool$label %||% tool_id,
            short_label = tool$short_label %||% tool$label %||% tool_id,
            family = tool$family %||% "molecular_diagnostic",
            integrated = isTRUE(tool$integrated %||% TRUE),
            endpoint = tool$endpoint %||% NA_character_,
            disease_scope = normalize_disease_id(tool$disease_scope %||% disease_key),
            supported_diseases = supported_diseases,
            applicable_for_request = disease_key %in% supported_diseases,
            input_modality = tool$input_modality %||% NA_character_,
            gene_identifier = tool$gene_identifier %||% NA_character_,
            output_kind = tool$output_kind %||% NA_character_,
            confidence_semantics = tool$confidence_semantics %||% NA_character_,
            repo_url = tool$repo_url %||% NULL,
            docs_url = tool$docs_url %||% NULL,
            notes = tool$notes %||% NULL,
            availability = runtime
        )
    })
}

dispatch_molecular_prediction <- function(req) {
    tool_id <- tolower(trimws(as.character(req$args$tool %||% "")[1]))
    if (!nzchar(tool_id)) {
        return(list(error = "tool parameter is required"))
    }

    handlers <- list(
        bridge = bridge_predict,
        amlmapr = amlmapr_predict,
        allcatchr = allcatchr_predict,
        allsorts = allsorts_predict,
        tallsorts = tallsorts_predict
    )
    handler <- handlers[[tool_id]]
    if (is.null(handler) || !is.function(handler)) {
        return(list(
            error = sprintf("Unsupported molecular tool: %s", tool_id),
            supported_tools = names(handlers)
        ))
    }

    out <- handler(req)
    if (is.list(out)) {
        out$tool <- tool_id
    }
    out
}

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
            # Get the OpenAI API key from system environment
            api_key <- Sys.getenv("OPENAI_API_KEY")
            if (api_key == "") {
                # Try to get it directly from system
                api_key <- system("echo $OPENAI_API_KEY", intern = TRUE)
                if (length(api_key) == 0 || api_key == "") {
                    return(list(error = "OpenAI API key not found in environment variables"))
                }
                # Set it in R's environment for future use
                Sys.setenv(OPENAI_API_KEY = api_key)
            }

            message(Sys.getenv("OPENAI_API_KEY"))

            patient_info <- req$args$patientInfo
            model <- req$args$model

            message(paste("Patient info:", patient_info))
            message(paste("Selected model:", model))

            if (is.null(patient_info) || patient_info == "") {
                return(list(error = "Patient information is required"))
            }

            if (is.null(model) || model == "") {
                model <- "gpt-4o-mini" # Default model if not specified
            }

            # Prepare the API request
            url <- "https://api.openai.com/v1/chat/completions"
            headers <- c(
                "Content-Type" = "application/json",
                "Authorization" = paste("Bearer", api_key)
            )
            body <- list(
                model = model, # Use the selected or default model
                messages = list(
                    list(role = "system", content = "Make coherent paragraphs. Use markdown to format the response."),
                    list(role = "user", content = paste(patient_info, "."))
                )
            )

            # Make the API request
            response <- POST(
                url,
                add_headers(.headers = headers),
                body = toJSON(body, auto_unbox = TRUE),
                encode = "json"
            )

            # Check if the request was successful
            if (http_status(response)$category == "Success") {
                content <- content(response, "parsed")
                summary <- content$choices[[1]]$message$content
                return(list(summary = summary))
            } else {
                return(list(error = paste("API request failed with status:", http_status(response)$message)))
            }
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
    return(colnames(read_fst(file.path(cache_dir, "sample_data.fst"))))
}

#* @get /harmonized-data-names
#* @serializer json
harmonized_data_names <- function(req) {
    cache_dir <- req$args$cachedir
    return(colnames(read_fst(file.path(cache_dir, "harmonized_data.fst"))))
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
