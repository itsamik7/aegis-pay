import os
import shutil
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.path.exists("/var/task"))

if is_serverless:
    # On serverless (Vercel/Lambda), only /tmp is writable
    tmp_db = "/tmp/aegis_pay.db"
    if not os.path.exists(tmp_db):
        candidates = [
            os.path.join(os.path.dirname(__file__), "..", "aegis_pay.db"),
            os.path.join(os.path.dirname(__file__), "aegis_pay.db"),
            "/var/task/backend/aegis_pay.db",
            "/var/task/aegis_pay.db",
        ]
        for candidate in candidates:
            if os.path.exists(candidate) and os.path.getsize(candidate) > 0:
                try:
                    shutil.copyfile(candidate, tmp_db)
                    break
                except Exception as e:
                    print(f"Failed to copy candidate {candidate}: {e}")
    default_db_url = f"sqlite:///{tmp_db}"
else:
    default_db_url = "sqlite:///./aegis_pay.db"

DATABASE_URL = os.getenv("DATABASE_URL", default_db_url)
# Fix Heroku/Supabase/Neon postgres:// to postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
engine_kwargs = {"echo": False}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_kwargs["connect_args"] = connect_args
else:
    # Serverless PostgreSQL connection pooling (Neon, Supabase, AWS RDS)
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

engine = create_engine(
    DATABASE_URL,
    **engine_kwargs
)

# Enable SQLite foreign key constraints
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            if is_serverless:
                cursor.execute("PRAGMA journal_mode=DELETE")
            else:
                cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()
        except Exception:
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
