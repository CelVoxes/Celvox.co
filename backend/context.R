# Analysis context -----------------------------------------------------------
#
# The "analysis context" is the scope of a request: which data MODALITY is being
# analysed and which reference COHORT(s) it is scoped to. This is the universal
# replacement for the legacy `disease` / `diseases` request parameters.
#
# Phase 0 (foundations): this module is ADDITIVE and fully back-compatible.
#   - Cohorts map 1:1 to the legacy disease ids (aml / ball / tall).
#   - The only real modality today is `rna_bulk`.
#   - `pan_leukemia` is NOT a cohort; it is the legacy alias for "more than one
#     cohort selected", so we expand it into its member cohorts here and rebuild
#     the legacy key on the way out.
# No existing endpoint calls this yet; it gives the rearchitecture a single,
# tested place to parse request scope before endpoints are migrated (Phase 3).
#
# Depends on cohorts.R (list_known_cohorts, normalize_cohort_id) and
# modalities.R (is_available_modality); %||% from data_registry.R.

DEFAULT_MODALITY <- "rna_bulk"
DEFAULT_COHORT <- "aml"

# Pull the cohort selection out of a request, accepting (in priority order) the
# new `cohorts`/`cohort` params and the legacy `diseases`/`disease` params.
parse_request_cohorts <- function(req, default = DEFAULT_COHORT) {
    raw <- req$args$cohorts %||% req$args$cohort %||%
        req$args$diseases %||% req$args$disease

    if (is.null(raw) || !nzchar(paste(as.character(raw), collapse = ""))) {
        if (is.null(default)) return(character(0))
        raw <- default
    }

    vals <- trimws(unlist(strsplit(as.character(raw), ",")))
    vals <- vals[nzchar(vals)]

    known <- list_known_cohorts()
    expanded <- unlist(lapply(vals, function(v) {
        key <- normalize_cohort_id(v)
        if (identical(key, "pan_leukemia")) known else key
    }), use.names = FALSE)

    expanded <- expanded[expanded %in% known]
    unique(expanded)
}

parse_request_modality <- function(req, default = DEFAULT_MODALITY) {
    raw <- req$args$modality
    if (is.null(raw) || !nzchar(as.character(raw)[1])) return(default)
    key <- tolower(trimws(as.character(raw)[1]))
    if (is_available_modality(key)) key else default
}

# Derive the legacy single `disease` key from a cohort selection, mirroring the
# frontend's deriveDiseaseParam: >1 cohort collapses to "pan_leukemia".
cohorts_to_legacy_disease <- function(cohorts) {
    if (length(cohorts) == 0) return(normalize_cohort_id(DEFAULT_COHORT))
    if (length(cohorts) > 1) return("pan_leukemia")
    cohorts[[1]]
}

# Parse the full analysis context from a request. Returns a list carrying both
# the new fields (modality, cohorts) and the legacy aliases (disease, diseases)
# so callers can be migrated incrementally without changing behavior.
parse_analysis_context <- function(req, default_cohort = DEFAULT_COHORT) {
    cohorts <- parse_request_cohorts(req, default = default_cohort)
    if (!length(cohorts)) cohorts <- normalize_cohort_id(default_cohort)
    modality <- parse_request_modality(req)

    list(
        modality = modality,
        cohorts = cohorts,
        samples_present = FALSE,        # populated by the caller when known
        disease = cohorts_to_legacy_disease(cohorts),  # legacy alias
        diseases = cohorts                              # legacy alias
    )
}
