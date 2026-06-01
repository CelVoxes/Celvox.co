# Platform catalog ------------------------------------------------------------
#
# A single, machine-readable description of what this deployment can do:
# the MODALITIES it understands, the reference COHORTS it ships, the analysis
# CAPABILITIES (dashboard views) available, and the prediction TOOLS catalogued.
#
# This is the single source of truth the frontend consumes (Phase 2), replacing
# the hand-maintained `DiseaseId` union and the duplicated `MOLECULAR_TOOL_CONFIGS`.
# It is a THIN ASSEMBLER: every section is read from a dedicated registry rather
# than hardcoded here, so there is exactly one place to edit each concept.
# Served via GET /catalog. Descriptive only; changes no analysis behavior.
#
# Depends on: modalities.R, capabilities.R, cohorts.R, tools_registry.R
# (get_molecular_tool_registry), and data_registry.R (%||%).

# Force a value to serialize as a JSON array (plumber's json serializer uses
# auto_unbox = TRUE, which would otherwise collapse length-1 vectors to scalars).
as_json_array <- function(x) {
    if (is.null(x)) return(list())
    as.list(unname(x))
}

# --- Cohorts -----------------------------------------------------------------
# Descriptor (from cohorts.R) + the reference datasets each cohort ships per
# modality. `provides` drives capability gating (a view needs its cohort data).
build_cohort_catalog <- function() {
    lapply(list_known_cohorts(), function(key) {
        c <- get_cohort(key)
        modalities <- cohort_modalities(key)
        list(
            id = key,
            label = c$label %||% toupper(key),
            full_name = c$full_name %||% key,
            lineage = c$lineage %||% NA_character_,
            modalities = as_json_array(modalities),
            # provides: dataset keys per modality the cohort actually ships.
            provides = stats::setNames(
                lapply(modalities, function(m) as_json_array(cohort_datasets(key, m))),
                modalities
            )
        )
    })
}

# --- Tools -------------------------------------------------------------------
# Re-projection of MOLECULAR_TOOL_REGISTRY (the backend source of truth) into the
# catalog shape. `supported_cohorts` is reconciled to real cohorts: the legacy
# `pan_leukemia` pseudo-id is dropped (it is a selection, not a cohort), leaving
# the actual biology groups a tool applies to.
build_tool_catalog <- function() {
    reg <- tryCatch(get_molecular_tool_registry(), error = function(e) list())
    known <- list_known_cohorts()
    lapply(unname(reg), function(t) {
        cohorts <- vapply(t$supported_diseases %||% character(0), normalize_cohort_id, character(1))
        cohorts <- unique(cohorts[cohorts %in% known])
        list(
            id = t$id,
            label = t$label,
            short_label = t$short_label,
            family = t$family,
            modality = "rna_bulk",
            integrated = isTRUE(t$integrated),
            supported_cohorts = as_json_array(cohorts),
            input_modality = t$input_modality %||% NA_character_,
            gene_identifier = t$gene_identifier %||% NA_character_,
            output_kind = t$output_kind %||% NA_character_,
            endpoint = t$endpoint %||% NA_character_,
            repo_url = t$repo_url %||% NA_character_,
            docs_url = t$docs_url %||% NA_character_,
            notes = t$notes %||% NA_character_
        )
    })
}

# --- Capabilities ------------------------------------------------------------
# Straight projection of CAPABILITY_REGISTRY with list-typed fields coerced to
# JSON arrays.
build_capability_catalog <- function() {
    lapply(capability_catalog_entries(), function(cap) {
        list(
            id = cap$id,
            label = cap$label,
            modalities = as_json_array(cap$modalities),
            data_requirement = cap$data_requirement,
            requires_cohort_data = as_json_array(cap$requires_cohort_data)
        )
    })
}

build_platform_catalog <- function() {
    list(
        version = "0",
        generated_at = format(Sys.time(), tz = "UTC", usetz = TRUE),
        modalities = modality_catalog_entries(),
        cohorts = build_cohort_catalog(),
        capabilities = build_capability_catalog(),
        tools = build_tool_catalog()
    )
}
