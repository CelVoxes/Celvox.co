# R packages that are not available on conda-forge / bioconda.
# Run at image build time (see Dockerfile).

options(
  repos = c(CRAN = "https://cloud.r-project.org"),
  Ncpus = max(1L, parallel::detectCores())
)

install_or_die <- function(label, expr) {
  message("\n=== installing ", label, " ===")
  ok <- tryCatch({ force(expr); TRUE }, error = function(e) {
    message("FAILED: ", conditionMessage(e)); FALSE
  })
  if (!ok) quit(status = 1L, save = "no")
}

# MuSiC: pinned legacy build served from the maintainer's drat repo. CRAN stays
# in the list so MuSiC's own dependencies still resolve.
install_or_die("MuSiC", install.packages(
  "MuSiC",
  repos = c(drat = "https://eonurk.github.io/drat/", CRAN = "https://cloud.r-project.org")))

# seAMLess + its bundled reference data.
install_or_die("seAMLess", remotes::install_github(
  "eonurk/seAMLess", upgrade = "never", dependencies = FALSE))
install_or_die("seAMLessData", remotes::install_github(
  "eonurk/seAMLessData", upgrade = "never", dependencies = FALSE))

# Fail the build loudly if anything the API loads at startup is missing.
required <- c(
  "plumber", "data.table", "fst", "jsonlite", "httr", "Rtsne", "FNN",
  "caret", "kernlab", "Biobase", "sva", "limma", "fgsea", "msigdbr",
  "MuSiC", "nnls", "MCMCpack", "seAMLess", "seAMLessData",
  "singscore", "LiblineaR", "kknn", "randomForest", "ranger", "glmnet"
)
missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing)) {
  message("\nMissing R packages after install: ", paste(missing, collapse = ", "))
  quit(status = 1L, save = "no")
}
message("\nAll required R packages present.")
