#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import pandas as pd


def parse_args():
    p = argparse.ArgumentParser(description="Run Bridge RNA prediction via official Bridge package")
    p.add_argument("--input-csv", required=True, help="RNA count matrix CSV (genes x sample[s])")
    p.add_argument("--sample-name", required=True, help="Sample name for output")
    p.add_argument("--bundle", help="Path to Bridge .bundle")
    p.add_argument("--meta", help="Path to metadata joblib (fallback when bundle missing)")
    p.add_argument("--ckpt", help="Path to checkpoint ckpt (fallback when bundle missing)")
    p.add_argument("--lr", help="Path to classifier joblib (fallback when bundle missing)")
    p.add_argument("--device", default="cpu", help="Bridge device (auto/cpu/cuda/mps)")
    return p.parse_args()


def load_counts_long(input_csv: str):
    df = pd.read_csv(input_csv)
    if df.shape[1] < 2:
        raise ValueError("Input CSV must contain at least 2 columns")

    gene_col = df.columns[0]
    count_col = df.columns[1]
    out = df[[gene_col, count_col]].copy()
    out.columns = ["gene_id", "count"]
    out["gene_id"] = out["gene_id"].astype(str).str.replace(r"\.[0-9]+$", "", regex=True)
    out["count"] = pd.to_numeric(out["count"], errors="coerce").fillna(0.0)
    out = out.groupby("gene_id", as_index=False)["count"].sum()
    return out


def run_bridge_prediction(args):
    from bridge import BridgePredictor

    predictor_kwargs = {"device": args.device}
    if args.bundle:
        predictor_kwargs["bundle"] = args.bundle
    else:
        missing = [k for k, v in {"--ckpt": args.ckpt, "--meta": args.meta, "--lr": args.lr}.items() if not v]
        if missing:
            raise ValueError(f"Missing Bridge artifact arguments: {', '.join(missing)}")
        predictor_kwargs.update(
            {
                "checkpoint": args.ckpt,
                "metadata": args.meta,
                "classifier": args.lr,
            }
        )

    predictor = BridgePredictor(**predictor_kwargs)
    try:
        result = predictor.predict_rna(args.input_csv)
        pred_df = result.predictions
        prob_df = result.probabilities
        lat_df = result.latents

        if pred_df.empty:
            raise RuntimeError("Bridge returned no predictions")

        pred_row = pred_df.iloc[0].to_dict()
        prob_row = prob_df.iloc[0].to_dict() if not prob_df.empty else {}

        ranked = []
        for key, value in prob_row.items():
            if key == "sample_id" or not str(key).startswith("proba_"):
                continue
            label = str(key)[6:]
            ranked.append({"label": label, "probability": float(value)})
        ranked.sort(key=lambda x: x["probability"], reverse=True)

        counts_df = load_counts_long(args.input_csv)
        counts_by_gene = dict(zip(counts_df["gene_id"], counts_df["count"]))
        rna_features = [str(x) for x in getattr(predictor, "rna_features", [])]
        matched_nonzero = int(sum(1 for g in rna_features if counts_by_gene.get(g, 0.0) > 0))
        warning = None
        if matched_nonzero < 100:
            warning = (
                "Very low Bridge RNA feature overlap. Check that uploaded genes are Ensembl IDs "
                "(ENSG...) and represent raw RNA counts."
            )

        top_label = str(pred_row.get("predicted_label", ranked[0]["label"] if ranked else "Unknown"))
        top_prob = float(pred_row.get("predicted_proba", ranked[0]["probability"] if ranked else 0.0))
        latent_dim = int(max(0, len(lat_df.columns) - 1)) if not lat_df.empty else 0

        return {
            "sample_id": args.sample_name,
            "bridge_sample_id": str(pred_row.get("sample_id", "")),
            "model": "Bridge (official package)",
            "prediction": top_label,
            "confidence": top_prob,
            "predicted_label": top_label,
            "probability": top_prob,
            "top_predictions": ranked[:10],
            "n_input_features": int(len(rna_features)),
            "latent_dim": latent_dim,
            "normalization": str(getattr(predictor, "options", {}).get("rna_normalization", "unknown")),
            "log1p_rna": bool(getattr(predictor, "options", {}).get("log1p_rna", False)),
            "matched_nonzero_features": matched_nonzero,
            "warning": warning,
            "implementation": "official_bridge_python_package",
        }
    finally:
        predictor.close()


def main():
    args = parse_args()
    out = run_bridge_prediction(args)
    print(json.dumps(out))


if __name__ == "__main__":
    main()
