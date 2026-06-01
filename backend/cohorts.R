# Cohort registry -------------------------------------------------------------
#
# A COHORT is a biology group (AML, B-ALL, T-ALL) that ships one or more
# reference datasets. It is the universal replacement for the legacy `disease`
# axis as the *harmonization target*. A cohort can expose datasets in multiple
# MODALITIES (REDESIGN §2.2); the analysis context is (cohort(s) + modality).
#
# This registry layers descriptive metadata (label, lineage, which modalities a
# cohort provides) over data_registry.R, which remains the store of dataset file
# paths. Today every cohort provides only `rna_bulk`, and the per-modality
# dataset lookup reads the existing (implicitly rna_bulk) data registry; when
# methylation/variants datasets land they slot in under the same API.
#
# `normalize_cohort_id` / `list_known_cohorts` live here (the cohort is the
# concept); context.R and catalog.R depend on them.
#
# Depends on data_registry.R: registry_get(), normalize_disease_id(), %||%.

COHORT_REGISTRY <- local({
    list(
        aml = list(
            id = "aml",
            label = "AML",
            full_name = "Acute Myeloid Leukemia",
            lineage = "myeloid",
            modalities = c("rna_bulk")
        ),
        ball = list(
            id = "ball",
            label = "B-ALL",
            full_name = "B-cell Acute Lymphoblastic Leukemia",
            lineage = "b_lymphoid",
            modalities = c("rna_bulk")
        ),
        tall = list(
            id = "tall",
            label = "T-ALL",
            full_name = "T-cell Acute Lymphoblastic Leukemia",
            lineage = "t_lymphoid",
            modalities = c("rna_bulk")
        )
    )
})

# Canonical cohort id. 1:1 with the legacy disease id today; isolated so the
# mapping can diverge later (e.g. non-leukemia cohorts).
normalize_cohort_id <- function(x) normalize_disease_id(x)

# Cohorts that ship a reference dataset. Sourced from the cohort registry, but
# falls back to the data registry's disease keys so the two can't silently drift.
list_known_cohorts <- function() {
    ids <- names(COHORT_REGISTRY)
    if (is.null(ids) || !length(ids)) {
        ids <- tryCatch(names(registry_get("disease")), error = function(e) NULL)
    }
    ids <- ids[nzchar(ids %||% "")]
    if (is.null(ids) || !length(ids)) ids <- c("aml", "ball", "tall")
    ids
}

is_known_cohort <- function(id) normalize_cohort_id(id) %in% list_known_cohorts()

get_cohort <- function(id) {
    key <- normalize_cohort_id(id)
    COHORT_REGISTRY[[key]]
}

# Modality ids a cohort provides reference data for.
cohort_modalities <- function(id) {
    c <- get_cohort(id)
    if (is.null(c)) return(character(0))
    c$modalities %||% character(0)
}

# Which reference datasets a cohort ships for a given modality. Drives capability
# gating (a view needs its required cohort data present). Today the data registry
# is implicitly rna_bulk, so non-rna modalities report nothing until data lands.
cohort_datasets <- function(id, modality = "rna_bulk") {
    key <- normalize_cohort_id(id)
    modality <- tolower(trimws(as.character(modality)[1]))
    if (!identical(modality, "rna_bulk")) return(character(0))

    node <- registry_get("disease", key)
    if (is.null(node)) return(character(0))

    provides <- character(0)
    if (!is.null(node$counts) || !is.null(node$training)) provides <- c(provides, "reference_expression")
    if (!is.null(node$metadata)) provides <- c(provides, "metadata")
    if (!is.null(node$drug_response)) provides <- c(provides, "drug_response")
    if (!is.null(node$aberrations)) provides <- c(provides, "aberrations")
    if (!is.null(node$reference$gene_positions_hg38) || !is.null(node$reference$grch38_rda)) {
        provides <- c(provides, "cnv_reference")
    }
    provides
}

# Does a cohort provide every dataset key a capability requires (for a modality)?
cohort_provides_all <- function(id, required, modality = "rna_bulk") {
    if (is.null(required) || !length(required)) return(TRUE)
    all(required %in% cohort_datasets(id, modality))
}
