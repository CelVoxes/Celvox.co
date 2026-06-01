# Modality registry -----------------------------------------------------------
#
# A MODALITY is the kind of data being analysed. It is the universal axis the
# platform pivots on: ingestion, feature space, QC, and harmonization strategy
# all depend on it. This registry is the single source of truth for which
# modalities exist and their status; catalog.R reports it and (Phase 3/4) the
# ingest/harmonize layers dispatch on it.
#
# Today only `rna_bulk` ships data. `methylation` and `variants` are declared as
# `planned` so the catalog advertises direction without making them selectable.
#
# feature_identifier : how features are named in this modality.
# harmonization      : reference-alignment strategy (NA when not yet defined).
# status             : "available" (has data + pipeline) | "planned" (scaffold).

MODALITY_REGISTRY <- local({
    list(
        rna_bulk = list(
            id = "rna_bulk",
            label = "Bulk RNA-seq",
            status = "available",
            feature_identifier = "ensembl_or_symbol",
            harmonization = "combat_seq"
        ),
        methylation = list(
            id = "methylation",
            label = "DNA Methylation",
            status = "planned",
            feature_identifier = "cpg_probe",
            harmonization = NA_character_
        ),
        variants = list(
            id = "variants",
            label = "Variants (WGS/WES)",
            status = "planned",
            feature_identifier = "variant_locus",
            harmonization = NA_character_
        )
    )
})

# Ordered modality ids (definition order).
list_modality_ids <- function() names(MODALITY_REGISTRY)

# Ids of modalities that actually ship data + a working pipeline today.
list_available_modality_ids <- function() {
    ids <- list_modality_ids()
    ids[vapply(ids, function(id) identical(MODALITY_REGISTRY[[id]]$status, "available"), logical(1))]
}

get_modality <- function(id) {
    if (is.null(id) || !nzchar(as.character(id)[1])) return(NULL)
    MODALITY_REGISTRY[[tolower(trimws(as.character(id)[1]))]]
}

is_known_modality <- function(id) !is.null(get_modality(id))

is_available_modality <- function(id) {
    m <- get_modality(id)
    !is.null(m) && identical(m$status, "available")
}

# Modality definitions as an unnamed list, for serialization in the catalog.
modality_catalog_entries <- function() unname(MODALITY_REGISTRY)
