# Capability registry ---------------------------------------------------------
#
# A CAPABILITY is an analysis / dashboard view (QC, clustering, KNN,
# deconvolution, prediction, ...). This registry is the single source of truth
# for what the platform can do; catalog.R serves it and the Phase 2 frontend
# renders views from it instead of the hand-maintained DASHBOARD_SECTIONS.
#
# Each capability declares:
#   modalities           : modality ids it supports.
#   data_requirement     : "reference_only" -> explorable with no upload
#                          "requires_samples" -> needs uploaded + harmonized data
#                          "both" -> reference view by default, richer with samples
#   requires_cohort_data : dataset keys the cohort must `provide` (see cohorts.R)
#                          for this view to be meaningful (e.g. "drug_response").
#
# The data_requirement axis drives Explore-vs-Analyze mode (REDESIGN §2.6); the
# requires_cohort_data axis stops AML-only views rendering for B-ALL/T-ALL.

CAPABILITY_REGISTRY <- local({
    cap <- function(id, label, modalities, data_requirement, requires_cohort_data = character(0)) {
        list(
            id = id,
            label = label,
            modalities = modalities,
            data_requirement = data_requirement,
            requires_cohort_data = requires_cohort_data
        )
    }
    list(
        qc = cap("qc", "QC Metrics", "rna_bulk", "requires_samples"),
        tsne = cap("tsne", "Clustering", "rna_bulk", "both"),
        knn = cap("knn", "KNN Report", "rna_bulk", "requires_samples"),
        dysregulation = cap("dysregulation", "Dysregulation", "rna_bulk", "requires_samples"),
        deconvolution = cap("deconvolution", "Deconvolution", "rna_bulk", "both"),
        drug = cap("drug", "Drug Response", "rna_bulk", "both", requires_cohort_data = "drug_response"),
        cnv = cap("cnv", "CNV", "rna_bulk", "requires_samples", requires_cohort_data = "cnv_reference"),
        hamlet = cap("hamlet", "HAMLET", "rna_bulk", "requires_samples"),
        `molecular-prediction` = cap("molecular-prediction", "Molecular Prediction", "rna_bulk", "requires_samples"),
        `ask-ai` = cap("ask-ai", "Ask AI", "rna_bulk", "both")
    )
})

# Ordered capability ids (definition order = dashboard order).
list_capability_ids <- function() names(CAPABILITY_REGISTRY)

get_capability <- function(id) {
    if (is.null(id) || !nzchar(as.character(id)[1])) return(NULL)
    CAPABILITY_REGISTRY[[as.character(id)[1]]]
}

capability_supports_modality <- function(id, modality) {
    cap <- get_capability(id)
    if (is.null(cap)) return(FALSE)
    tolower(trimws(as.character(modality)[1])) %in% cap$modalities
}

# Capability definitions as an unnamed list, for serialization in the catalog.
capability_catalog_entries <- function() unname(CAPABILITY_REGISTRY)
