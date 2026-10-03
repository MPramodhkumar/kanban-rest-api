#database.py is used to set up everything needed for FastAPI to communicate with PostgreSQL.
# It tells your project:

    # "Here is my PostgreSQL database,
    # here is how to connect to it,
    # and here is how each API request should use the database."
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()  # reads .env into environment variables

engine = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()