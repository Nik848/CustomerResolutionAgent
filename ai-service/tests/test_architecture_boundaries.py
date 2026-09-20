import sys
from pathlib import Path


def test_no_database_modules_in_app():
    """Verify that no database client modules exist in ai-service/app."""
    app_dir = Path(__file__).resolve().parents[1] / "app"
    db_dir = app_dir / "db"
    assert not db_dir.exists(), "app/db directory must not exist in ai-service"


def test_no_database_imports_in_app_code():
    """Verify that no python files in app import supabase or psycopg2."""
    app_dir = Path(__file__).resolve().parents[1] / "app"
    py_files = list(app_dir.rglob("*.py"))
    assert len(py_files) > 0

    forbidden = ["import supabase", "from supabase", "import psycopg2", "from psycopg2", "get_db_cursor", "get_supabase"]

    violations = []
    for f in py_files:
        content = f.read_text(encoding="utf-8")
        for word in forbidden:
            if word in content:
                violations.append(f"{f.name}: contains forbidden '{word}'")

    assert not violations, f"Architectural violations found: {violations}"


def test_clean_env_variables():
    """Verify that ai-service/.env contains no database or Supabase credentials."""
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if env_file.exists():
        content = env_file.read_text(encoding="utf-8")
        assert "SUPABASE_URL" not in content
        assert "SUPABASE_ANON_KEY" not in content
        assert "DATABASE_URL" not in content
        assert "POSTGRES_URL" not in content
