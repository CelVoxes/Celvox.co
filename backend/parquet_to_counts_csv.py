#!/usr/bin/env python3
import argparse
import sys

import pandas as pd


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert a reference RNA parquet matrix to CSV with gene_id as the first column."
    )
    parser.add_argument("--input-parquet", required=True)
    parser.add_argument("--output-csv", required=True)
    args = parser.parse_args()

    df = pd.read_parquet(args.input_parquet)

    if "Gene" in df.columns:
        gene_col = "Gene"
        out = df.copy()
    else:
        out = df.reset_index()
        if "Gene" in out.columns:
            gene_col = "Gene"
        else:
            gene_col = out.columns[0]

    if gene_col != "gene_id":
        out = out.rename(columns={gene_col: "gene_id"})

    # Ensure gene_id is the first column.
    cols = ["gene_id"] + [c for c in out.columns if c != "gene_id"]
    out = out.loc[:, cols]

    out.to_csv(args.output_csv, index=False)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - CLI error path
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
