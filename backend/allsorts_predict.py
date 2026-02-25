#!/usr/bin/env python3
import argparse
import json
import warnings

import pandas as pd
from sklearn.decomposition import KernelPCA

# ALLSorts codebase still uses DataFrame.iteritems (removed in pandas 2.x)
if not hasattr(pd.DataFrame, "iteritems"):
    pd.DataFrame.iteritems = pd.DataFrame.items  # type: ignore[attr-defined]


def parse_args():
    p = argparse.ArgumentParser(description="Run ALLSorts B-ALL subtype prediction")
    p.add_argument("--input-csv", required=True, help="Samples x genes CSV with gene symbols as columns")
    p.add_argument("--sample-name", required=True, help="Sample id for output")
    p.add_argument("--model", required=True, help="Path to ALLSorts model pickle")
    p.add_argument("--model-dir", required=True, help="ALLSorts model directory")
    p.add_argument("--top-n", type=int, default=10, help="Number of top probabilities to return")
    p.add_argument("--parents", action="store_true", help="Include parent/meta-subtypes")
    return p.parse_args()


def load_samples_matrix(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, index_col=0)
    # Merge duplicate gene symbols after upstream Ensembl->symbol conversion.
    df = df.T.groupby(level=0).sum().T
    return df.fillna(0)


def patch_allsorts_compat(model) -> None:
    """Patch known ALLSorts model compatibility issues on modern sklearn/pandas."""

    def walk(obj, seen: set[int]) -> None:
        obj_id = id(obj)
        if obj_id in seen:
            return
        seen.add(obj_id)

        if isinstance(obj, KernelPCA):
            # sklearn <=0.22 stored alphas_/lambdas_; sklearn>=1.x expects eigenvectors_/eigenvalues_
            if "alphas_" in obj.__dict__ and "eigenvectors_" not in obj.__dict__:
                obj.eigenvectors_ = obj.__dict__["alphas_"]
            if "lambdas_" in obj.__dict__ and "eigenvalues_" not in obj.__dict__:
                obj.eigenvalues_ = obj.__dict__["lambdas_"]

        if isinstance(obj, dict):
            for value in obj.values():
                walk(value, seen)
            return

        if isinstance(obj, (list, tuple, set)):
            for value in obj:
                walk(value, seen)
            return

        if hasattr(obj, "__dict__"):
            for value in obj.__dict__.values():
                walk(value, seen)

    walk(model, set())


def numeric_probability_ranking(prob_row: pd.Series, top_n: int):
    ranked = []
    for key, value in prob_row.items():
        if key in {"Pred", "True"}:
            continue
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

    from ALLSorts.allsorts import load_classifier, run_predictions

    samples = load_samples_matrix(args.input_csv)
    clf = load_classifier(args.model)
    patch_allsorts_compat(clf)

    results = run_predictions(
        allsorts=clf,
        samples=samples,
        labels=False,
        parents=bool(args.parents),
        save_results=False,
        save_counts=False,
        save_figures=False,
        destination=None,
        model_dir=args.model_dir,
    )

    pred_df = results["predictions"]
    prob_df = results["probabilities"]
    pred_row = pred_df.iloc[0]
    prob_row = prob_df.iloc[0]

    top_predictions = numeric_probability_ranking(prob_row, args.top_n)
    primary_label = str(pred_row.get("Prediction", top_predictions[0]["label"] if top_predictions else "Unknown"))
    primary_prob = next((x["probability"] for x in top_predictions if x["label"] == primary_label), None)

    model_gene_count = None
    matched_gene_count = None
    try:
        preprocess = clf.named_steps.get("preprocess")
        model_genes = list(getattr(preprocess, "genes", []) or [])
        if model_genes:
            model_gene_count = len(model_genes)
            matched_gene_count = int(sum(g in samples.columns for g in model_genes))
    except Exception:
        pass

    out = {
        "sample_id": args.sample_name,
        "model": "ALLSorts (B-ALL)",
        "prediction": primary_label,
        "confidence": float(primary_prob) if primary_prob is not None else None,
        "top_predictions": top_predictions,
        "input_gene_count": int(samples.shape[1]),
        "model_gene_count": model_gene_count,
        "matched_gene_count": matched_gene_count,
        "probabilities": {
            str(k): (float(v) if pd.notna(v) and str(k) not in {"Pred", "True"} else v)
            for k, v in prob_row.items()
            if str(k) != "True"
        },
        "implementation": "official_allsorts_python_package_repo",
        "compatibility_patches": ["kernelpca_old_pickle_attributes", "pandas_iteritems_alias"],
    }

    print(json.dumps(out))


if __name__ == "__main__":
    main()
