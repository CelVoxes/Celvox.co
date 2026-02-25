normalize_disease_id <- function(x) {
    if (is.null(x) || !nzchar(x)) return("aml")
    key <- tolower(trimws(as.character(x)[1]))
    key <- gsub("[ _]+", "-", key)

    if (key %in% c("aml")) return("aml")
    if (key %in% c("b-all", "ball", "b_all")) return("ball")
    if (key %in% c("t-all", "tall", "t_all")) return("tall")
    if (key %in% c("pan-leukemia", "pan_leukemia", "panleukemia", "all")) return("pan_leukemia")

    return(key)
}

DATA_REGISTRY <- local({
    list(
        shared = list(),
        disease = list(
            aml = list(
                root = file.path("data", "AML"),
                metadata = file.path("data", "AML", "meta.csv"),
                scores = file.path("data", "AML", "scores.csv"),
                reference = list(
                    gene_positions_hg38 = file.path("data", "AML", "gene_positions_hg38.csv"),
                    grch38_rda = file.path("data", "AML", "grch38.rda")
                ),
                counts = list(
                    uncorrected = file.path("data", "AML", "counts", "uncorrected_counts.csv"),
                    corrected = file.path("data", "AML", "counts", "corrected_counts.csv"),
                    normalized_corrected = file.path("data", "AML", "counts", "normalised_and_corrected_counts.csv"),
                    var_rank_genes = file.path("data", "AML", "counts", "var_rank_genes_greater70blasts.csv")
                ),
                drug_response = list(
                    ex_vivo = file.path("data", "AML", "drug_response", "ex_vivo_drug_response.csv"),
                    families = file.path("data", "AML", "drug_response", "drug_families.csv")
                ),
                aberrations = list(
                    mutations = file.path("data", "AML", "aberrations", "mutations.csv"),
                    one_hot = file.path("data", "AML", "aberrations", "aberrations_oh.csv")
                )
            ),
            ball = list(
                root = file.path("data", "B-ALL"),
                metadata = file.path("data", "B-ALL", "training_rna_raw_full_ensembl_b_all_direct_plus_derived_metadata.csv"),
                training = list(
                    rna_parquet = file.path("data", "B-ALL", "training_rna_raw_full_ensembl_b_all_direct_plus_derived.parquet"),
                    metadata_csv = file.path("data", "B-ALL", "training_rna_raw_full_ensembl_b_all_direct_plus_derived_metadata.csv")
                )
            ),
            tall = list(
                root = file.path("data", "T-ALL"),
                metadata = file.path("data", "T-ALL", "training_rna_raw_full_ensembl_t_all_direct_plus_derived_metadata.csv"),
                training = list(
                    rna_parquet = file.path("data", "T-ALL", "training_rna_raw_full_ensembl_t_all_direct_plus_derived.parquet"),
                    metadata_csv = file.path("data", "T-ALL", "training_rna_raw_full_ensembl_t_all_direct_plus_derived_metadata.csv")
                )
            )
        ),
        legacy = list(
            aml = list(
                metadata = file.path("data", "meta.csv"),
                counts = list(
                    uncorrected = file.path("data", "counts", "uncorrected_counts.csv")
                ),
                drug_response = list(
                    ex_vivo = file.path("data", "drug_response", "ex_vivo_drug_response.csv"),
                    families = file.path("data", "drug_response", "drug_families.csv")
                ),
                aberrations = list(
                    mutations = file.path("data", "aberrations", "mutations.csv"),
                    one_hot = file.path("data", "aberrations", "aberrations_oh.csv")
                ),
                reference = list(
                    gene_positions_hg38 = file.path("data", "gene_positions_hg38.csv")
                )
            )
        )
    )
})

registry_get <- function(...) {
    keys <- list(...)
    node <- DATA_REGISTRY
    for (k in keys) {
        if (is.null(node)) return(NULL)
        key <- as.character(k)
        if (!nzchar(key) || is.null(node[[key]])) return(NULL)
        node <- node[[key]]
    }
    node
}

registry_path <- function(...) {
    x <- registry_get(...)
    if (is.null(x)) return(NULL)
    if (is.character(x) && length(x) >= 1) return(x[[1]])
    return(NULL)
}

first_existing_path <- function(paths) {
    if (is.null(paths)) return(NULL)
    paths <- unlist(paths, use.names = FALSE)
    paths <- paths[nzchar(paths)]
    for (p in paths) {
        if (file.exists(p)) return(p)
    }
    return(NULL)
}

require_existing_path <- function(path, label = "data file") {
    if (is.null(path) || !nzchar(path) || !file.exists(path)) {
        stop(sprintf("Required %s not found: %s", label, ifelse(is.null(path), "<unresolved>", path)))
    }
    return(path)
}

resolve_disease_asset <- function(disease = "aml", ..., legacy_fallback = TRUE) {
    disease_key <- normalize_disease_id(disease)
    suffix <- as.list(substitute(list(...)))[-1]
    suffix <- lapply(suffix, function(x) as.character(eval(x)))

    disease_path <- do.call(registry_path, c(list("disease", disease_key), suffix))

    candidates <- c(disease_path)
    if (isTRUE(legacy_fallback) && identical(disease_key, "aml")) {
        legacy_path <- do.call(registry_path, c(list("legacy", "aml"), suffix))
        candidates <- c(candidates, legacy_path)
    }

    return(first_existing_path(candidates))
}

`%||%` <- function(x, y) {
    if (is.null(x)) return(y)
    x
}
