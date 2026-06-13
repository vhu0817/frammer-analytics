from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Reads everything from .env (or environment variables if they're already set).
    Pydantic validates types automatically — if someone puts "abc" for a port,
    it'll blow up at startup instead of halfway through a request.
    """

    # postgres
    postgres_db: str = "frammer_analytics"
    postgres_user: str = "frammer"
    postgres_password: str = "frammer_secret"
    database_url: str = "postgresql://frammer:frammer_secret@db:5432/frammer_analytics"

    # jwt — defaults are fine for local dev, but please change the secret in prod
    jwt_secret: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    # gemini (only matters in phase 7, safe to ignore for now)
    gemini_api_key: str = ""

    # frontend url for CORS — we'll allow this origin in main.py
    vite_api_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        # so we don't crash if .env has vars we don't care about (like VITE_ stuff)
        extra="ignore",
    )


# single instance the rest of the app imports
settings = Settings()
