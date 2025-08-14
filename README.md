# Backend Installation

```bash
micromamba env create -f environment.yml
micromamba activate seamless_env
```

In the R console, you can then install the R packages using:

```R
install.packages("fst")

#install.packages("devtools")
devtools::install_github("eonurk/seAMLess")
devtools::install_github("eonurk/seAMLessData")

if (!require("BiocManager", quietly = TRUE))
    install.packages("BiocManager")

BiocManager::install("sva")

# Install MuSiC package
# TODO: This is an old version of the MuSiC package. We need to update it.
install.packages("MCMCpack")
install.packages("nnls")
install.packages("MuSiC", repos = "https://eonurk.github.io/drat/")
```
