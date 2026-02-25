TOOLS_REGISTRY <- local({
    list(
        shared = list(
            molecular_diagnostic = list(
                pan_leukemia = list(
                    bridge = list(
                        bundle = c(
                            file.path(
                                "tools_runtime",
                                "Bridge",
                                "bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
                            ),
                            file.path(
                                "tools",
                                "Bridge",
                                "bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
                            ),
                            file.path(
                                "data",
                                "tools",
                                "Bridge",
                                "bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
                            ),
                            file.path(
                                "data",
                                "Molecular-diagnostic",
                                "Pan-Leukemia",
                                "bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
                            )
                        )
                    )
                ),
                aml = list(
                    amlmapr = list(
                        root = c(
                            file.path("tools", "AMLmapR"),
                            file.path("data", "tools", "AMLmapR")
                        ),
                        functions_r = c(
                            file.path("tools", "AMLmapR", "R", "functions.R"),
                            file.path("data", "tools", "AMLmapR", "R", "functions.R")
                        ),
                        sysdata_rda = c(
                            file.path("tools", "AMLmapR", "R", "sysdata.rda"),
                            file.path("data", "tools", "AMLmapR", "R", "sysdata.rda")
                        ),
                        example_matrix_rda = c(
                            file.path("tools", "AMLmapR", "data", "example_matrix.rda"),
                            file.path("data", "tools", "AMLmapR", "data", "example_matrix.rda")
                        )
                    )
                ),
                ball = list(
                    allsorts = list(
                        root = c(
                            file.path("tools", "ALLSorts"),
                            file.path("data", "tools", "ALLSorts")
                        ),
                        model_dir = c(
                            file.path("tools_runtime", "ALLSorts", "models", "allsorts"),
                            file.path("tools", "ALLSorts", "ALLSorts", "models", "allsorts"),
                            file.path("data", "tools", "ALLSorts", "ALLSorts", "models", "allsorts")
                        ),
                        model = c(
                            file.path("tools_runtime", "ALLSorts", "models", "allsorts", "allsorts.pkl.gz"),
                            file.path("tools", "ALLSorts", "ALLSorts", "models", "allsorts", "allsorts.pkl.gz"),
                            file.path("data", "tools", "ALLSorts", "ALLSorts", "models", "allsorts", "allsorts.pkl.gz")
                        )
                    ),
                    allcatchr = list(
                        root = c(
                            file.path("tools", "ALLCatchR_bcrabl1"),
                            file.path("data", "tools", "ALLCatchR_bcrabl1")
                        )
                    )
                ),
                tall = list(
                    tallsorts = list(
                        root = c(
                            file.path("tools", "TALLSorts"),
                            file.path("data", "tools", "TALLSorts")
                        ),
                        model = c(
                            file.path("tools_runtime", "TALLSorts", "models", "tallsorts", "tallsorts_default_model.pkl.gz"),
                            file.path("tools", "TALLSorts", "TALLSorts", "models", "tallsorts", "tallsorts_default_model.pkl.gz"),
                            file.path("data", "tools", "TALLSorts", "TALLSorts", "models", "tallsorts", "tallsorts_default_model.pkl.gz")
                        )
                    )
                )
            )
        ),
        legacy = list(
            bridge = list(
                bundle = c(
                    file.path(
                        "tools_runtime",
                        "Bridge",
                        "bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
                    ),
                    file.path(
                        "tools",
                        "Bridge",
                        "bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
                    ),
                    file.path(
                        "data",
                        "tools",
                        "Bridge",
                        "bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
                    ),
                    file.path(
                        "data",
                        "bridge",
                        "bridge_inference_with_gtex1252_plus_srp03245568_healthy_balanced.bundle"
                    )
                ),
                meta = c(
                    file.path("tools_runtime", "Bridge", "bridge.meta.joblib"),
                    file.path("tools", "Bridge", "bridge.meta.joblib"),
                    file.path("data", "tools", "Bridge", "bridge.meta.joblib"),
                    file.path("data", "bridge", "bridge.meta.joblib")
                ),
                ckpt = c(
                    file.path("tools_runtime", "Bridge", "bridge.ckpt"),
                    file.path("tools", "Bridge", "bridge.ckpt"),
                    file.path("data", "tools", "Bridge", "bridge.ckpt"),
                    file.path("data", "bridge", "bridge.ckpt")
                ),
                classifier = c(
                    file.path(
                        "tools_runtime",
                        "Bridge",
                        "rna_latent_lr_with_gtex1252_plus_srp03245568_healthy_subsets_balanced.joblib"
                    ),
                    file.path(
                        "tools",
                        "Bridge",
                        "rna_latent_lr_with_gtex1252_plus_srp03245568_healthy_subsets_balanced.joblib"
                    ),
                    file.path(
                        "data",
                        "tools",
                        "Bridge",
                        "rna_latent_lr_with_gtex1252_plus_srp03245568_healthy_subsets_balanced.joblib"
                    ),
                    file.path(
                        "data",
                        "bridge",
                        "rna_latent_lr_with_gtex1252_plus_srp03245568_healthy_subsets_balanced.joblib"
                    )
                )
            )
        )
    )
})

tool_registry_get <- function(...) {
    keys <- list(...)
    node <- TOOLS_REGISTRY
    for (k in keys) {
        if (is.null(node)) return(NULL)
        key <- as.character(k)
        if (!nzchar(key) || is.null(node[[key]])) return(NULL)
        node <- node[[key]]
    }
    node
}

resolve_bridge_assets <- function(disease = "aml") {
    disease_key <- normalize_disease_id(disease)
    list(
        disease = disease_key,
        bundle_candidates = c(
            tool_registry_get("shared", "molecular_diagnostic", "pan_leukemia", "bridge", "bundle"),
            tool_registry_get("shared", "molecular_diagnostic", disease_key, "bridge", "bundle"),
            tool_registry_get("legacy", "bridge", "bundle")
        ),
        meta_candidates = c(
            tool_registry_get("legacy", "bridge", "meta")
        ),
        ckpt_candidates = c(
            tool_registry_get("legacy", "bridge", "ckpt")
        ),
        lr_candidates = c(
            tool_registry_get("legacy", "bridge", "classifier")
        )
    )
}

resolve_molecular_tool_assets <- function(tool) {
    tool_key <- tolower(trimws(as.character(tool)[1]))
    if (!nzchar(tool_key)) return(NULL)

    if (identical(tool_key, "amlmapr")) {
        return(list(
            tool = "amlmapr",
            root = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "aml", "amlmapr", "root")),
            functions_r = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "aml", "amlmapr", "functions_r")),
            sysdata_rda = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "aml", "amlmapr", "sysdata_rda")),
            example_matrix_rda = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "aml", "amlmapr", "example_matrix_rda"))
        ))
    }

    if (identical(tool_key, "allsorts")) {
        return(list(
            tool = "allsorts",
            root = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "ball", "allsorts", "root")),
            model_dir = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "ball", "allsorts", "model_dir")),
            model = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "ball", "allsorts", "model"))
        ))
    }

    if (identical(tool_key, "allcatchr")) {
        return(list(
            tool = "allcatchr",
            root = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "ball", "allcatchr", "root"))
        ))
    }

    if (identical(tool_key, "tallsorts")) {
        return(list(
            tool = "tallsorts",
            root = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "tall", "tallsorts", "root")),
            model = first_existing_path(tool_registry_get("shared", "molecular_diagnostic", "tall", "tallsorts", "model"))
        ))
    }

    NULL
}

MOLECULAR_TOOL_REGISTRY <- local({
    list(
        bridge = list(
            id = "bridge",
            label = "Bridge",
            short_label = "Bridge",
            family = "molecular_diagnostic",
            integrated = TRUE,
            disease_scope = "pan_leukemia",
            supported_diseases = c("aml", "ball", "tall", "pan_leukemia"),
            input_modality = "raw_rna_counts",
            gene_identifier = "ensembl",
            confidence_semantics = "class_probability",
            endpoint = "bridge-predict",
            output_kind = "multiclass_probabilities",
            repo_url = "https://github.com/eonurk/Bridge",
            notes = "Pan-leukemia Bridge bundle (official Bridge Python package)."
        ),
        amlmapr = list(
            id = "amlmapr",
            label = "AMLmapR",
            short_label = "AMLmapR",
            family = "molecular_diagnostic",
            integrated = TRUE,
            disease_scope = "aml",
            supported_diseases = c("aml", "pan_leukemia"),
            input_modality = "raw_rna_counts",
            gene_identifier = "ensembl",
            confidence_semantics = "svm_decision_score",
            endpoint = "amlmapr-predict",
            output_kind = "aml_cluster_scores",
            repo_url = "https://github.com/jeppeseverens/AMLmapR",
            notes = "AML-specific transcriptional subtype predictor."
        ),
        allsorts = list(
            id = "allsorts",
            label = "ALLSorts (B-ALL)",
            short_label = "ALLSorts",
            family = "molecular_diagnostic",
            integrated = TRUE,
            disease_scope = "ball",
            supported_diseases = c("ball", "pan_leukemia"),
            input_modality = "raw_rna_counts",
            gene_identifier = "gene_symbol",
            confidence_semantics = "class_probability",
            endpoint = "allsorts-predict",
            output_kind = "multiclass_probabilities",
            repo_url = "https://github.com/Oshlack/ALLSorts",
            notes = "B-ALL subtype classifier; Ensembl counts are converted to symbols before inference."
        ),
        tallsorts = list(
            id = "tallsorts",
            label = "TALLSorts (T-ALL)",
            short_label = "TALLSorts",
            family = "molecular_diagnostic",
            integrated = TRUE,
            disease_scope = "tall",
            supported_diseases = c("tall", "pan_leukemia"),
            input_modality = "raw_rna_counts",
            gene_identifier = "ensembl",
            confidence_semantics = "class_probability_by_level",
            endpoint = "tallsorts-predict",
            output_kind = "hierarchical_probabilities",
            repo_url = "https://github.com/Oshlack/TALLSorts",
            notes = "T-ALL hierarchical subtype classifier."
        ),
        allcatchr = list(
            id = "allcatchr",
            label = "ALLCatchR (BCR-ABL1)",
            short_label = "ALLCatchR",
            family = "molecular_diagnostic",
            integrated = TRUE,
            disease_scope = "ball",
            supported_diseases = c("ball", "pan_leukemia"),
            input_modality = "raw_rna_counts",
            gene_identifier = "ensembl_or_symbol",
            confidence_semantics = "discrete_confidence_label_and_score",
            endpoint = "allcatchr-predict",
            output_kind = "b_all_subtype_classifier_with_bcrabl1_subclusters",
            repo_url = "https://github.com/ThomasBeder/ALLCatchR_bcrabl1",
            notes = "BCP-ALL gene expression classifier (ALLCatchR_bcrabl1); predicts subtype plus BCR::ABL1 subclusters."
        ),
        md_all = list(
            id = "md_all",
            label = "MD-ALL",
            short_label = "MD-ALL",
            family = "molecular_diagnostic",
            integrated = FALSE,
            disease_scope = "ball",
            supported_diseases = c("ball"),
            input_modality = "integrative_rna_and_genetic_events",
            gene_identifier = "mixed",
            confidence_semantics = "tool_specific",
            endpoint = NA_character_,
            output_kind = "integrative_b_all_diagnostic_platform",
            repo_url = "https://github.com/gu-lab20/MD-ALL",
            notes = "Integrative B-ALL molecular diagnostic platform (catalog entry; not yet integrated)."
        ),
        hematomap = list(
            id = "hematomap",
            label = "HematoMap",
            short_label = "HematoMap",
            family = "molecular_diagnostic",
            integrated = FALSE,
            disease_scope = "multi_disease",
            supported_diseases = c("aml", "ball"),
            input_modality = "bulk_or_single_cell_rna",
            gene_identifier = "mixed",
            confidence_semantics = "likelihood_or_score",
            endpoint = NA_character_,
            output_kind = "lineage_aberration_projection",
            repo_url = "https://github.com/NRCTM-bioinfo/HematoMap",
            docs_url = "https://nrctm-bioinfo.github.io/HematoMap/index.html",
            notes = "Lineage aberration / hierarchy projection tool (reported for AML and BCP-ALL; catalog entry)."
        )
    )
})

get_molecular_tool_registry <- function() {
    MOLECULAR_TOOL_REGISTRY
}

get_molecular_tool_definition <- function(tool_id) {
    if (is.null(tool_id) || !nzchar(as.character(tool_id)[1])) return(NULL)
    key <- tolower(trimws(as.character(tool_id)[1]))
    reg <- get_molecular_tool_registry()
    if (is.null(reg[[key]])) return(NULL)
    reg[[key]]
}

molecular_tool_supported_for_disease <- function(tool_id, disease = "aml") {
    tool <- if (is.list(tool_id)) tool_id else get_molecular_tool_definition(tool_id)
    if (is.null(tool)) return(FALSE)

    disease_key <- normalize_disease_id(disease)
    supported <- unique(vapply(tool$supported_diseases %||% character(0), normalize_disease_id, FUN.VALUE = character(1)))
    disease_key %in% supported
}
