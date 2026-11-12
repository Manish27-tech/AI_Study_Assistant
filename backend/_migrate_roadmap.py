from database import engine
from sqlalchemy import text

def run():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE topics ADD COLUMN roadmap_json TEXT"))
            print("[OK] Added column: roadmap_json")
        except Exception as e:
            print(f"[SKIP] Column likely exists: {e}")

if __name__ == "__main__":
    run()