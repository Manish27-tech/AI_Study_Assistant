"""
Postgres-compatible migration: adds onboarding columns to students table.
Run once locally: python _migrate_onboarding.py
"""

from database import engine
from sqlalchemy import text


def run():
    # (column_name, postgres_definition)
    cols = [
        ("onboarding_completed", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("learning_goal", "VARCHAR(255) NOT NULL DEFAULT ''"),
        ("daily_time_minutes", "INTEGER NOT NULL DEFAULT 30"),
        ("current_level", "VARCHAR(50) NOT NULL DEFAULT ''"),
    ]

    with engine.begin() as conn:  # begin() auto-commits on success
        for name, definition in cols:
            sql = f"ALTER TABLE students ADD COLUMN {name} {definition}"
            try:
                conn.execute(text(sql))
                print(f"[OK] Added column: {name}")
            except Exception as e:
                msg = str(e).lower()
                if "already exists" in msg or "duplicate" in msg:
                    print(f"[SKIP] Column already exists: {name}")
                else:
                    print(f"[ERROR] {name}: {e}")
                    raise  # stop on real errors

        # Mark existing users as onboarded so they aren't forced through wizard
        try:
            conn.execute(text("UPDATE students SET onboarding_completed = TRUE"))
            print("[OK] Marked existing users as onboarded")
        except Exception as e:
            print(f"[WARN] Could not update existing users: {e}")

    print("Migration complete.")


if __name__ == "__main__":
    run()