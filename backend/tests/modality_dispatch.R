# Prove the modality abstraction seam: rna_bulk's wired stage dispatches to a
# real function; scaffolded modalities/stages raise a clear "planned" error
# instead of silently behaving like RNA; the availability guard agrees with the
# registry. Run from backend/:  Rscript tests/modality_dispatch.R
suppressWarnings(suppressMessages({
    library(fst); library(data.table)
    for (f in c("data_registry.R", "modalities.R", "ingest.R", "analysis.R",
                "harmonize.R", "modality_pipeline.R")) source(f)
}))

fail <- 0
check <- function(desc, ok) {
    if (!ok) fail <<- fail + 1
    cat(sprintf("  [%s] %s\n", if (ok) "ok" else "FAIL", desc))
}

# rna_bulk: all three pipeline stages are wired to real handlers.
for (st in PIPELINE_STAGES) {
    check(sprintf("rna_bulk %s is implemented", st), modality_supports_stage("rna_bulk", st))
}
check("rna_bulk ingest resolves read_readspergene_files",
      identical(get(modality_stage("rna_bulk","ingest")$handler, mode="function"), read_readspergene_files))
check("rna_bulk harmonize resolves harmonize_rna_bulk",
      identical(get(modality_stage("rna_bulk","harmonize")$handler, mode="function"), harmonize_rna_bulk))
check("rna_bulk qc resolves qc_rna_bulk",
      identical(get(modality_stage("rna_bulk","qc")$handler, mode="function"), qc_rna_bulk))

# scaffolds: every stage errors with a structured planned message, never silent.
for (mod in c("methylation", "variants")) {
    for (st in PIPELINE_STAGES) {
        check(sprintf("%s/%s is not implemented", mod, st), !modality_supports_stage(mod, st))
        err <- tryCatch({ dispatch_modality_stage(mod, st); NA_character_ },
                        error = function(e) conditionMessage(e))
        check(sprintf("%s/%s dispatch errors clearly", mod, st),
              !is.na(err) && grepl(mod, err, fixed = TRUE))
    }
}

# availability guard mirrors the registry.
check("require_available_modality(rna_bulk) passes",
      tryCatch({ require_available_modality("rna_bulk"); TRUE }, error = function(e) FALSE))
check("require_available_modality(methylation) stops",
      tryCatch({ require_available_modality("methylation"); FALSE }, error = function(e) TRUE))

# unknown stage / modality are rejected.
check("unknown stage rejected",
      tryCatch({ dispatch_modality_stage("rna_bulk","nope"); FALSE }, error = function(e) TRUE))
check("planned_modality_response shape",
      { r <- planned_modality_response("methylation","ingest")
        is.list(r) && all(c("error","modality","stage","status") %in% names(r)) })

cat(if (fail == 0) "\nALL PASS\n" else sprintf("\n%d FAILURE(s)\n", fail))
quit(status = if (fail == 0) 0 else 1)
