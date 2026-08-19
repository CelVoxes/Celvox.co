# syntax=docker/dockerfile:1
#
# seAMLess compute backend: R plumber API (:5555) plus the Python runtimes the
# molecular prediction tools need.
#
# Three isolated conda environments live in this image:
#   base      R 4.4.3 + plumber + Bioconductor + seAMLess     (always)
#   moltools  Python 3.10 for ALLSorts / TALLSorts / parquet  (always)
#   bridge    Python 3.11 + torch for the Bridge classifier   (WITH_BRIDGE=1)
#
# Model artifacts and reference data are NOT baked in -- they are bind-mounted
# from ./backend at run time. See docs/DOCKER.md.

FROM mambaorg/micromamba:2.4.0

# Bridge pulls in torch (~250MB CPU-only). Set to 0 for a much faster/smaller
# build if you do not need the /bridge-predict endpoint.
ARG WITH_BRIDGE=1

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      make \
      gcc \
      g++ \
      gfortran \
      libxml2-dev \
      libcurl4-openssl-dev \
      libssl-dev \
      libgit2-dev \
      procps \
      tini \
 && rm -rf /var/lib/apt/lists/*
USER $MAMBA_USER

# ---------------------------------------------------------------------------
# 1. R environment
# ---------------------------------------------------------------------------
COPY --chown=$MAMBA_USER:$MAMBA_USER docker/r-backend/env-r.yml /tmp/env-r.yml
RUN micromamba install -y -n base -f /tmp/env-r.yml \
 && micromamba clean --all --yes

# R packages that are not on conda (MuSiC via drat, seAMLess via GitHub).
COPY --chown=$MAMBA_USER:$MAMBA_USER docker/r-backend/install-r-extras.R /tmp/install-r-extras.R
RUN micromamba run -n base Rscript /tmp/install-r-extras.R

# ---------------------------------------------------------------------------
# 2. Python environment for ALLSorts / TALLSorts / parquet helpers
# ---------------------------------------------------------------------------
COPY --chown=$MAMBA_USER:$MAMBA_USER docker/r-backend/env-moltools.yml /tmp/env-moltools.yml
RUN micromamba create -y -f /tmp/env-moltools.yml \
 && micromamba clean --all --yes

# ---------------------------------------------------------------------------
# 3. Python environment for Bridge (optional)
# ---------------------------------------------------------------------------
COPY --chown=$MAMBA_USER:$MAMBA_USER docker/r-backend/env-bridge.yml /tmp/env-bridge.yml
RUN if [ "$WITH_BRIDGE" = "1" ]; then \
      micromamba create -y -f /tmp/env-bridge.yml && micromamba clean --all --yes; \
    else \
      echo "WITH_BRIDGE=0 -- skipping Bridge environment"; \
    fi

# ---------------------------------------------------------------------------
# Runtime wiring
# ---------------------------------------------------------------------------
# R library dir for packages built from the bind-mounted tools/ tree
# (ALLCatchRbcrabl1). Backed by a named volume so it survives restarts.
ENV R_LIBS_USER=/opt/rlibs
USER root
RUN mkdir -p /opt/rlibs /shared/uploads

# Interpreters the plumber code looks up via Sys.getenv().
ENV MOLECULAR_TOOLS_PYTHON=/opt/conda/envs/moltools/bin/python \
    PARQUET_PYTHON=/opt/conda/envs/moltools/bin/python \
    BRIDGE_PYTHON=/opt/conda/envs/bridge/bin/python \
    R_ENV=production \
    SEAMLESS_BACKEND_DIR=/app/backend

# ALLSorts / TALLSorts are imported straight out of the bind-mounted source.
ENV PYTHONPATH=/app/backend/tools/ALLSorts:/app/backend/tools/TALLSorts

COPY docker/r-backend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Runs as root deliberately: ./backend is bind-mounted read-write (reference
# data, tool artifacts, the analysis cache) and matching an arbitrary host UID
# is not worth the complexity for a local development stack. On Linux hosts,
# files the backend writes under ./backend/cache will be root-owned --
# `make docker-clean-cache` removes them from inside the container.

WORKDIR /app/backend
EXPOSE 5555

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["micromamba", "run", "-n", "base", "Rscript", "backend.R"]
