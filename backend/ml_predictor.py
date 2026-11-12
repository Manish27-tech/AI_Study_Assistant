"""
Loads the trained Random Forest and exposes predict_risk().
"""

from pathlib import Path
import joblib

MODEL_PATH = Path(__file__).resolve().parent / "risk_model.pkl"

# Load once at import time
_model = None

def load_model():
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. "
                "Run `python ml/train_model.py` first."
            )
        _model = joblib.load(MODEL_PATH)
    return _model


DIFFICULTY_MAP = {"easy": 0, "medium": 1, "hard": 2}


def predict_risk(score: float, attempts: int, difficulty: str) -> dict:
    """
    Returns:
        {
            "at_risk": bool,
            "probability": float,  # 0.0 - 1.0
            "confidence": str      # "low" / "medium" / "high"
        }
    """
    model = load_model()
    diff_enc = DIFFICULTY_MAP.get(difficulty.lower(), 1)

    features = [[score, attempts, diff_enc]]
    proba = model.predict_proba(features)[0]  # [P(on_track), P(at_risk)]
    at_risk_prob = float(proba[1])
    at_risk = at_risk_prob >= 0.5

    if at_risk_prob >= 0.75 or at_risk_prob <= 0.25:
        confidence = "high"
    elif at_risk_prob >= 0.6 or at_risk_prob <= 0.4:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "at_risk": at_risk,
        "probability": round(at_risk_prob, 3),
        "confidence": confidence,
    }