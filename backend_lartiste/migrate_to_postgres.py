
"""
One-time migration: copies database schema only
from SQLite to PostgreSQL (Neon).

No records are copied.
"""

from sqlalchemy import create_engine, inspect
import models

# ---- CONFIG ----
SQLITE_URL = "sqlite:///./data.db"

POSTGRES_URL = "postgresql://neondb_owner:npg_r9leALhPDq3z@ep-mute-sound-bd9tqtf1-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

if POSTGRES_URL.startswith("postgres://"):
    POSTGRES_URL = POSTGRES_URL.replace(
        "postgres://", "postgresql://", 1
    )

# ---- SETUP ----
sqlite_engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False}
)

postgres_engine = create_engine(POSTGRES_URL)

# ---- CHECK SQLITE TABLES ----
sqlite_inspector = inspect(sqlite_engine)
sqlite_tables = sqlite_inspector.get_table_names()

print("SQLite tables found:")
for table in sqlite_tables:
    print(f" - {table}")

# ---- CREATE POSTGRES TABLES ----
models.Base.metadata.create_all(bind=postgres_engine)

# ---- VERIFY ----
postgres_inspector = inspect(postgres_engine)
postgres_tables = postgres_inspector.get_table_names()

print("\nPostgreSQL tables created:")
for table in postgres_tables:
    print(f" - {table}")

print("\nSchema migration completed!")
print("No data was copied.")

sqlite_engine.dispose()
postgres_engine.dispose()
