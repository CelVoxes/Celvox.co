library(fst)
library(data.table)

#* @post /load-sample-data
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
                print(str(req$body$file))
                # Check if file was uploaded
                if (is.null(req$body)) {
                    message("No multipart form data found in the request body.")
                    return(list(error = "No file data received"))
                }

                # Extract the file content from the multipart form data
                file_content <- req$body$file$parsed

                if (is.null(file_content)) {
                    message("File content is NULL")
                    return(list(error = "File content is empty or could not be read"))
                }
                # Create a temporary file to store the content
                temp_file <- tempfile(fileext = ".csv")
                writeLines(file_content, temp_file)

                message(paste("Temporary file created:", temp_file))

                # Check if the file exists and has content
                if (!file.exists(temp_file) || file.size(temp_file) == 0) {
                    message("Temporary file does not exist or is empty.")
                    return(list(error = "Failed to receive file or file is empty"))
                }

                # Read the fst file
                tryCatch(
                    {
                        sample_data <- fread(temp_file, data.table = FALSE)
                    },
                    error = function(e) {
                        message("Error reading CSV: ", e$message)
                        return(list(error = paste("Error reading the file:", e$message)))
                    }
                )

                print(head(sample_data))

                if (!dir.exists("cache")) {
                    dir.create("cache", recursive = TRUE)
                }

                # Save the sample data to cache
                message("Saving sample data to cache...")
                if (!dir.exists("cache")) {
                    dir.create("cache", recursive = TRUE)
                    message("Created 'cache' directory.")
                }
                write_fst(sample_data, "cache/sample_data.fst")

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
    function() {
        corrected <- read_fst("cache/normalized_and_corrected_matrix.fst")
        rownames(corrected) <- corrected[, 1]
        corrected <- corrected[, -1, drop = FALSE]



        return(corrected)
    }
})


remove_low_expressed_genes <- function(data, threshold = 100) {
    # 100 mRNA threshold
    data <- data[rowSums(data) >= threshold, -1, drop = FALSE]
    return(data)
}

#* @get /harmonize-data
#* @serializer json
harmonize_data <- local({
    function() {
        library(sva)

        uncorrected <- fread("data/counts/uncorrected_counts.csv", data.table = F)
        sample_data <- read_fst("cache/sample_data.fst")
        metadata <- fread("data/meta.csv", data.table = F)

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
                return(NULL) # or handle this case as appropriate for your workflow
            }

            if (is_ensembl(gene_ids)) {
                message("Converting Ensembl IDs to gene symbols...")
                stripped_gene_ids <- strip_ensembl_version(gene_ids)
                new_gene_ids <- seAMLess::grch38$symbol[match(stripped_gene_ids, seAMLess::grch38$ensgene)]

                # Replace NA values with original IDs
                new_gene_ids[is.na(new_gene_ids)] <- gene_ids[is.na(new_gene_ids)]

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

                # Check for NA values in gene_vars
                na_count <- sum(is.na(gene_vars))
                if (na_count > 0) {
                    message(paste("Warning:", na_count, "out of", length(gene_vars), "gene variances are NA"))
                }

                # Create a data frame with new IDs and variances
                id_var_df <- data.frame(new_gene_ids = new_gene_ids, gene_ids = gene_ids, variance = gene_vars)


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
            }
            return(data)
        }

        # Apply conversion to uncorrected and sample_data
        uncorrected <- convert_to_symbols(uncorrected)
        sample_data <- convert_to_symbols(sample_data)

        # remove low expressed genes
        message("Removing genes with less than total 100 mRNA for all samples...")
        sample_data <- remove_low_expressed_genes(sample_data, threshold = 100)


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
        uncorrected <- cbind(uncorrected[common_genes, ], sample_data[common_genes, ])

        message("Creating batch vector...")
        batch <- c(paste0(metadata$study, metadata$gender), rep("sample_data", (ncol(sample_data))))
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
        }


        message("Converting corrected_matrix to data.frame...")
        corrected_matrix <- as.data.frame(corrected_matrix)

        # add rownames to the first column
        corrected_matrix <- cbind(rownames(corrected_matrix), corrected_matrix)
        colnames(corrected_matrix)[1] <- "gene_id"

        message("Returning normalized and corrected data...")
        start_time <- Sys.time()
        write_fst(corrected_matrix, "cache/normalized_and_corrected_matrix.fst")
        write_fst(corrected_matrix[, "gene_id", drop = FALSE], "cache/gene_ids.fst")
        end_time <- Sys.time()
        message("Time taken to write fst: ", difftime(end_time, start_time, units = "secs"))

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

        return(list(message = "Normalized and corrected data saved to cache"))
    }
})


# this function runs t-SNE and saves the results to cache
# TO DO: There should be two modes: discovery and diagnosis
run_tsne <- function() {
    library(Rtsne)
    if (file.exists("cache/tsne_result.fst")) {
        message("Loaded t-SNE results from cache...")

        tsne_df <- read_fst("cache/tsne_result.fst")
        rownames(tsne_df) <- tsne_df[, 1]
        tsne_df <- tsne_df[, -1, drop = FALSE]
    } else {
        message("Reading corrected counts file...")
        # read the corrected counts file
        corrected <- read_fst("cache/normalized_and_corrected_matrix.fst")

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
        write_fst(tsne_df, "cache/tsne_result.fst")

        # Cleanup
        rm(corrected_2000, corrected)
        gc()
    }
    return(tsne_df)
}

load_metadata <- function() {
    metadata <- fread("data/meta.csv", data.table = F)
    return(metadata)
}

#* @get /tsne
#* @serializer json
tsne <- local({
    function() {
        tsne_result <- run_tsne()
        metadata <- load_metadata()

        # Identify which rows in tsne_result correspond to the original data
        original_samples <- intersect(rownames(tsne_result), metadata$sample_id)

        # Create a new data frame for the result
        result <- data.frame(
            sample_id = rownames(tsne_result),
            X1 = tsne_result$X1,
            X2 = tsne_result$X2,
            data_source = ifelse(rownames(tsne_result) %in% original_samples, "original", "uploaded")
        )


        # Merge metadata only for the original samples
        result <- merge(result, metadata, by = "sample_id", all.x = TRUE)

        # returning the result (as long as it is not too big)
        return(result)
    }
})


#* @get /knn
#* @serializer json
function(req) {
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

    corrected <- get_corrected_data()
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
function() {
    # Load the exampleTCGA dataset
    library(seAMLess)
    library(Biobase) # for ExpressionSet
    if (!file.exists("cache/sample_data.fst")) {
        message("Sample data not found. Returning example data.")
        # Load example data from seAMLess package
        data(exampleTCGA)
        result <- seAMLess(exampleTCGA)
        return(list(
            message = "Example data used. Please upload your own data for actual analysis.",
            deconvolution = as.list(result$Deconvolution)
        ))
    }
    sample_data <- read_fst("cache/sample_data.fst")

    # remove gene names with __no_feature or __ambiguous
    sample_data <- sample_data[!grepl("__no_feature|__ambiguous", sample_data[, 1]), ]

    # remove the row if it is incomplete
    sample_data <- sample_data[complete.cases(sample_data), ]
    result <- seAMLess(sample_data)
    return(list(message = paste("Deconvolution complete. Samples:", nrow(result$Deconvolution)), deconvolution = data.frame(result$Deconvolution)))
}



#* @get /drug-response
#* @serializer json
drug_response_tsne <- function() {
    # Load drug response data
    drug_response <- fread("data/drug_response/ex_vivo_drug_response.csv")

    # Load drug families data
    drug_families <- fread("data/drug_response/drug_families.csv")

    # Merge drug response with drug families
    drug_response <- merge(drug_response, drug_families, by.x = "inhibitor", by.y = "drug", all.x = TRUE)

    # Perform t-SNE on the drug response data
    tsne_result <- tsne()

    # Merge t-SNE results with drug response data
    result <- merge(drug_response, tsne_result[, !colnames(tsne_result) %in% "clusters"], by = "sample_id", all.y = TRUE)


    # Convert to list for JSON serialization
    return(as.list(result))
}


# mutation tsne
#* @get /mutation-tsne
#* @serializer json
mutation_tsne <- function() {
    # Load mutation data
    mutation_data <- fread("data/aberrations/mutations.csv")

    # Load t-SNE results
    tsne_result <- run_tsne()
    tsne_result$sample_id <- rownames(tsne_result)
    message("Merging mutation data with t-SNE results...")

    # Merge t-SNE results with mutation data
    result <- merge(mutation_data, tsne_result, by = "sample_id", all.x = TRUE)

    return(result)
}

#* @get /cache-files
#* @serializer json
function() {
    cache_dir <- "cache"
    if (!dir.exists(cache_dir)) {
        return(list(error = "Cache directory does not exist"))
    }

    files <- list.files(cache_dir, full.names = TRUE)
    file_info <- lapply(files, function(file) {
        list(
            name = basename(file),
            size = file.size(file),
            modified = file.info(file)$mtime
        )
    })

    return(file_info)
}

#* @delete /delete-cache-file
#* @serializer json
delete_cache_file <- function(req) {
    file_name <- req$body$fileName
    cache_dir <- "cache"
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


get_gene_ids <- function() {
    return(read_fst("cache/gene_ids.fst"))
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
        gene <- req$args$gene
        tsne_result <- run_tsne()

        message("gene:")
        print(gene)

        message(paste("Fetching gene expression data for:", gene))
        gene_ids <- get_gene_ids()
        if (!gene %in% gene_ids$gene_id) {
            return(list(error = "Gene not found", available_genes = gene_ids$gene_id))
        }
        corrected <- read_fst("cache/normalized_and_corrected_matrix.fst")
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

#* @get /ai-report
#* @serializer json
function(req) {
    library(httr)
    library(jsonlite)

    tryCatch(
        {
            patient_info <- req$args$patientInfo
            model <- req$args$model # New parameter for model selection

            message(paste("Patient info:", patient_info))
            message(paste("Selected model:", model))

            if (is.null(patient_info) || patient_info == "") {
                return(list(error = "Patient information is required"))
            }

            if (is.null(model) || model == "") {
                model <- "gpt-4o-mini" # Default model if not specified
            }

            # Get the OpenAI API key from environment variable
            api_key <- Sys.getenv("OPENAI_API_KEY")
            if (api_key == "") {
                return(list(error = "OpenAI API key not found in environment variables"))
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
function() {
    # Read the normalized and corrected counts
    sample_data <- read_fst("cache/sample_data.fst")
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
