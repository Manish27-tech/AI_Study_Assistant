"""
Train a Random Forest classifier to predict whether a student
is at risk on a given topic.

Features:
    score           (0-100)
    attempts        (int)
    difficulty_enc  (0=easy, 1=medium, 2=hard)

Target:
    at_risk (0 or 1)
"""

import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

# ---------------- Synthetic training data ----------------
np.random.seed(42)

def generate_row():
    score = np.random.randint(0, 101)
    attempts = np.random.randint(0, 8)
    difficulty_enc = np.random.choice([0, 1, 2])

    # Rule-based "ground truth" for at_risk
    at_risk = 0
    if score < 40:
        at_risk = 1
    elif score < 55 and difficulty_enc == 2:
        at_risk = 1
    elif attempts >= 4 and score < 65:
        at_risk = 1
    elif score < 50 and attempts <= 1:
        at_risk = 1
    else:
        at_risk = 0

    return score, attempts, difficulty_enc, at_risk


print("Generating synthetic data...")
rows = [generate_row() for _ in range(3000)]
df = pd.DataFrame(rows, columns=["score", "attempts", "difficulty_enc", "at_risk"])

X = df[["score", "attempts", "difficulty_enc"]]
y = df["at_risk"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# ---------------- Train model ----------------
print("Training Random Forest...")
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=8,
    random_state=42,
    class_weight="balanced",
)
model.fit(X_train, y_train)

# ---------------- Evaluate ----------------
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"\n✅ Accuracy: {acc:.3f}\n")
print(classification_report(y_test, y_pred, target_names=["on_track", "at_risk"]))

# Feature importance
print("Feature importances:")
for name, imp in zip(X.columns, model.feature_importances_):
    print(f"  {name}: {imp:.3f}")

# ---------------- Save model ----------------
MODEL_PATH = Path(__file__).resolve().parent.parent / "backend" / "risk_model.pkl"
MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(model, MODEL_PATH)
print(f"\n💾 Model saved to: {MODEL_PATH}")