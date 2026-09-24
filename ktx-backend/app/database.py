"""
Database module compatibility forwarder.
Canonical database configuration has been moved to app.core.database.
"""
from app.core.database import Base, SessionLocal, engine, get_db

__all__ = ["Base", "SessionLocal", "engine", "get_db"]