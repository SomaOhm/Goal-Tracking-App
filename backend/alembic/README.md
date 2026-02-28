# Alembic Migration Scripts

See README.md for instructions on running migrations.

## Quick Start

```bash
# Create a new migration
alembic revision --autogenerate -m "Add user table"

# Apply all pending migrations
alembic upgrade head

# Revert to previous migration
alembic downgrade -1
```
