"""
One-time migration: add missing columns to existing tables.
Safe to run multiple times — it checks what exists before adding.
"""

from database import engine
from sqlalchemy import text


# Columns to add to the students table
STUDENT_COLUMNS = [
    ("bio", "TEXT", ""),
    ("interests", "TEXT", ""),
    ("avatar_url", "TEXT", ""),
    ("preferred_learning_style", "VARCHAR", ""),
    ("education_level", "VARCHAR", ""),
    ("location", "VARCHAR", ""),
    ("website", "VARCHAR", ""),
    ("github", "VARCHAR", ""),
    ("linkedin", "VARCHAR", ""),
    ("preferred_language", "VARCHAR", "en"),
]


def column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = :table AND column_name = :column
    """), {"table": table, "column": column})
    return result.fetchone() is not None


def add_column(conn, table: str, column: str, col_type: str, default: str):
    if column_exists(conn, table, column):
        print(f"  ✓ {table}.{column} already exists")
        return

    # Build ALTER statement with default
    if default:
        safe_default = default.replace("'", "''")
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_type} DEFAULT '{safe_default}'"
    else:
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"

    conn.execute(text(sql))
    conn.commit()
    print(f"  + Added {table}.{column}")


def main():
    print("Running migrations...")
    print()

    with engine.connect() as conn:
        print("Updating 'students' table:")
        for column, col_type, default in STUDENT_COLUMNS:
            try:
                add_column(conn, "students", column, col_type, default)
            except Exception as e:
                print(f"  ✗ Failed to add {column}: {e}")

    print()
    print("✓ Migration complete.")


if __name__ == "__main__":
    main()