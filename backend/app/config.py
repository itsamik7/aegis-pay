import os
from pydantic import BaseModel

class Settings(BaseModel):
    APP_NAME: str = "AEGIS-PAY"
    APP_DESCRIPTOR: str = "Merchant Behaviour Intelligence"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./aegis_pay.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "synthetic-demo-secret-key-aegis-pay-2024")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() == "true"
    ALLOW_SYNTHETIC_RESET: bool = os.getenv("ALLOW_SYNTHETIC_RESET", "true").lower() == "true"

settings = Settings()
