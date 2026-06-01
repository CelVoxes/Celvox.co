# predict.R — molecular prediction service layer
#
# Tool dispatch + the upload-sample plumbing the per-tool prediction endpoints
# share (python discovery, sample-column resolution, counts -> gene symbols,
# python-script invocation, runtime status, tool catalog). Sourced by plumber.R
# before the endpoint definitions. These are plain helpers (no plumber
# annotations); the `#* @get /<tool>-predict` endpoints stay in plumber.R and are
# referenced lazily by dispatch_molecular_prediction(), so source order is safe.

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
