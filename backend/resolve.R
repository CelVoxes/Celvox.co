# Asset resolution ------------------------------------------------------------
#
# Single, documented rule for turning a registry's list of candidate file paths
# into a concrete on-disk path. The registries (tools_registry.R, data_registry.R)
# carry candidate lists today because of migration cruft (3-4 fallback roots per
# asset: tools_runtime/, tools/, data/tools/, data/...). This module is the one
# place that resolution policy is defined, and is the intended entry point going
# forward.
#
# Resolution order is "canonical runtime roots first, legacy roots last". Legacy
# roots are gated behind SEAMLESS_INCLUDE_LEGACY_PATHS.
#
# The flag now DEFAULTS OFF (canonical roots only) — the legacy migration paths
# are retired by default. The audit in tests/legacy_path_audit.R confirmed every
# molecular-tool asset resolves under a canonical root (tools_runtime/ tools/
# data/tools), so nothing legacy-only remains. Any environment whose assets are
# not yet consolidated can opt back in with SEAMLESS_INCLUDE_LEGACY_PATHS=true.
# Run the audit against a new deployment layout before relying on the default.
#
# Depends on data_registry.R: first_existing_path(), %||%.

# Canonical runtime roots, in priority order. A path under any of these is
# preferred over a legacy fallback.
CANONICAL_ASSET_ROOTS <- c("tools_runtime", "tools", file.path("data", "tools"))

legacy_paths_enabled <- function() {
    # Default OFF: legacy migration paths are retired unless explicitly opted in.
    val <- tolower(trimws(Sys.getenv("SEAMLESS_INCLUDE_LEGACY_PATHS", "false")))
    val %in% c("1", "true", "yes", "on")
}

is_canonical_path <- function(path) {
    any(vapply(
        CANONICAL_ASSET_ROOTS,
        function(root) startsWith(path, paste0(root, .Platform$file.sep)) || identical(path, root),
        logical(1)
    ))
}

# Resolve a set of candidate paths to the first existing file, applying the
# canonical-first / legacy-last ordering. When legacy paths are disabled, only
# canonical candidates are considered.
#
# candidates : character vector of candidate paths (registry output).
# label      : human label used in the error when require = TRUE.
# require    : if TRUE, stop() when nothing resolves; else return NULL.
resolve_asset <- function(candidates, label = "asset", require = FALSE) {
    candidates <- unlist(candidates, use.names = FALSE)
    candidates <- candidates[nzchar(candidates %||% "")]

    if (!legacy_paths_enabled()) {
        candidates <- candidates[vapply(candidates, is_canonical_path, logical(1))]
    } else {
        canonical <- candidates[vapply(candidates, is_canonical_path, logical(1))]
        legacy <- candidates[!vapply(candidates, is_canonical_path, logical(1))]
        candidates <- c(canonical, legacy)
    }

    resolved <- first_existing_path(candidates)
    if (is.null(resolved) && isTRUE(require)) {
        stop(sprintf("Required %s not found in candidates: %s", label, paste(candidates, collapse = ", ")))
    }
    resolved
}
