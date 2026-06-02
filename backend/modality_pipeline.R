# Modality pipeline -----------------------------------------------------------
#
# The modality abstraction's behavioral seam. modalities.R says WHICH modalities
# exist; this module says, for each pipeline STAGE (ingest / harmonize / qc),
# what that modality does — a strategy label plus the handler that implements it.
#
# `rna_bulk` is the one first-class implementation today: its ingest stage is
# wired to the real read function, and harmonize/qc record their strategy while
# their logic still lives in the (annotated) endpoint handlers, to be migrated
# behind this seam without changing behavior. `methylation` and `variants` are
# scaffolds — every handler is NULL, so dispatching any stage yields a structured
# "planned modality" error instead of silently falling through to RNA behavior.
#
# Handlers are stored by NAME and resolved lazily at dispatch, so this module is
# insensitive to source order (the named function need only exist by call time).
#
# Depends on modalities.R (get_modality, is_available_modality).

# stage entry: list(strategy = <label>, handler = <function name or NULL>)
MODALITY_PIPELINE_REGISTRY <- local({
    stage <- function(strategy, handler = NULL) list(strategy = strategy, handler = handler)
    list(
        rna_bulk = list(
            ingest    = stage("star_readspergene", "read_readspergene_files"),
            harmonize = stage("combat_seq", "harmonize_rna_bulk"),
            qc        = stage("rna_bulk_qc", "qc_rna_bulk")
        ),
        methylation = list(
            ingest    = stage("idat_or_beta_matrix", NULL),
            harmonize = stage("bmiq_or_quantile", NULL),
            qc        = stage("methylation_qc", NULL)
        ),
        variants = list(
            ingest    = stage("vcf_overlay", NULL),
            harmonize = stage("none", NULL),          # variants are overlaid, not batch-corrected
            qc        = stage("variant_qc", NULL)
        )
    )
})

PIPELINE_STAGES <- c("ingest", "harmonize", "qc")

get_modality_pipeline <- function(modality) {
    id <- tolower(trimws(as.character(modality)[1]))
    MODALITY_PIPELINE_REGISTRY[[id]]
}

modality_stage <- function(modality, stage) {
    pl <- get_modality_pipeline(modality)
    if (is.null(pl)) return(NULL)
    pl[[stage]]
}

# TRUE only when the stage has a handler that actually resolves to a function.
modality_supports_stage <- function(modality, stage) {
    st <- modality_stage(modality, stage)
    if (is.null(st) || is.null(st$handler)) return(FALSE)
    tryCatch(is.function(get(st$handler, mode = "function")), error = function(e) FALSE)
}

# Structured response for endpoints to return when a modality (or one of its
# stages) is requested but not yet implemented. Stable shape for the frontend.
planned_modality_response <- function(modality, stage = NULL) {
    m <- get_modality(modality)
    status <- if (is.null(m)) "unknown" else (m$status %||% "planned")
    msg <- if (is.null(stage)) {
        sprintf("Modality '%s' is %s and not available yet.", modality, status)
    } else {
        sprintf("Modality '%s' has no %s implementation yet (%s).", modality, stage, status)
    }
    list(error = msg, modality = as.character(modality)[1], stage = stage, status = status)
}

# Hard guard: stop() unless the modality ships a working pipeline today. Endpoints
# adopt this as each modality is implemented; rna_bulk passes, scaffolds do not.
require_available_modality <- function(modality) {
    if (!is_available_modality(modality)) {
        stop(planned_modality_response(modality)$error, call. = FALSE)
    }
    invisible(tolower(trimws(as.character(modality)[1])))
}

# Dispatch a pipeline stage to its modality-specific handler. Errors clearly for
# scaffolded modalities/stages rather than silently doing the wrong thing.
dispatch_modality_stage <- function(modality, stage, ...) {
    if (!stage %in% PIPELINE_STAGES) {
        stop(sprintf("Unknown pipeline stage: %s", stage), call. = FALSE)
    }
    st <- modality_stage(modality, stage)
    if (is.null(st)) stop(sprintf("Unknown modality: %s", modality), call. = FALSE)
    if (is.null(st$handler)) {
        stop(planned_modality_response(modality, stage)$error, call. = FALSE)
    }
    handler <- get(st$handler, mode = "function")
    handler(...)
}

# Pipeline summary for a modality (strategy + implemented flag per stage). Not
# yet wired into /catalog (would change its shape); available for inspection and
# for the frontend once the catalog opts in.
modality_pipeline_summary <- function(modality) {
    pl <- get_modality_pipeline(modality)
    if (is.null(pl)) return(NULL)
    lapply(PIPELINE_STAGES, function(s) {
        list(stage = s, strategy = pl[[s]]$strategy,
             implemented = modality_supports_stage(modality, s))
    })
}
