"""Pytest configuration to add backend directory to sys.path."""
import sys
import os
from pathlib import Path
import pytest

# Add backend directory to sys.path so tests can import app and worker modules
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


# Skip database tests if DATABASE_URL isn't properly configured
def pytest_configure(config):
    config.addinivalue_line(
        "markers", 
        "db: mark test as requiring database connection"
    )


def pytest_collection_modifyitems(config, items):
    """Mark tests that require database and skip if not configured."""
    db_url = os.environ.get("DATABASE_URL", "")
    is_sqlite = "sqlite" in db_url
    is_localhost = "localhost" in db_url
    
    # Skip tests that require a real database if only Supabase credentials are set
    if not db_url or is_sqlite or is_localhost:
        skip_marker = pytest.mark.skip(reason="Requires DATABASE_URL with Supabase credentials")
        for item in items:
            # Skip member and mentor tests (they require database)
            if "test_member" in str(item.fspath) or "test_mentor" in str(item.fspath):
                item.add_marker(skip_marker)
