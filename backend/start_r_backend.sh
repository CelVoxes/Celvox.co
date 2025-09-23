#!/bin/bash

# Activate the micromamba environment
export MAMBA_ROOT_PREFIX=/root/micromamba
export PATH="/root/micromamba/envs/celvox_env/bin:$PATH"

# Set environment variables for R
export R_ENV=production
export R_PROFILE_USER=~/.Rprofile

# Change to backend directory
cd /root/celvox.co/backend

# Run the R backend
exec /root/micromamba/envs/celvox_env/bin/Rscript backend.R
