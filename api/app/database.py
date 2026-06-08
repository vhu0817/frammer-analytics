from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

# pool_pre_ping=True makes SQLAlchemy test each connection before using it,
# so we don't get random "connection closed" errors after postgres restarts
engine = create_engine(settings.database_url, pool_pre_ping=True)

# autocommit=False because we want explicit control over transactions —
# every request gets its own session, commits on success, rolls back on failure
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """
    Every ORM model inherits from this. SQLAlchemy 2.0 style —
    the old declarative_base() function still works but this is the new way.
    """
    pass


def get_db():
    """
    FastAPI dependency that gives each request its own database session.
    The `finally` block guarantees the session closes even if the request crashes.

    Usage in a route:
        @router.get("/stuff")
        def get_stuff(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
