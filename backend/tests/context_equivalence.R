# Assert parse_analysis_context()'s legacy aliases are byte-identical to the old
# get_request_disease_selection() + disease_selection_key() path, across the
# request shapes the frontend/proxy actually send. Run from backend/:
#   Rscript tests/context_equivalence.R
suppressWarnings(suppressMessages({
    library(fst); library(data.table)
    for (f in c("data_registry.R", "tools_registry.R", "metadata_alignment_registry.R",
                "modalities.R", "capabilities.R", "cohorts.R", "resolve.R",
                "context.R", "ingest.R", "metadata.R")) source(f)
}))

mk <- function(...) list(args = list(...))

# (A) Legacy regression guard: the expected disease key / selection here were
# captured from the ORIGINAL get_request_disease_selection() + disease_selection_key()
# implementation (before context.R became the parser). parse_analysis_context must
# keep reproducing them byte-for-byte for every request shape the old path handled.
lc <- function(req, key, sel) list(req = req, key = key, sel = strsplit(sel, ",")[[1]])
legacy_cases <- list(
    lc(mk(),                                  "aml",          "aml"),
    lc(mk(disease = "aml"),                   "aml",          "aml"),
    lc(mk(disease = "ball"),                  "ball",         "ball"),
    lc(mk(disease = "tall"),                  "tall",         "tall"),
    lc(mk(disease = "pan_leukemia"),          "pan_leukemia", "aml,ball,tall"),
    lc(mk(diseases = "aml"),                  "aml",          "aml"),
    lc(mk(diseases = "ball,tall"),            "ball+tall",    "ball,tall"),
    lc(mk(diseases = "tall,ball"),            "ball+tall",    "ball,tall"),  # order independence
    lc(mk(diseases = "aml,ball,tall"),        "pan_leukemia", "aml,ball,tall"),
    lc(mk(diseases = "ball,aml"),             "aml+ball",     "aml,ball"),
    lc(mk(disease = "aml", diseases = "ball,tall"), "ball+tall", "ball,tall"),  # diseases wins
    lc(mk(disease = "AML"),                   "aml",          "aml"),          # case-insensitive
    lc(mk(disease = "bogus"),                 "aml",          "aml"),          # unknown -> default
    lc(mk(diseases = "ball,bogus"),           "ball",         "ball")
)

# (B) New superset behavior: context additionally honors cohort/cohorts (which
# the legacy helpers ignored). Assert context reads them; no legacy comparison.
superset_cases <- list(
    list(req = mk(cohort = "ball"),         disease = "ball",     diseases = "ball"),
    list(req = mk(cohorts = "aml,tall"),    disease = "aml+tall", diseases = "aml,tall")
)

fail <- 0
cat("(A) legacy regression guard\n")
for (i in seq_along(legacy_cases)) {
    c <- legacy_cases[[i]]
    ctx <- parse_analysis_context(c$req)
    ok <- identical(as.character(ctx$diseases), c$sel) &&
          identical(as.character(ctx$disease), c$key)
    if (!ok) fail <- fail + 1
    cat(sprintf("  [%2d] %-8s ctx{disease=%s, diseases=[%s]}  expected{key=%s, sel=[%s]}\n",
                i, if (ok) "ok" else "MISMATCH", ctx$disease, paste(ctx$diseases, collapse=","),
                c$key, paste(c$sel, collapse=",")))
}
cat("(B) new cohort/cohorts params\n")
for (c in superset_cases) {
    ctx <- parse_analysis_context(c$req)
    ok <- identical(as.character(ctx$disease), c$disease) &&
          identical(as.character(ctx$diseases), strsplit(c$diseases, ",")[[1]])
    if (!ok) fail <- fail + 1
    cat(sprintf("       %-8s ctx{disease=%s, diseases=[%s]} (modality=%s)\n",
                if (ok) "ok" else "MISMATCH", ctx$disease, paste(ctx$diseases, collapse=","), ctx$modality))
}
cat(if (fail == 0) "\nALL PASS\n" else sprintf("\n%d FAILURE(s)\n", fail))
quit(status = if (fail == 0) 0 else 1)
