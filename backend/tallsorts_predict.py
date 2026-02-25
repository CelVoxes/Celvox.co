#!/usr/bin/env python3
import argparse
import json
import warnings

import pandas as pd


def parse_args():
    p = argparse.ArgumentParser(description="Run TALLSorts T-ALL subtype prediction")
    p.add_argument("--input-csv", required=True, help="Samples x genes CSV with Ensembl IDs as columns")
    p.add_argument("--sample-name", required=True, help="Sample id for output")
    p.add_argument("--model", required=True, help="Path to TALLSorts model pickle")
    p.add_argument("--top-n", type=int, default=10, help="Number of top probabilities to return")
    return p.parse_args()


def load_samples_matrix(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, index_col=0)
    # TALLSorts expects Ensembl IDs without version suffixes.
    df.columns = [str(c).split(".")[0] for c in df.columns]
    df = df.T.groupby(level=0).sum().T
    return df.fillna(0)


def rank_probs(prob_row: pd.Series, top_n: int):
    ranked = []
    for key, value in prob_row.items():
        try:
            fval = float(value)
        except Exception:
            continue
        if pd.isna(fval):
            continue
        ranked.append({"label": str(key), "probability": fval})
    ranked.sort(key=lambda x: x["probability"], reverse=True)
    return ranked[: max(1, top_n)]


def main():
    args = parse_args()
    warnings.filterwarnings("ignore", category=FutureWarning)

    from TALLSorts.tallsorts import load_classifier

    samples = load_samples_matrix(args.input_csv)
    clf = load_classifier(args.model)
    results = clf.predict(samples)

    sample_key = samples.index[0]
    level_outputs = []
    for level_name, level_obj in results.levels.items():
        calls_df = level_obj.get("calls_df")
        probs_df = level_obj.get("probs_raw_df")
        pred_label = None
        if calls_df is not None and sample_key in calls_df.index and "y_pred" in calls_df.columns:
            pred_label = str(calls_df.loc[sample_key, "y_pred"])
        prob_row = probs_df.loc[sample_key] if probs_df is not None and sample_key in probs_df.index else pd.Series(dtype=float)
        top_predictions = rank_probs(prob_row, args.top_n)
        top_prob = top_predictions[0]["probability"] if top_predictions else None
        level_outputs.append(
            {
                "level": str(level_name),
                "prediction": pred_label,
                "confidence": float(top_prob) if top_prob is not None else None,
                "top_predictions": top_predictions,
                "probabilities": {str(k): float(v) for k, v in prob_row.items() if pd.notna(v)},
            }
        )

    primary = None
    for level in level_outputs:
        pred = level.get("prediction")
        if pred and pred not in {"Unclassified", "None", "NA", "nan"}:
            primary = level
    if primary is None and level_outputs:
        primary = level_outputs[0]

    out = {
        "sample_id": args.sample_name,
        "model": "TALLSorts (T-ALL)",
        "prediction": primary.get("prediction") if primary else None,
        "confidence": primary.get("confidence") if primary else None,
        "primary_level": primary.get("level") if primary else None,
        "levels": level_outputs,
        "input_gene_count": int(samples.shape[1]),
        "implementation": "official_tallsorts_python_package_repo",
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()
