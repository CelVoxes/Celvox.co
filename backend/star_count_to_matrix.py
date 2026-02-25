#!/usr/bin/env python3

import argparse
import pandas as pd
from pathlib import Path
import sys


def read_star_file(path):
    sample = path.name.replace(".ReadsPerGene.out.tab", "")

    df = pd.read_csv(
        path,
        sep="\t",
        header=None,
        names=["gene", "unstranded", "fwd", "rev"],
        dtype={"gene": str}
    )

    # Remove STAR summary/info rows (N_unmapped, N_multimapping, N_noFeature, N_ambiguous)
    df = df[~df["gene"].str.startswith("N_", na=False)].copy()

    df = df.rename(columns={
        "unstranded": f"{sample}_unstranded",
        "fwd":        f"{sample}_fwd",
        "rev":        f"{sample}_rev",
    })

    return df


def main():
    parser = argparse.ArgumentParser(
        description="Create count matrix from STAR ReadsPerGene.out.tab files (all strands, Option B)."
    )
    parser.add_argument(
        "files",
        nargs="+",
        help="STAR ReadsPerGene.out.tab files"
    )
    parser.add_argument(
        "-o", "--output",
        default="counts_all_strands.tsv",
        help="Output TSV file (default: counts_all_strands.tsv)"
    )
    parser.add_argument(
        "--outer",
        action="store_true",
        help="Use outer join (union of genes). Default is inner join."
    )

    args = parser.parse_args()

    dfs = []
    for f in args.files:
        path = Path(f)
        if not path.exists():
            sys.exit(f"ERROR: File not found: {f}")
        dfs.append(read_star_file(path))

    how = "outer" if args.outer else "inner"

    count_matrix = dfs[0]
    for df in dfs[1:]:
        count_matrix = count_matrix.merge(df, on="gene", how=how)

    count_matrix = count_matrix.set_index("gene")

    # Replace NA with 0 if outer join was used
    if args.outer:
        count_matrix = count_matrix.fillna(0).astype(int)

    count_matrix.to_csv(args.output, sep="\t")

    print(f"✔ Wrote count matrix: {args.output}")
    print(f"  Genes:   {count_matrix.shape[0]}")
    print(f"  Columns: {count_matrix.shape[1]}")


if __name__ == "__main__":
    main()
