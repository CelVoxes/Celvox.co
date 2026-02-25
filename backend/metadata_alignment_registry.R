METADATA_ALIGNMENT_REGISTRY <- local({
    list(
        version = "v1",
        default = list(
            field_candidates = list(
                sample_id = c("sample_id", "rna_id", "Basename", "patient_id", "patient", "Unnamed: 0"),
                sample_id_aliases = c("rna_id", "sample_id", "patient_id", "patient", "Basename"),
                sex = c("sex", "predicted_sex"),
                study_source = c("study", "study.x", "data_source", "study.y"),
                study_collection = c("study.y", "study.x", "study", "dataset_patient_population", "GEX.dataset"),
                study_title = c("data_source_title", "study_title"),
                subtype_label = c("clusters", "Subtype.at.the.end.of.the.study", "WHO_2022", "ICC_2022", "btall_label"),
                tissue = c("tissue", "diagnosed_immunophenotype"),
                prim_rec = c("prim_rec"),
                event = c("event")
            )
        ),
        disease = list(
            aml = list(
                field_candidates = list(
                    sample_id = c("sample_id", "patient_id", "patient", "Unnamed: 0"),
                    sample_id_aliases = c("sample_id", "patient_id", "patient"),
                    study_source = c("study"),
                    study_collection = c("study"),
                    subtype_label = c("clusters", "WHO_2022", "ICC_2022"),
                    tissue = c("tissue"),
                    prim_rec = c("prim_rec"),
                    event = c("event")
                )
            ),
            ball = list(
                field_candidates = list(
                    sample_id = c("rna_id", "sample_id", "patient_id", "Basename", "patient", "Unnamed: 0"),
                    sample_id_aliases = c("rna_id", "sample_id", "patient_id", "Basename"),
                    study_source = c("data_source", "study.y", "study", "study.x"),
                    study_collection = c("study.y", "dataset_patient_population", "GEX.dataset", "study"),
                    subtype_label = c(
                        "Subtype.at.the.end.of.the.study",
                        "Subtype.prior..to.ML.classification",
                        "Subtype.at.ALL.diagnosis",
                        "btall_label",
                        "clusters"
                    ),
                    tissue = c("tissue", "diagnosed_immunophenotype", "tissue_source_site"),
                    prim_rec = c("prim_rec"),
                    event = c("event")
                )
            ),
            tall = list(
                field_candidates = list(
                    sample_id = c("rna_id", "sample_id", "patient_id", "Basename", "patient", "Unnamed: 0"),
                    sample_id_aliases = c("rna_id", "sample_id", "patient_id", "Basename"),
                    study_source = c("data_source", "study.y", "study", "study.x"),
                    study_collection = c("study.y", "dataset_patient_population", "GEX.dataset", "study"),
                    subtype_label = c(
                        "Subtype.at.the.end.of.the.study",
                        "Subtype.prior..to.ML.classification",
                        "Subtype.at.ALL.diagnosis",
                        "btall_label",
                        "clusters"
                    ),
                    tissue = c("tissue", "diagnosed_immunophenotype", "tissue_source_site"),
                    prim_rec = c("prim_rec"),
                    event = c("event")
                )
            )
        )
    )
})

metadata_registry_get <- function(...) {
    keys <- list(...)
    node <- METADATA_ALIGNMENT_REGISTRY
    for (k in keys) {
        if (is.null(node)) return(NULL)
        key <- as.character(k)
        if (!nzchar(key) || is.null(node[[key]])) return(NULL)
        node <- node[[key]]
    }
    node
}

metadata_registry_field_candidates <- function(field, disease = "aml") {
    disease_key <- normalize_disease_id(disease)
    disease_vals <- metadata_registry_get("disease", disease_key, "field_candidates", field)
    default_vals <- metadata_registry_get("default", "field_candidates", field)
    out <- c(disease_vals, default_vals)
    out <- out[nzchar(out)]
    unique(out)
}

metadata_registry_sample_id_alias_candidates <- function(disease = "aml") {
    metadata_registry_field_candidates("sample_id_aliases", disease = disease)
}
