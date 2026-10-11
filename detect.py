"""Anomaly detection for the Haunted Data Detective.

Two methods, plus a recurrence step that turns raw alerts into suspects:

1. Robust z-score, computed PER ROOM.
   Each room is compared with its own normal behaviour (the Cellar is always
   cold, the Kitchen is always noisy).  We use the median and the MAD instead
   of the mean and standard deviation, because the haunting itself would
   otherwise drag the mean and hide the anomaly.

2. Isolation Forest (scikit-learn).
   An unsupervised model that isolates unusual points using all three sensors
   together (temperature, EMF, noise), again after per-room normalisation.

3. Recurrence.  One odd reading proves nothing (sensors glitch).  A ghost
   comes back.  So we count how many flagged readings fall in the same
   (room, hour-of-day) cell on different nights - the cell that keeps
   lighting up is the prime suspect.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

METHODS = ("Z-score", "Isolation Forest", "Both")


@dataclass
class DetectionResult:
    scored: pd.DataFrame      # every reading, with z-scores and flags
    suspects: pd.DataFrame    # ranked (room, hour) suspects
    n_flagged: int
    method: str


def add_scores(readings: pd.DataFrame) -> pd.DataFrame:
    """Add per-room robust z-scores and a combined 'haunting score'."""
    df = readings.copy()
    df["hour"] = df["timestamp"].dt.hour
    df["date"] = df["timestamp"].dt.strftime("%Y-%m-%d")
    for col, key in (("temperature", "z_temp"), ("emf", "z_emf"), ("noise_db", "z_noise")):
        med = df.groupby("room")[col].transform("median")
        dev = (df[col] - med).abs()
        mad = dev.groupby(df["room"]).transform("median").clip(lower=1e-6)
        df[key] = 0.6745 * (df[col] - med) / mad
    # A haunting = cold AND electromagnetic: only count drops in temperature
    # and rises in EMF (the direction a ghost pushes the sensors).
    df["anomaly_score"] = (-df["z_temp"]).clip(lower=0) + df["z_emf"].clip(lower=0)
    return df


def detect(
    readings: pd.DataFrame,
    method: str = "Both",
    z_threshold: float = 4.0,
    contamination: float = 0.03,
) -> DetectionResult:
    if method not in METHODS:
        raise ValueError(f"method must be one of {METHODS}")
    df = add_scores(readings)

    df["flag_z"] = df["anomaly_score"] >= z_threshold

    df["flag_if"] = False
    if method != "Z-score":  # only fit the forest when it is actually needed
        iso = IsolationForest(n_estimators=100, contamination=contamination, random_state=42)
        features = df[["z_temp", "z_emf", "z_noise"]].to_numpy()
        df["flag_if"] = iso.fit_predict(features) == -1

    if method == "Z-score":
        df["flagged"] = df["flag_z"]
    elif method == "Isolation Forest":
        df["flagged"] = df["flag_if"]
    else:
        df["flagged"] = df["flag_z"] | df["flag_if"]

    suspects = rank_suspects(df)
    return DetectionResult(df, suspects, int(df["flagged"].sum()), method)


def rank_suspects(df: pd.DataFrame, top: int = 8) -> pd.DataFrame:
    """Rank (room, hour) cells by how often they were flagged on different nights."""
    cell_avg = (
        df.groupby(["room", "hour"])["anomaly_score"].mean().rename("avg_score").reset_index()
    )
    flagged = df[df["flagged"]]
    if flagged.empty:
        return pd.DataFrame(columns=["room", "hour", "hits", "nights", "avg_score"])
    hits = (
        flagged.groupby(["room", "hour"])
        .agg(hits=("flagged", "size"), nights=("date", "nunique"))
        .reset_index()
    )
    out = hits.merge(cell_avg, on=["room", "hour"])
    out["avg_score"] = out["avg_score"].round(2)
    out = out.sort_values(["nights", "hits", "avg_score"], ascending=False)
    return out.head(top).reset_index(drop=True)


def top_suspect(result: DetectionResult):
    """Return (room, hour) of the best suspect, or None."""
    if result.suspects.empty:
        return None
    row = result.suspects.iloc[0]
    return row["room"], int(row["hour"])
