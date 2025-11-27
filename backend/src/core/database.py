from sqlalchemy import create_engine, Column, String, Integer, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = "sqlite:///./audiobooks/jobs.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, index=True)
    filename = Column(String)
    status = Column(String, default="queued")
    created_at = Column(DateTime, default=datetime.utcnow)
    output_path = Column(String, nullable=True)
    error = Column(String, nullable=True)
    total_blocks = Column(Integer, default=0)
    completed_blocks = Column(Integer, default=0)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
