library(data.table)

#* @post /load-sample-data
#* @serializer json
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

            # Read the CSV file
            tryCatch(
                {
                    sample_data <- fread(temp_file, data.table = FALSE)
                },
                error = function(e) {
                    message("Error reading CSV: ", e$message)
                    return(list(error = paste("Error reading the file:", e$message)))
                }
            )

            # Process the data
            rownames(sample_data) <- sample_data[[1]]
            sample_data <- sample_data[, -1, drop = FALSE]

            # Save the sample data to cache
            message("Saving sample data to cache...")
            if (!dir.exists("cache")) {
                dir.create("cache", recursive = TRUE)
                message("Created 'cache' directory.")
            }
            saveRDS(sample_data, "cache/sample_data.rds")

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

get_corrected_data <- function() {
    corrected <- readRDS("cache/normalized_and_corrected_matrix.rds")
    return(corrected)
}

#* @get /harmonize-data
#* @serializer json
harmonize_data <- function() {
    library(sva)

    uncorrected <- fread("data/counts/uncorrected_counts.csv", data.table = F)
    sample_data <- readRDS("cache/sample_data.rds")
    metadata <- fread("data/meta.csv", data.table = F)

    is_ensembl <- function(ids) {
        ensembl_count <- sum(grepl("^ENSG", ids))
        ensembl_percentage <- ensembl_count / length(ids) * 100
        message(paste0("Ensembl ID percentage: ", ensembl_percentage))
        return(ensembl_percentage > 95)
    }

    # Function to strip version numbers from Ensembl IDs
    strip_version <- function(ids) {
        gsub("\\.[0-9]+$", "", ids)
    }

    # Convert Ensembl IDs to gene symbols using seAMLess::grch38
    convert_to_symbols <- function(data) {
        # Check if gene IDs are in the first column or rownames
        if (is.null(rownames(data)) || all(rownames(data) == seq_len(nrow(data)))) {
            message("Gene IDs are in the first column")
            gene_ids <- data[, 1]
            id_in_column <- TRUE
        } else {
            message("Gene IDs are in rownames")
            gene_ids <- rownames(data)
            id_in_column <- FALSE
        }

        if (is_ensembl(gene_ids)) {
            message("Converting Ensembl IDs to gene symbols...")
            stripped_ids <- strip_version(gene_ids)
            new_ids <- seAMLess::grch38$symbol[match(stripped_ids, seAMLess::grch38$ensgene)]

            # Replace NA values with original IDs
            new_ids[is.na(new_ids)] <- gene_ids[is.na(new_ids)]

            if (id_in_column) {
                data[, 1] <- new_ids
            } else {
                rownames(data) <- new_ids
            }
        }
        return(data)
    }

    # Apply conversion to uncorrected and sample_data
    uncorrected <- convert_to_symbols(uncorrected)
    sample_data <- convert_to_symbols(sample_data)

    # Ensure gene names are consistent between datasets
    get_gene_ids <- function(data) {
        if (is.null(rownames(data)) || all(rownames(data) == seq_len(nrow(data)))) {
            return(data[, 1])
        } else {
            return(rownames(data))
        }
    }

    message("Getting common genes...")
    uncorrected_genes <- get_gene_ids(uncorrected)
    sample_genes <- get_gene_ids(sample_data)
    common_genes <- intersect(uncorrected_genes, sample_genes)
    message(paste0("Number of common genes: ", length(common_genes)))

    # Check for non-unique genes
    message("Checking for non-unique genes...")
    message(paste("Uncorrected data unique genes:", length(unique(uncorrected_genes))))
    message(paste("Uncorrected data total genes:", length(uncorrected_genes)))
    message(paste("Sample data unique genes:", length(unique(sample_genes))))
    message(paste("Sample data total genes:", length(sample_genes)))

    if (length(common_genes) < 10) {
        warning("Less than 10 common genes! Please check the data format.")
        return(NULL)
    }

    if (length(common_genes) < 1000) {
        warning("Less than 1000 common genes! Maybe the data is not in the correct format?")
        return(NULL)
    }

    # Function to calculate variance for each gene
    calc_gene_variance <- function(data) {
        if (is.null(rownames(data)) || all(rownames(data) == seq_len(nrow(data)))) {
            # If genes are in the first column
            gene_vars <- apply(data[, -1], 1, var)
            names(gene_vars) <- data[, 1]
        } else {
            # If genes are in rownames
            gene_vars <- apply(data, 1, var)
        }
        return(gene_vars)
    }

    # Calculate variance for each dataset
    uncorrected_vars <- calc_gene_variance(uncorrected)
    sample_vars <- calc_gene_variance(sample_data)

    # Combine variances
    combined_vars <- uncorrected_vars + sample_vars
    combined_vars <- combined_vars[names(combined_vars) %in% common_genes]

    # Sort genes by combined variance
    sorted_genes <- names(sort(combined_vars, decreasing = TRUE))

    # Subset the data to include only common genes, handling non-unique genes, sorted by variance
    subset_data <- function(data, sorted_genes) {
        if (is.null(rownames(data)) || all(rownames(data) == seq_len(nrow(data)))) {
            # If genes are in the first column
            subset <- data[data[, 1] %in% sorted_genes, ]
            subset <- subset[match(sorted_genes, subset[, 1]), ]
            # Remove duplicates, keeping the first (most variable) occurrence
            subset <- subset[!duplicated(subset[, 1]), ]
            rownames(subset) <- subset[, 1]
            subset <- subset[, -1]
        } else {
            # If genes are in rownames
            subset <- data[rownames(data) %in% sorted_genes, ]
            subset <- subset[match(sorted_genes, rownames(subset)), ]
            # Remove duplicates, keeping the first (most variable) occurrence
            subset <- subset[!duplicated(rownames(subset)), ]
        }
        return(subset)
    }

    message("Subsetting uncorrected data...")
    message(paste("Uncorrected data dimensions:", paste(dim(uncorrected), collapse = "x")))
    uncorrected <- subset_data(uncorrected, sorted_genes)
    message(paste("Uncorrected data dimensions after subsetting:", paste(dim(uncorrected), collapse = "x")))

    message("Subsetting sample data...")
    message(paste("Sample data dimensions:", paste(dim(sample_data), collapse = "x")))
    sample_data <- subset_data(sample_data, sorted_genes)
    message(paste("Sample data dimensions after subsetting:", paste(dim(sample_data), collapse = "x")))

    # Final check
    if (nrow(uncorrected) != nrow(sample_data)) {
        message("Error: Number of rows still don't match after subsetting and removing duplicates.")
        return(NULL)
    }

    message("Combining uncorrected and sample data...")
    # Add "_sample_data" suffix to sample_data column names
    colnames(sample_data) <- paste0(colnames(sample_data), "_sample_data")
    # Combine the data, keeping genes as rownames and samples as columns
    data_to_be_corrected <- cbind(uncorrected, sample_data)

    message("Creating batch vector...")
    batch <- c(paste0(metadata$study, metadata$gender), rep("sample_data", (ncol(sample_data))))
    message(paste("Data to be corrected dimensions:", paste(dim(data_to_be_corrected), collapse = "x")))
    message(paste("Batch dimension:", length(batch)))

    correction.option <- "limma"
    if (correction.option == "combat") {
        message("Correcting data with ComBat...")
        corrected_matrix <- ComBat_seq(as.matrix(data_to_be_corrected), batch = batch, full_mod = F)
        # normalize library sizes
        corrected_matrix <- log2(edgeR::cpm(corrected_matrix) + 1)
    } else if (correction.option == "limma") {
        message("Correcting data with limma...")
        # normalize library sizes
        data_to_be_corrected <- log2(edgeR::cpm(data_to_be_corrected) + 1)
        corrected_matrix <- limma::removeBatchEffect(data_to_be_corrected, batch = batch, )
    }

    message("Returning normalized and corrected data...")
    saveRDS(corrected_matrix, "cache/normalized_and_corrected_matrix.rds")
    return(corrected_matrix)
}


# this function runs t-SNE and saves the results to cache
# TO DO: There should be two modes: discovery and diagnosis
run_tsne <- function() {
    library(Rtsne)
    if (file.exists("cache/tsne_result.rds")) {
        message("Loaded t-SNE results from cache...")

        tsne_df <- readRDS("cache/tsne_result.rds")
    } else {
        message("Reading corrected counts file...")
        # read the corrected counts file
        corrected <- readRDS("cache/normalized_and_corrected_matrix.rds")

        # selected most variable 2000 genes
        vars <- apply(corrected, 1, var)
        corrected_2000 <- corrected[names(vars[order(vars, decreasing = T)[1:2000]]), ]

        message("Running t-SNE...") # TSNE, no pca
        tsne_df <- Rtsne(t(corrected_2000), pca = F)
        tsne_df <- tsne_df$Y
        tsne_df <- data.frame(tsne_df)

        rownames(tsne_df) <- colnames(corrected_2000)
        message("Saving t-SNE results to cache...")
        saveRDS(tsne_df, "cache/tsne_result.rds")
    }
    return(tsne_df)
}

load_metadata <- function() {
    metadata <- fread("data/meta.csv", data.table = F)
    return(metadata)
}

#* @get /tsne
#* @serializer json
tsne <- function() {
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

    return(result)
}


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
    if (!file.exists("cache/sample_data.rds")) {
        message("Sample data not found. Returning example data.")
        # Load example data from seAMLess package
        data(exampleTCGA)
        result <- seAMLess(exampleTCGA)
        return(list(
            message = "Example data used. Please upload your own data for actual analysis.",
            deconvolution = as.list(result$Deconvolution)
        ))
    }
    sample_data <- readRDS("cache/sample_data.rds")
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
gene_expression <- function(req) {
    corrected <- fread("data/counts/normalised_and_corrected_counts.csv", data.table = F)
    rownames(corrected) <- corrected[, 1]
    corrected <- corrected[, -1]

    gene <- req$args$gene
    tsne_result <- run_tsne()

    message(paste("Fetching gene expression data for:", gene))
    message(paste("Corrected data rows:", nrow(corrected)))


    if (!gene %in% colnames(corrected)) {
        return(list(error = "Gene not found"))
    }

    merged <- merge(tsne_result, corrected[, gene, drop = FALSE], by = 0)
    colnames(merged)[1] <- "sample_id"
    return(list(expression = merged, available_genes = colnames(corrected)))
}
