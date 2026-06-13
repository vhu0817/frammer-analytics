from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base

# triggers all model imports so Base.metadata knows about every table
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # runs once when the server starts — creates any tables that don't exist yet.
    # in production you'd use alembic migrations instead, but this is handy
    # during early development so we don't have to run migrations manually
    Base.metadata.create_all(bind=engine)
    yield
    # nothing to clean up on shutdown for now, but this is where you'd
    # close connection pools, flush caches, etc.


app = FastAPI(
    title="Frammer Analytics API",
    version="0.1.0",
    lifespan=lifespan,
)

# allow the vite dev server to talk to us without CORS errors.
# in production you'd lock this down to your actual domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.vite_api_url,  # http://localhost:5173 or wherever the frontend is
        "http://localhost:5173",  # vite's default port, just in case
        settings.frontend_url, # production Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# each route module gets its own prefix — keeps the URL structure clean
# and means individual route files don't need to worry about /api/whatever
from app.routes import auth, executive, trends, analysis, funnel, explorer, filters, agent

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(executive.router,  prefix="/api/executive",  tags=["executive"])
app.include_router(trends.router,     prefix="/api/trends",     tags=["trends"])
app.include_router(analysis.router,   prefix="/api/analysis",   tags=["analysis"])
app.include_router(funnel.router,     prefix="/api/funnel",     tags=["funnel"])
app.include_router(explorer.router,   prefix="/api/explorer",   tags=["explorer"])
app.include_router(filters.router,    prefix="/api/filters",    tags=["filters"])
app.include_router(agent.router,      prefix="/api/agent",      tags=["agent"])


@app.get("/health", tags=["health"])
def health_check():
    """
    Quick sanity check — if this returns 200, the API container is alive.
    Docker-compose healthcheck hits this endpoint every 30s.
    """
    return {"status": "healthy", "version": app.version}
