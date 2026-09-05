import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Retrieve database connection string from environment
# Supabase PostgreSQL supports both direct connection (port 5432) and pooled connection (port 6543)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./flight_management.db")

# In production PostgreSQL (Supabase), sqlite-specific connect_args should be omitted
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Initialize SQLAlchemy 2.0 Engine
# pool_pre_ping=True ensures dead pooled connections (common with cloud DBs like Supabase) are automatically discarded
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_size=10 if not DATABASE_URL.startswith("sqlite") else 5,
    max_overflow=20 if not DATABASE_URL.startswith("sqlite") else 10,
    echo=False  # Set to True for SQL query debugging
)

# Session factory for DB transactions
# autocommit=False ensures explicit transaction demarcation for atomic seat holds and bookings
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models.py
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency injection yields a clean DB session per request.
    Automatically closes session upon request completion and rolls back on exception.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
