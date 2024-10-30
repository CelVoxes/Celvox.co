# Backend Installation

```bash
micromamba env create -f environment.yml
micromamba activate seamless_env
```

In the R console, you can then install the R packages using:

```R
install.packages("fst")

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


# ROADMAP

[x] We want to be able to upload a new sample (or samples)
[x] To be able check k-NN enrichment of mutations for the uploaded samples
[x] To be able to check drug response for the uploaded samples
[x] To be able to check metadata enrichment for the uploaded samples

1. We need better AI module: what can we add?
2. The data upload sucks. We need a better way.
   A way would be to be able to select the dataset from the list of available datasets. For instance, the user should be able to select any dataset that would be integrated in the platform on the fly.
3. After the data is uploaded, we need to be able to select the uploaded samples and run the analyses.
