# metadata.R — reference metadata service layer
#
# Request disease parsing + reference-metadata coalescing/normalization/alignment
# and load_metadata(). Sourced with local = TRUE (shares plumber.R's env).

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

# Back-compat shim: the legacy disease-selection parsing now routes through the
# universal context parser, so every endpoint shares ONE request-scope parser
# (which also validates `modality` and honors the new `cohort`/`cohorts` params).
# parse_analysis_context()$diseases is byte-identical to the old normalize path
# for disease/diseases inputs — see tests/context_equivalence.R. The downstream
# key transforms (disease_selection_key, get_request_disease) are unchanged and
# still operate on this selection vector.
get_request_disease_selection <- function(req, default = "aml") {
    parse_analysis_context(req, default_cohort = default)$diseases
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
