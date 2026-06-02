# Legacy asset-path audit. Resolves every molecular-tool asset twice — with the
# legacy fallback ON (today's default) and OFF (canonical roots only) — and
# reports which assets would stop resolving if SEAMLESS_INCLUDE_LEGACY_PATHS were
# turned off. An empty "would break" list means the flag is safe to retire.
# Run from backend/:  Rscript tests/legacy_path_audit.R
suppressWarnings(suppressMessages({
    library(fst); library(data.table)
    for (f in c("data_registry.R", "tools_registry.R", "modalities.R",
                "capabilities.R", "cohorts.R", "resolve.R")) source(f)
}))

tools <- c("amlmapr", "allsorts", "allcatchr", "tallsorts", "bridge")

resolve_all <- function() {
    out <- list()
    for (t in tools) {
        a <- tryCatch(resolve_molecular_tool_assets(t), error = function(e) NULL)
        if (is.null(a)) next
        for (k in names(a)) {
            if (k == "tool") next
            out[[paste0(t, ".", k)]] <- a[[k]]
        }
    }
    # bridge resolves its assets inline from candidate lists, not via
    # resolve_molecular_tool_assets — cover it explicitly.
    b <- tryCatch(resolve_bridge_assets("pan_leukemia"), error = function(e) NULL)
    if (!is.null(b)) {
        for (k in c("bundle_candidates", "meta_candidates", "ckpt_candidates", "lr_candidates")) {
            if (!is.null(b[[k]])) out[[paste0("bridge.", sub("_candidates$", "", k))]] <- resolve_asset(b[[k]])
        }
    }
    out
}

classify <- function(path) {
    if (is.null(path) || !nzchar(path)) return("MISSING")
    if (is_canonical_path(path)) "canonical" else "legacy"
}

Sys.setenv(SEAMLESS_INCLUDE_LEGACY_PATHS = "true")
with_legacy <- resolve_all()
Sys.setenv(SEAMLESS_INCLUDE_LEGACY_PATHS = "false")
canonical_only <- resolve_all()

cat(sprintf("%-32s %-10s %-10s %s\n", "ASSET", "LEGACY-ON", "CANON-ONLY", "note"))
cat(strrep("-", 78), "\n")
would_break <- character(0)
on_legacy <- character(0)
for (key in names(with_legacy)) {
    p_on  <- with_legacy[[key]]
    p_can <- canonical_only[[key]]
    cls_on  <- classify(p_on)
    cls_can <- classify(p_can)
    note <- ""
    if (cls_on != "MISSING" && cls_can == "MISSING") { note <- "<< WOULD BREAK"; would_break <- c(would_break, key) }
    else if (cls_on == "legacy") { note <- "(resolves to legacy root today)"; on_legacy <- c(on_legacy, key) }
    cat(sprintf("%-32s %-10s %-10s %s\n", key, cls_on, cls_can, note))
}

cat("\n== summary ==\n")
cat(sprintf("assets resolving via a LEGACY root today: %d%s\n", length(on_legacy),
            if (length(on_legacy)) paste0(" (", paste(on_legacy, collapse=", "), ")") else ""))
cat(sprintf("assets that would BREAK if legacy paths disabled: %d%s\n", length(would_break),
            if (length(would_break)) paste0(" (", paste(would_break, collapse=", "), ")") else ""))
cat(if (length(would_break) == 0)
    "\nVERDICT: SEAMLESS_INCLUDE_LEGACY_PATHS is safe to retire (all assets canonical or absent).\n"
    else "\nVERDICT: NOT safe to retire yet — migrate the assets above under a canonical root first.\n")
